from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List
from .. import models, schemas
from ..database import get_db
from ..deps import get_current_employee

# Ball berish huquqlari
_FULL_BALL_ROLES = {
    models.RoleEnum.superadmin, models.RoleEnum.direktor, models.RoleEnum.zamdirektor
}

router = APIRouter(prefix="/ball", tags=["Ball"])

MAX_BOLIM = 65


def _is_admin(emp: models.Employee) -> bool:
    return emp.role in {models.RoleEnum.superadmin, models.RoleEnum.direktor, models.RoleEnum.zamdirektor}


@router.get("/month", response_model=List[schemas.ScoreOut])
def get_month_scores(
    year: int,
    month: int,
    department_id: int | None = None,
    db: Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    """Bir oy ballari."""
    if _is_admin(current):
        dept_id = department_id
    else:
        dept_id = current.department_id

    q = db.query(models.Score).filter(
        models.Score.year == year,
        models.Score.month == month,
    )
    if dept_id is not None:
        emp_ids = [e.id for e in
                   db.query(models.Employee.id)
                   .filter(models.Employee.department_id == dept_id).all()]
        q = q.filter(models.Score.employee_id.in_(emp_ids))

    return q.all()


@router.post("/save", response_model=schemas.ScoreOut)
def save_score(
    payload: schemas.ScoreIn,
    db: Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    """Ball berish yoki yangilash (upsert)."""
    existing = (
        db.query(models.Score)
        .filter(
            models.Score.employee_id == payload.employee_id,
            models.Score.year == payload.year,
            models.Score.month == payload.month,
        )
        .first()
    )
    if existing:
        if payload.bolim_ball is not None:
            existing.bolim_ball = payload.bolim_ball
        if payload.kadr_ball is not None:
            existing.kadr_ball = payload.kadr_ball
        if payload.direktor_ball is not None:
            existing.direktor_ball = payload.direktor_ball
        if payload.ijro_ball is not None:
            existing.ijro_ball = payload.ijro_ball
        if payload.comment is not None:
            existing.comment = payload.comment
        existing.created_by = current.id
        db.commit()
        db.refresh(existing)
        return existing
    else:
        score = models.Score(
            employee_id=payload.employee_id,
            year=payload.year,
            month=payload.month,
            bolim_ball=payload.bolim_ball,
            kadr_ball=payload.kadr_ball,
            direktor_ball=payload.direktor_ball,
            ijro_ball=payload.ijro_ball,
            comment=payload.comment,
            created_by=current.id,
        )
        db.add(score)
        db.commit()
        db.refresh(score)
        return score


@router.get("/my-year", response_model=List[schemas.ScoreOut])
def my_year_scores(
    year: int,
    db: Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    """Joriy foydalanuvchining bir yillik ball/hisobotlari."""
    return db.query(models.Score).filter(
        models.Score.employee_id == current.id,
        models.Score.year == year,
    ).order_by(models.Score.month).all()


def _upsert_score(db: Session, emp_id: int, year: int, month: int, creator_id: int) -> models.Score:
    """Score yozuvini topadi yoki yaratadi."""
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


@router.post("/report", response_model=schemas.ScoreOut)
def upload_report(
    payload: schemas.ReportFileIn,
    db: Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    """Hisobot faylini (PDF/doc) xodim uchun yuklash."""
    # Faqat o'zining yoki bo'limidagi xodimning faylini yuklash mumkin
    target = db.query(models.Employee).filter(models.Employee.id == payload.employee_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")

    allowed_roles = {models.RoleEnum.superadmin, models.RoleEnum.direktor, models.RoleEnum.zamdirektor,
                     models.RoleEnum.bolim_boshligi, models.RoleEnum.boshqarma_boshligi}
    is_own = (current.id == payload.employee_id)
    is_manager = (current.role in allowed_roles and target.department_id == current.department_id)

    if not is_own and not is_manager and current.role not in {models.RoleEnum.superadmin}:
        raise HTTPException(status_code=403, detail="Ruxsat yo'q")

    sc = _upsert_score(db, payload.employee_id, payload.year, payload.month, current.id)
    sc.report_file_name = payload.file_name
    sc.report_file_b64  = payload.file_b64
    db.commit()
    db.refresh(sc)
    return sc


@router.get("/report/{employee_id}/{year}/{month}")
def download_report(
    employee_id: int,
    year: int,
    month: int,
    db: Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    """Hisobot faylini (base64) yuklash uchun qaytaradi."""
    sc = db.query(models.Score).filter(
        models.Score.employee_id == employee_id,
        models.Score.year == year,
        models.Score.month == month,
    ).first()
    if not sc or not sc.report_file_b64:
        raise HTTPException(status_code=404, detail="Fayl topilmadi")
    return {"file_name": sc.report_file_name, "file_b64": sc.report_file_b64}


@router.get("/all-month", response_model=List[schemas.EmpScoreRowOut])
def all_month_scores(
    year: int,
    month: int,
    db: Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    """Barcha faol xodimlar + oy bali — kadr/ijro/direktor sahifalari uchun."""
    allowed = _FULL_BALL_ROLES | {models.RoleEnum.kadr, models.RoleEnum.ijro}
    if current.role not in allowed:
        raise HTTPException(status_code=403, detail="Ruxsat yo'q")

    emps = (
        db.query(models.Employee)
        .filter(models.Employee.is_active == True)
        .order_by(models.Employee.department_id, models.Employee.id)
        .all()
    )
    score_map: dict[int, models.Score] = {
        sc.employee_id: sc
        for sc in db.query(models.Score).filter(
            models.Score.year == year,
            models.Score.month == month,
        ).all()
    }
    dept_map: dict[int, models.Department] = {
        d.id: d for d in db.query(models.Department).all()
    }

    rows = []
    for e in emps:
        sc = score_map.get(e.id)
        dept = dept_map.get(e.department_id) if e.department_id else None
        rows.append(schemas.EmpScoreRowOut(
            employee_id=e.id,
            full_name=e.full_name,
            position=e.position,
            role=e.role.value,
            department_id=e.department_id,
            department_name=dept.name if dept else None,
            bolim_ball=sc.bolim_ball if sc else None,
            kadr_ball=sc.kadr_ball if sc else None,
            direktor_ball=sc.direktor_ball if sc else None,
            ijro_ball=sc.ijro_ball if sc else None,
            report_file_name=sc.report_file_name if sc else None,
        ))
    return rows


@router.post("/bulk-save")
def bulk_save_balls(
    payload: schemas.BulkScoreIn,
    db: Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    """Bir oyda barcha xodimlar uchun toplu ball saqlash.
    - kadr roli: faqat kadr_ball
    - ijro roli: faqat ijro_ball
    - direktor/superadmin/zamdirektor: barcha ball turlarini
    """
    allowed = _FULL_BALL_ROLES | {models.RoleEnum.kadr, models.RoleEnum.ijro}
    if current.role not in allowed:
        raise HTTPException(status_code=403, detail="Ruxsat yo'q")

    is_full  = current.role in _FULL_BALL_ROLES
    is_kadr  = current.role == models.RoleEnum.kadr
    is_ijro  = current.role == models.RoleEnum.ijro

    saved = 0
    for item in payload.employees:
        sc = _upsert_score(db, item.employee_id, payload.year, payload.month, current.id)
        if is_full or is_kadr:
            if item.kadr_ball is not None and 0 <= item.kadr_ball <= 25:
                sc.kadr_ball = item.kadr_ball
        if is_full or is_ijro:
            if item.ijro_ball is not None and 0 <= item.ijro_ball <= 10:
                sc.ijro_ball = item.ijro_ball
        if is_full:
            if item.bolim_ball is not None and 0 <= item.bolim_ball <= 65:
                sc.bolim_ball = item.bolim_ball
            if item.direktor_ball is not None and 0 <= item.direktor_ball <= 100:
                sc.direktor_ball = item.direktor_ball
        saved += 1

    db.commit()
    return {"ok": True, "saved": saved}


@router.post("/bolim-ball", response_model=schemas.ScoreOut)
def set_bolim_ball(
    payload: schemas.ScoreIn,
    db: Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    """Bo'lim boshlig'i xodimga bolim_ball beradi (o'ziga bera olmaydi)."""
    allowed = {models.RoleEnum.bolim_boshligi, models.RoleEnum.boshqarma_boshligi,
               models.RoleEnum.superadmin, models.RoleEnum.direktor, models.RoleEnum.zamdirektor,
               models.RoleEnum.kadr, models.RoleEnum.ijro}
    if current.role not in allowed:
        raise HTTPException(status_code=403, detail="Ruxsat yo'q")

    if current.id == payload.employee_id:
        raise HTTPException(status_code=400, detail="O'zingizga ball bera olmaysiz")

    if payload.bolim_ball is None or not (0 <= payload.bolim_ball <= MAX_BOLIM):
        raise HTTPException(status_code=422, detail=f"bolim_ball 0–{MAX_BOLIM} oraliq'da bo'lishi kerak")

    sc = _upsert_score(db, payload.employee_id, payload.year, payload.month, current.id)
    sc.bolim_ball = payload.bolim_ball
    if payload.comment is not None:
        sc.comment = payload.comment
    db.commit()
    db.refresh(sc)
    return sc
