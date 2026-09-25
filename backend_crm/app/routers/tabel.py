import io
from calendar import monthrange
from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter
from .. import models, schemas
from ..database import get_db
from ..deps import get_current_employee
from .attendance import TZ_UZ, WORK_START_HOUR, WORK_START_MIN, excused_days
from .holidays import month_holidays
from ..status_periods import status_code_map

router = APIRouter(prefix="/tabel", tags=["Tabel"])


def _is_admin(emp: models.Employee) -> bool:
    return emp.role in {models.RoleEnum.superadmin, models.RoleEnum.direktor, models.RoleEnum.zamdirektor}


@router.get("/month", response_model=List[schemas.TabelMonthRecord])
def get_month_tabel(
    year: int,
    month: int,
    department_id: int | None = None,
    db: Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    """
    Bir oylik tabelni qaytaradi.
    - superadmin/direktor/zamdirektor: istalgan bo'lim yoki hamma
    - bolim_boshligi/boshqarma_boshligi: faqat o'z bo'limi
    """
    if _is_admin(current):
        dept_id = department_id  # admin may specify any dept
    else:
        dept_id = current.department_id  # restricted to own dept

    # Xodimlar ro'yxati
    q = db.query(models.Employee).filter(models.Employee.is_active == True)
    if dept_id is not None:
        q = q.filter(models.Employee.department_id == dept_id)
    employees = q.order_by(models.Employee.id).all()

    # Mavjud yozuvlar
    emp_ids = [e.id for e in employees]
    records = (
        db.query(models.TabelRecord)
        .filter(
            models.TabelRecord.employee_id.in_(emp_ids),
            models.TabelRecord.year == year,
            models.TabelRecord.month == month,
        )
        .all()
    )
    # {emp_id: {day: code}}
    rec_map: dict[int, dict[int, str]] = {}
    for r in records:
        rec_map.setdefault(r.employee_id, {})[r.day] = r.code

    result = []
    for emp in employees:
        result.append(schemas.TabelMonthRecord(
            employee_id=emp.id,
            full_name=emp.full_name,
            position=emp.position,
            work_rate=emp.work_rate,
            days=rec_map.get(emp.id, {}),
        ))
    return result


@router.post("/save", response_model=dict)
def save_tabel(
    payload: schemas.TabelBatchIn,
    db: Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    """Ko'p kunni bir vaqtda saqlash (upsert)."""
    for rec in payload.records:
        existing = (
            db.query(models.TabelRecord)
            .filter(
                models.TabelRecord.employee_id == rec.employee_id,
                models.TabelRecord.year == rec.year,
                models.TabelRecord.month == rec.month,
                models.TabelRecord.day == rec.day,
            )
            .first()
        )
        if existing:
            existing.code = rec.code
            existing.created_by = current.id
        else:
            db.add(models.TabelRecord(
                employee_id=rec.employee_id,
                year=rec.year,
                month=rec.month,
                day=rec.day,
                code=rec.code,
                created_by=current.id,
            ))
    db.commit()
    return {"saved": len(payload.records)}


_AUTO_TABEL_EXCLUDED_ROLES = {
    models.RoleEnum.superadmin, models.RoleEnum.direktor, models.RoleEnum.zamdirektor,
}
_AUTO_TABEL_EXCLUDED_STATUSES = {
    models.EmployeeStatusEnum.shafyor_farrosh, models.EmployeeStatusEnum.dekret,
}
STANDARD_WORKDAY_MIN = 8 * 60
LATE_WARN_MIN = 10
HOLIDAY_CODE = "BY"  # bayram kuni (kadr kalendarida belgilangan)   # shu daqiqagacha kechikish — sariq, undan ko'pi — qizil


def _fmt_hm(total_min: int) -> str:
    h, m = divmod(max(0, total_min), 60)
    return f"{h} soat {m} daqiqa" if m else f"{h} soat"


def _notes_by_day(db: Session, emp_ids: list[int], date_from: str, date_to: str) -> dict[tuple[int, str], dict]:
    """(employee_id, "YYYY-MM-DD") -> shu kunni qamragan eng oxirgi ariza (izoh)."""
    if not emp_ids:
        return {}
    notes = (
        db.query(models.AttendanceNote)
        .filter(
            models.AttendanceNote.employee_id.in_(emp_ids),
            models.AttendanceNote.date_from <= date_to,
            models.AttendanceNote.date_to >= date_from,
        )
        .order_by(models.AttendanceNote.created_at.asc())
        .all()
    )
    result: dict[tuple[int, str], dict] = {}
    for n in notes:
        info = {"type": n.note_type, "text": n.text, "status": n.review_status}
        d = datetime.strptime(max(n.date_from, date_from), "%Y-%m-%d").date()
        end = datetime.strptime(min(n.date_to, date_to), "%Y-%m-%d").date()
        while d <= end:
            result[(n.employee_id, d.isoformat())] = info   # keyingisi ustiga yoziladi
            d += timedelta(days=1)
    return result


def _auto_day(emp, d: date, day: int, holidays, last_day_to_count, status_codes, att, excused, notes):
    """Bitta kun uchun avtomatik hisob: (kod, ishlagan, sababsiz kechikish,
    sababli kechikish, day_info) — daqiqalarda."""
    if d.weekday() >= 5:
        return "X", 0, 0, 0, None
    if day in holidays:
        return HOLIDAY_CODE, 0, 0, 0, None
    if day > last_day_to_count:
        return "", 0, 0, 0, None
    status_code = status_codes.get((emp.id, d.isoformat()))
    if status_code:
        return status_code, 0, 0, 0, None
    if att is None:
        return "", 0, 0, 0, None

    ci_local = att.check_in.astimezone(TZ_UZ) if att.check_in.tzinfo is not None else att.check_in
    work_start = ci_local.replace(hour=WORK_START_HOUR, minute=WORK_START_MIN, second=0, microsecond=0)
    late = min(STANDARD_WORKDAY_MIN, max(0, int(round((ci_local - work_start).total_seconds() / 60.0))))
    is_excused = late > 0 and (emp.id, d.isoformat()) in excused
    info = {
        "check_in": ci_local.strftime("%H:%M"),
        "late_min": late,
        "excused": is_excused,
        "note": notes.get((emp.id, d.isoformat())),
    }
    # Sababsiz kechikish ish vaqtidan ayiriladi; kadr arizani tasdiqlasa —
    # kechikkan vaqt qo'shib beriladi (to'liq 8 soat). Katakda har doim "8".
    if is_excused:
        return "8", STANDARD_WORKDAY_MIN, 0, late, info
    return "8", STANDARD_WORKDAY_MIN - late, late, 0, info


def _build_auto_tabel(db: Session, year: int, month: int) -> schemas.AutoTabelOut:
    days_in_month = monthrange(year, month)[1]
    today = datetime.now(TZ_UZ).date()
    last_day_to_count = today.day if (year, month) == (today.year, today.month) else days_in_month
    holidays = month_holidays(db, year, month)
    working_days = sum(
        1 for d in range(1, days_in_month + 1)
        if date(year, month, d).weekday() < 5 and d not in holidays
    )

    depts = db.query(models.Department).all()
    dept_order = {d.id: d.order_num for d in depts}
    dept_map = {d.id: d.name for d in depts}

    employees = (
        db.query(models.Employee)
        .filter(
            models.Employee.role.notin_(_AUTO_TABEL_EXCLUDED_ROLES),
            models.Employee.status.notin_(_AUTO_TABEL_EXCLUDED_STATUSES),
        )
        .all()
    )
    employees.sort(key=lambda e: (dept_order.get(e.department_id, 9999), e.full_name))
    emp_ids = [e.id for e in employees]

    month_prefix = f"{year:04d}-{month:02d}-"
    attendances = db.query(models.Attendance).filter(
        models.Attendance.employee_id.in_(emp_ids),
        models.Attendance.date >= f"{month_prefix}01",
        models.Attendance.date <= f"{month_prefix}{days_in_month:02d}",
    ).all()
    att_by_emp_day: dict[int, dict] = {}
    for a in attendances:
        att_by_emp_day.setdefault(a.employee_id, {})[int(a.date[-2:])] = a
    excused = excused_days(db, emp_ids, f"{month_prefix}01", f"{month_prefix}{days_in_month:02d}")
    # Mehnat ta'tili/bolnichniy/safar — tarixdan (muddat tugagan bo'lsa ham saqlanadi)
    status_codes = status_code_map(db, employees, f"{month_prefix}01", f"{month_prefix}{days_in_month:02d}")
    notes = _notes_by_day(db, emp_ids, f"{month_prefix}01", f"{month_prefix}{days_in_month:02d}")
    overrides: dict[int, dict[str, str]] = {}
    for o in db.query(models.TabelOverride).filter(
        models.TabelOverride.employee_id.in_(emp_ids),
        models.TabelOverride.date >= f"{month_prefix}01",
        models.TabelOverride.date <= f"{month_prefix}{days_in_month:02d}",
    ).all():
        overrides.setdefault(o.employee_id, {})[str(int(o.date[-2:]))] = o.code

    rows = []
    for emp in employees:
        emp_days = att_by_emp_day.get(emp.id, {})
        cells: dict[str, str] = {}
        day_info: dict[str, dict] = {}
        worked_min = 0
        late_min = 0
        excused_min = 0
        auto_cells: dict[str, str] = {}
        emp_overrides = overrides.get(emp.id, {})
        for day in range(1, days_in_month + 1):
            d = date(year, month, day)
            key = str(day)
            code, worked, late, exc, info = _auto_day(
                emp, d, day, holidays, last_day_to_count, status_codes, emp_days.get(day), excused, notes,
            )
            auto_cells[key] = code
            # Kadr qo'lda tuzatgan kun — avtomatik hisob o'rniga shu kod
            if key in emp_overrides:
                code = emp_overrides[key]
                late = exc = 0
                worked = STANDARD_WORKDAY_MIN if code == "8" else 0
                if code == "8":
                    info = {
                        "check_in": info["check_in"] if info else None,
                        "late_min": 0, "excused": False,
                        "note": info["note"] if info else notes.get((emp.id, d.isoformat())),
                        "override": True,
                    }
                else:
                    info = None
            cells[key] = code
            if info:
                day_info[key] = info
            worked_min += worked
            late_min += late
            excused_min += exc

        rows.append(schemas.AutoTabelRow(
            employee_id=emp.id,
            full_name=emp.full_name,
            department_id=emp.department_id,
            department_name=dept_map.get(emp.department_id),
            cells=cells,
            day_info=day_info,
            auto_cells=auto_cells,
            overridden=sorted(int(k) for k in emp_overrides),
            worked_min=worked_min,
            late_min=late_min,
            excused_min=excused_min,
        ))

    return schemas.AutoTabelOut(
        days_in_month=days_in_month,
        working_days=working_days,
        rows=rows,
        holidays={str(k): v for k, v in holidays.items()},
    )


_AUTO_TABEL_VIEW_ROLES = {
    models.RoleEnum.kadr, models.RoleEnum.superadmin,
    models.RoleEnum.direktor, models.RoleEnum.zamdirektor,
}


@router.get("/auto", response_model=schemas.AutoTabelOut)
def get_auto_tabel(
    year: int,
    month: int,
    db: Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    """Attendance (GPS) va Employee.status asosida avtomatik hisoblangan oylik
    davomat jadvali — kadr/superadmin/direktor/zamdirektor uchun. Direktor,
    zamdirektor va texnik xodimlar (shafyor/farrosh) ro'yxatga kirmaydi.
    Kod: "8" (kelgan), "X" (dam olish kuni), "MT" (mehnat ta'tili), "O'" (o'quv
    ta'tili), "K" (xizmat safari), "B" (bolnichniy), "Д" (dekret), "" (bo'sh)."""
    if current.role not in _AUTO_TABEL_VIEW_ROLES:
        raise HTTPException(status_code=403, detail="Ruxsat yo'q")
    return _build_auto_tabel(db, year, month)


_OVERRIDE_CODES = {"8", "MT", "O'", "K", "B", "Д", "X", HOLIDAY_CODE, ""}
_OVERRIDE_EDIT_ROLES = {models.RoleEnum.kadr, models.RoleEnum.superadmin}


@router.put("/auto/overrides")
def save_tabel_overrides(
    data: schemas.TabelOverrideIn,
    db: Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    """Kadr bitta xodimning kunlarini qo'lda tuzatadi. changes: {kun: kod};
    kod null — tuzatishni olib tashlash (kun yana avtomatik hisoblanadi)."""
    if current.role not in _OVERRIDE_EDIT_ROLES:
        raise HTTPException(status_code=403, detail="Ruxsat yo'q")
    if not db.query(models.Employee.id).filter(models.Employee.id == data.employee_id).first():
        raise HTTPException(status_code=404, detail="Xodim topilmadi")
    days_in_month = monthrange(data.year, data.month)[1]

    existing = {
        o.date: o for o in db.query(models.TabelOverride).filter(
            models.TabelOverride.employee_id == data.employee_id,
            models.TabelOverride.date >= f"{data.year:04d}-{data.month:02d}-01",
            models.TabelOverride.date <= f"{data.year:04d}-{data.month:02d}-{days_in_month:02d}",
        ).all()
    }
    for day_s, code in data.changes.items():
        try:
            day = int(day_s)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Noto'g'ri kun: {day_s}")
        if not 1 <= day <= days_in_month:
            raise HTTPException(status_code=400, detail=f"Noto'g'ri kun: {day}")
        if code is not None and code not in _OVERRIDE_CODES:
            raise HTTPException(status_code=400, detail=f"Noto'g'ri kod: {code}")
        key = f"{data.year:04d}-{data.month:02d}-{day:02d}"
        o = existing.get(key)
        if code is None:
            if o:
                db.delete(o)
        elif o:
            o.code = code
            o.updated_by = current.id
        else:
            db.add(models.TabelOverride(employee_id=data.employee_id, date=key, code=code, updated_by=current.id))
    db.commit()
    return {"ok": True}


@router.get("/auto-xlsx")
def auto_tabel_xlsx(
    year: int,
    month: int,
    db: Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    """Xodimlar davomati jadvalini .xlsx fayl sifatida yuklab beradi."""
    if current.role not in _AUTO_TABEL_VIEW_ROLES:
        raise HTTPException(status_code=403, detail="Ruxsat yo'q")
    data = _build_auto_tabel(db, year, month)
    required_min = data.working_days * STANDARD_WORKDAY_MIN

    wb = Workbook()
    ws = wb.active
    ws.title = f"{month:02d}.{year}"[:31]

    header = ["Ism familiyasi"] + [str(d) for d in range(1, data.days_in_month + 1)] + ["Jami ish soati", "Kechikkan vaqti"]
    ws.append(header)
    for c in ws[1]:
        c.font = Font(bold=True)
        c.alignment = Alignment(horizontal="center")

    fills = {
        "8":  PatternFill("solid", fgColor="FFE3F7EC"),
        "X":  PatternFill("solid", fgColor="FFF4F9FD"),
        "MT": PatternFill("solid", fgColor="FFFFF3CD"),
        "O'": PatternFill("solid", fgColor="FFEDE9FB"),
        "K":  PatternFill("solid", fgColor="FFE3EEFF"),
        "B":  PatternFill("solid", fgColor="FFFDE2E2"),
        "Д":  PatternFill("solid", fgColor="FFF0F0F0"),
        HOLIDAY_CODE: PatternFill("solid", fgColor="FFFCE4EC"),
    }
    late_fill = PatternFill("solid", fgColor="FFFFF3CD")       # 10 daqiqagacha kechikkan
    very_late_fill = PatternFill("solid", fgColor="FFFDE2E2")  # 10 daqiqadan ko'p kechikkan

    for row in data.rows:
        ws.append(
            [row.full_name] + [row.cells.get(str(d), "") for d in range(1, data.days_in_month + 1)]
            + [f"{_fmt_hm(row.worked_min)}/{_fmt_hm(required_min)}", _fmt_hm(row.late_min)]
        )

    for ri, row in enumerate(data.rows, start=2):
        for d in range(1, data.days_in_month + 1):
            code = row.cells.get(str(d), "")
            if not code:
                continue
            cell = ws.cell(row=ri, column=1 + d)
            cell.alignment = Alignment(horizontal="center")
            fill = fills.get(code)
            info = row.day_info.get(str(d))
            if info and info["late_min"] > 0 and not info["excused"]:
                fill = late_fill if info["late_min"] <= LATE_WARN_MIN else very_late_fill
            if fill:
                cell.fill = fill
        for extra_col in (2 + data.days_in_month, 3 + data.days_in_month):
            ws.cell(row=ri, column=extra_col).alignment = Alignment(horizontal="center")
            ws.cell(row=ri, column=extra_col).font = Font(bold=True)

    ws.column_dimensions["A"].width = 26
    for i in range(data.days_in_month):
        ws.column_dimensions[get_column_letter(2 + i)].width = 6
    ws.column_dimensions[get_column_letter(2 + data.days_in_month)].width = 16
    ws.column_dimensions[get_column_letter(3 + data.days_in_month)].width = 16
    ws.freeze_panes = "B2"

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    filename = f"xodimlar_davomati_{year}_{month:02d}.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.delete("/clear")
def clear_month(
    year: int,
    month: int,
    department_id: int,
    db: Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    """Bo'lim xodimlari uchun bir oyni tozalash."""
    emp_ids = [
        e.id for e in db.query(models.Employee.id)
        .filter(models.Employee.department_id == department_id)
        .all()
    ]
    deleted = (
        db.query(models.TabelRecord)
        .filter(
            models.TabelRecord.employee_id.in_(emp_ids),
            models.TabelRecord.year == year,
            models.TabelRecord.month == month,
        )
        .delete(synchronize_session=False)
    )
    db.commit()
    return {"deleted": deleted}
