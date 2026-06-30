from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from .. import models, schemas
from ..database import get_db
from ..deps import get_current_employee
from ..utils_weeks import get_month_weeks, weekly_max

router = APIRouter(prefix="/reports", tags=["Haftalik hisobot"])

_ADMIN_ROLES = {models.RoleEnum.superadmin, models.RoleEnum.direktor, models.RoleEnum.zamdirektor}
_HEAD_ROLES = {models.RoleEnum.bolim_boshligi, models.RoleEnum.boshqarma_boshligi}


def _can_review(reviewer: models.Employee, target: models.Employee) -> bool:
    """reviewer, target xodimning haftalik hisobotini tasdiqlay oladimi."""
    if reviewer.id == target.id:
        return False
    if reviewer.role in _ADMIN_ROLES:
        return target.role in _HEAD_ROLES
    if reviewer.role in _HEAD_ROLES:
        return target.department_id == reviewer.department_id and target.role not in _HEAD_ROLES
    return False


def _reviewer_targets(current: models.Employee, db: Session) -> List[models.Employee]:
    """current tasdiqlay oladigan barcha xodimlar ro'yxati."""
    if current.role in _ADMIN_ROLES:
        return (
            db.query(models.Employee)
            .filter(models.Employee.role.in_(_HEAD_ROLES), models.Employee.is_active == True)
            .order_by(models.Employee.id)
            .all()
        )
    if current.role in _HEAD_ROLES:
        if current.department_id is None:
            return []
        return (
            db.query(models.Employee)
            .filter(
                models.Employee.department_id == current.department_id,
                models.Employee.is_active == True,
                ~models.Employee.role.in_(_HEAD_ROLES),
            )
            .order_by(models.Employee.id)
            .all()
        )
    return []


def _upsert_score(db: Session, emp_id: int, year: int, month: int, creator_id: int) -> models.Score:
    sc = db.query(models.Score).filter(
        models.Score.employee_id == emp_id,
        models.Score.year == year,
        models.Score.month == month,
    ).first()
    if not sc:
        sc = models.Score(employee_id=emp_id, year=year, month=month, created_by=creator_id)
        db.add(sc)
        db.flush()
    return sc


def _sync_bolim_ball(db: Session, emp_id: int, year: int, month: int, actor_id: int):
    """Tasdiqlangan haftalik ballar yig'indisini Score.bolim_ball ga yozadi."""
    total = (
        db.query(models.WeeklyReport)
        .filter(
            models.WeeklyReport.employee_id == emp_id,
            models.WeeklyReport.year == year,
            models.WeeklyReport.month == month,
            models.WeeklyReport.confirmed_at.isnot(None),
        )
        .all()
    )
    s = sum(w.ball or 0 for w in total)
    sc = _upsert_score(db, emp_id, year, month, actor_id)
    sc.bolim_ball = round(s, 2) if total else None


def _week_info_map(year: int, month: int) -> dict[int, dict]:
    return {w["week"]: w for w in get_month_weeks(year, month)}


@router.get("/weeks", response_model=List[schemas.WeekInfo])
def list_weeks(
    year: int,
    month: int,
    _: models.Employee = Depends(get_current_employee),
):
    """Berilgan oydagi haftalar va ularning sana oraliqlari."""
    wmax = weekly_max(year, month)
    return [
        schemas.WeekInfo(week=w["week"], start=w["start"], end=w["end"], label=w["label"], max_ball=wmax)
        for w in get_month_weeks(year, month)
    ]


@router.post("/weekly", response_model=schemas.WeeklyReportOut)
def upload_weekly_report(
    payload: schemas.WeeklyReportUploadIn,
    db: Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    """Joriy foydalanuvchi o'zining haftalik hisobot faylini yuklaydi."""
    weeks = _week_info_map(payload.year, payload.month)
    if payload.week not in weeks:
        raise HTTPException(status_code=422, detail="Noto'g'ri hafta raqami")

    rep = db.query(models.WeeklyReport).filter(
        models.WeeklyReport.employee_id == current.id,
        models.WeeklyReport.year == payload.year,
        models.WeeklyReport.month == payload.month,
        models.WeeklyReport.week == payload.week,
    ).first()

    if rep and rep.confirmed_at is not None:
        raise HTTPException(status_code=400, detail="Tasdiqlangan hisobotni qayta yuklab bo'lmaydi")

    if not rep:
        rep = models.WeeklyReport(
            employee_id=current.id, year=payload.year, month=payload.month, week=payload.week,
        )
        db.add(rep)

    rep.file_name = payload.file_name
    rep.file_b64 = payload.file_b64
    rep.uploaded_at = datetime.utcnow()
    db.commit()
    db.refresh(rep)

    out = schemas.WeeklyReportOut.model_validate(rep)
    w = weeks[payload.week]
    out.week_label = w["label"]
    out.max_ball = weekly_max(payload.year, payload.month)
    out.employee_name = current.full_name
    return out


@router.get("/weekly/mine", response_model=List[schemas.WeeklyReportOut])
def my_weekly_reports(
    year: int,
    month: int,
    db: Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    """Joriy foydalanuvchining shu oydagi haftalik hisobotlari (yuklanmaganlar ham bo'sh hafta sifatida)."""
    weeks = get_month_weeks(year, month)
    wmax = weekly_max(year, month)
    existing = {
        r.week: r
        for r in db.query(models.WeeklyReport).filter(
            models.WeeklyReport.employee_id == current.id,
            models.WeeklyReport.year == year,
            models.WeeklyReport.month == month,
        ).all()
    }
    result = []
    for w in weeks:
        rep = existing.get(w["week"])
        if rep:
            out = schemas.WeeklyReportOut.model_validate(rep)
        else:
            out = schemas.WeeklyReportOut(
                id=0, employee_id=current.id, year=year, month=month, week=w["week"],
            )
        out.week_label = w["label"]
        out.max_ball = wmax
        out.employee_name = current.full_name
        result.append(out)
    return result


@router.get("/weekly/team", response_model=List[schemas.WeeklyTeamRowOut])
def team_weekly_reports(
    year: int,
    month: int,
    db: Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    """Joriy foydalanuvchi tasdiqlay oladigan xodimlarning shu oydagi hisobotlari."""
    targets = _reviewer_targets(current, db)
    if not targets:
        return []

    weeks = get_month_weeks(year, month)
    wmax = weekly_max(year, month)
    target_ids = [t.id for t in targets]

    reports = db.query(models.WeeklyReport).filter(
        models.WeeklyReport.employee_id.in_(target_ids),
        models.WeeklyReport.year == year,
        models.WeeklyReport.month == month,
    ).all()
    reports_by_emp: dict[int, dict[int, models.WeeklyReport]] = {}
    for r in reports:
        reports_by_emp.setdefault(r.employee_id, {})[r.week] = r

    scores = {
        sc.employee_id: sc
        for sc in db.query(models.Score).filter(
            models.Score.employee_id.in_(target_ids),
            models.Score.year == year,
            models.Score.month == month,
        ).all()
    }
    dept_map = {d.id: d for d in db.query(models.Department).all()}

    rows = []
    for emp in targets:
        emp_reports = reports_by_emp.get(emp.id, {})
        week_outs = []
        for w in weeks:
            rep = emp_reports.get(w["week"])
            if rep:
                out = schemas.WeeklyReportOut.model_validate(rep)
            else:
                out = schemas.WeeklyReportOut(id=0, employee_id=emp.id, year=year, month=month, week=w["week"])
            out.week_label = w["label"]
            out.max_ball = wmax
            week_outs.append(out)
        dept = dept_map.get(emp.department_id) if emp.department_id else None
        rows.append(schemas.WeeklyTeamRowOut(
            employee_id=emp.id,
            full_name=emp.full_name,
            position=emp.position,
            department_name=dept.name if dept else None,
            weeks=week_outs,
            bolim_ball=scores.get(emp.id).bolim_ball if emp.id in scores else None,
        ))
    return rows


@router.post("/weekly/{report_id}/score", response_model=schemas.WeeklyReportOut)
def score_weekly_report(
    report_id: int,
    payload: schemas.WeeklyReportScoreIn,
    db: Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    """Tasdiqlovchi haftalik hisobotni ko'rib, ball qo'yib tasdiqlaydi."""
    rep = db.query(models.WeeklyReport).filter(models.WeeklyReport.id == report_id).first()
    if not rep:
        raise HTTPException(status_code=404, detail="Hisobot topilmadi")
    if not rep.file_b64:
        raise HTTPException(status_code=400, detail="Hali fayl yuklanmagan")
    if rep.confirmed_at is not None:
        raise HTTPException(status_code=400, detail="Allaqachon tasdiqlangan")

    target = db.query(models.Employee).filter(models.Employee.id == rep.employee_id).first()
    if not target or not _can_review(current, target):
        raise HTTPException(status_code=403, detail="Ruxsat yo'q")

    wmax = weekly_max(rep.year, rep.month)
    if payload.ball < 0 or payload.ball > wmax:
        raise HTTPException(status_code=422, detail=f"Ball 0–{wmax} oralig'ida bo'lishi kerak")

    rep.ball = payload.ball
    rep.confirmed_at = datetime.utcnow()
    rep.confirmed_by = current.id
    db.flush()

    _sync_bolim_ball(db, rep.employee_id, rep.year, rep.month, current.id)
    db.commit()
    db.refresh(rep)

    out = schemas.WeeklyReportOut.model_validate(rep)
    weeks = _week_info_map(rep.year, rep.month)
    w = weeks.get(rep.week)
    if w:
        out.week_label = w["label"]
    out.max_ball = wmax
    out.employee_name = target.full_name
    return out


@router.get("/weekly/file/{report_id}")
def download_weekly_file(
    report_id: int,
    db: Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    """Haftalik hisobot faylini (base64) qaytaradi — egasi yoki tasdiqlovchisi uchun."""
    rep = db.query(models.WeeklyReport).filter(models.WeeklyReport.id == report_id).first()
    if not rep or not rep.file_b64:
        raise HTTPException(status_code=404, detail="Fayl topilmadi")

    if rep.employee_id != current.id:
        target = db.query(models.Employee).filter(models.Employee.id == rep.employee_id).first()
        if not target or (current.role not in _ADMIN_ROLES and not _can_review(current, target)):
            raise HTTPException(status_code=403, detail="Ruxsat yo'q")

    return {"file_name": rep.file_name, "file_b64": rep.file_b64}
