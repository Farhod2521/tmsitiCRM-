from calendar import monthrange
from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from .. import models, schemas
from ..database import get_db
from ..deps import get_current_employee

router = APIRouter(prefix="/holidays", tags=["Bayram kunlari"])

_EDIT_ROLES = {models.RoleEnum.kadr, models.RoleEnum.superadmin}


def holiday_map(db: Session, date_from: str, date_to: str) -> dict[str, str]:
    """{"YYYY-MM-DD": bayram nomi} — berilgan oraliqdagi bayram kunlari.
    Tabel, davomat hisobi va telegram eslatmasi shu funksiyadan foydalanadi."""
    rows = (
        db.query(models.Holiday)
        .filter(models.Holiday.date >= date_from, models.Holiday.date <= date_to)
        .all()
    )
    return {h.date: h.name for h in rows}


def month_holidays(db: Session, year: int, month: int) -> dict[int, str]:
    """{kun: bayram nomi} — bir oy uchun."""
    prefix = f"{year:04d}-{month:02d}-"
    days = monthrange(year, month)[1]
    return {int(k[-2:]): v for k, v in holiday_map(db, f"{prefix}01", f"{prefix}{days:02d}").items()}


def is_holiday(db: Session, day: str) -> bool:
    return db.query(models.Holiday.id).filter(models.Holiday.date == day).first() is not None


def _parse(s: str) -> date:
    try:
        return datetime.strptime(s, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Sana formati noto'g'ri (YYYY-MM-DD)")


@router.get("", response_model=List[schemas.HolidayOut])
def list_holidays(
    year:  int,
    month: Optional[int] = None,
    db:    Session = Depends(get_db),
    _:     models.Employee = Depends(get_current_employee),
):
    """Bayram kunlari — butun yil yoki bitta oy uchun. Barcha xodimlar ko'ra oladi
    (veb/mobil kalendar va davomat tahlili uchun)."""
    if month:
        prefix = f"{year:04d}-{month:02d}-"
        start, end = f"{prefix}01", f"{prefix}{monthrange(year, month)[1]:02d}"
    else:
        start, end = f"{year:04d}-01-01", f"{year:04d}-12-31"
    return (
        db.query(models.Holiday)
        .filter(models.Holiday.date >= start, models.Holiday.date <= end)
        .order_by(models.Holiday.date)
        .all()
    )


@router.post("", response_model=List[schemas.HolidayOut])
def create_holidays(
    data:    schemas.HolidayIn,
    db:      Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    """Bir kun yoki sanalar oralig'ini bayram deb belgilash (faqat kadr/superadmin).
    Allaqachon belgilangan kun bo'lsa — nomi yangilanadi."""
    if current.role not in _EDIT_ROLES:
        raise HTTPException(status_code=403, detail="Ruxsat yo'q")
    name = data.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Bayram nomini kiriting")
    start = _parse(data.date_from)
    end = _parse(data.date_to) if data.date_to else start
    if end < start:
        raise HTTPException(status_code=400, detail="Tugash sanasi boshlanish sanasidan oldin bo'lishi mumkin emas")
    if (end - start).days > 31:
        raise HTTPException(status_code=400, detail="Bir martada ko'pi bilan 31 kun belgilash mumkin")

    existing = {
        h.date: h
        for h in db.query(models.Holiday)
        .filter(models.Holiday.date >= start.isoformat(), models.Holiday.date <= end.isoformat())
        .all()
    }
    result = []
    d = start
    while d <= end:
        key = d.isoformat()
        h = existing.get(key)
        if h:
            h.name = name
        else:
            h = models.Holiday(date=key, name=name, created_by=current.id)
            db.add(h)
        result.append(h)
        d += timedelta(days=1)
    db.commit()
    for h in result:
        db.refresh(h)
    return result


@router.delete("/{holiday_id}")
def delete_holiday(
    holiday_id: int,
    db:         Session = Depends(get_db),
    current:    models.Employee = Depends(get_current_employee),
):
    if current.role not in _EDIT_ROLES:
        raise HTTPException(status_code=403, detail="Ruxsat yo'q")
    h = db.query(models.Holiday).filter(models.Holiday.id == holiday_id).first()
    if not h:
        raise HTTPException(status_code=404, detail="Topilmadi")
    db.delete(h)
    db.commit()
    return {"ok": True}
