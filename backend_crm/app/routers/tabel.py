from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from .. import models, schemas
from ..database import get_db
from ..deps import get_current_employee

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
