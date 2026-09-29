"""Energoaudit hisobotlari — "Energoaudit va energosamaradorlik ekspertizasi bo'limi"
xodimlari uchun: yangi hisobot yaratish, forma to'ldirish (hisob-kitob avtomatik),
suratlar, docx yuklab olish. Bo'limning barcha xodimlari hamma hisobotlarni
(kim to'ldirgani bilan) ko'radi; tahrirlash — muallif, bo'lim boshlig'i va superadmin."""
import re
from datetime import datetime
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..deps import get_current_employee
from ..energy_audit_docx import DEFAULT_DATA, PHOTO_SLOTS, build_docx, calculate

router = APIRouter(prefix="/energoaudit", tags=["Energoaudit"])

R = models.RoleEnum
_ADMIN = {R.superadmin, R.direktor, R.zamdirektor}
_HEADS = {R.bolim_boshligi, R.boshqarma_boshligi}
MAX_PHOTO_CHARS = 4_000_000   # ~3 MB rasm (frontend 1600 px gacha kichraytirib yuboradi)


def in_audit_dept(emp: models.Employee) -> bool:
    name = (emp.department.name if emp.department else "").lower()
    return "energoaudit" in name or "энергоаудит" in name or "energosamaradorlik" in name


def _require_access(emp: models.Employee) -> None:
    if emp.role not in _ADMIN and not in_audit_dept(emp):
        raise HTTPException(status_code=403, detail="Bu bo'lim faqat Energoaudit bo'limi xodimlari uchun")


def _can_edit(emp: models.Employee, a: models.EnergyAudit) -> bool:
    if emp.role == R.superadmin or a.created_by == emp.id:
        return True
    return emp.role in _HEADS and in_audit_dept(emp)


def _get(db: Session, audit_id: int) -> models.EnergyAudit:
    a = db.get(models.EnergyAudit, audit_id)
    if not a:
        raise HTTPException(status_code=404, detail="Hisobot topilmadi")
    return a


class AuditListItem(BaseModel):
    id: int
    title: str
    bino_nomi: Optional[str] = None
    created_by_name: Optional[str] = None
    updated_by_name: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    photos: int = 0
    can_edit: bool


class AuditOut(AuditListItem):
    data: dict
    photo_data: dict
    calc: dict


class AuditIn(BaseModel):
    title: Optional[str] = None
    data: Optional[dict] = None


class PhotoIn(BaseModel):
    image: Optional[str] = None   # data URL; None — o'chirish


def _item(a: models.EnergyAudit, current) -> dict:
    return dict(
        id=a.id, title=a.title, bino_nomi=(a.data or {}).get("bino_nomi"),
        created_by_name=a.creator.full_name if a.creator else None,
        updated_by_name=a.updater.full_name if a.updater else None,
        created_at=a.created_at, updated_at=a.updated_at,
        photos=sum(1 for v in (a.photos or {}).values() if v),
        can_edit=_can_edit(current, a),
    )


def _full(a: models.EnergyAudit, current) -> AuditOut:
    data = {**DEFAULT_DATA, **(a.data or {})}
    return AuditOut(**_item(a, current), data=data, photo_data=a.photos or {}, calc=calculate(data))


@router.get("/access")
def access(current: models.Employee = Depends(get_current_employee)):
    return {"allowed": current.role in _ADMIN or in_audit_dept(current)}


@router.get("", response_model=List[AuditListItem])
def list_audits(db: Session = Depends(get_db), current: models.Employee = Depends(get_current_employee)):
    _require_access(current)
    rows = db.query(models.EnergyAudit).order_by(models.EnergyAudit.updated_at.desc()).all()
    return [_item(a, current) for a in rows]


@router.post("", response_model=AuditOut)
def create_audit(payload: AuditIn, db: Session = Depends(get_db),
                 current: models.Employee = Depends(get_current_employee)):
    _require_access(current)
    title = (payload.title or "").strip() or f"Energoaudit hisoboti — {datetime.now():%d.%m.%Y}"
    a = models.EnergyAudit(title=title[:300], data={**DEFAULT_DATA, **(payload.data or {})}, photos={},
                           created_by=current.id, updated_by=current.id)
    db.add(a); db.commit(); db.refresh(a)
    return _full(a, current)


@router.get("/{audit_id}", response_model=AuditOut)
def get_audit(audit_id: int, db: Session = Depends(get_db), current: models.Employee = Depends(get_current_employee)):
    _require_access(current)
    return _full(_get(db, audit_id), current)


@router.put("/{audit_id}", response_model=AuditOut)
def update_audit(audit_id: int, payload: AuditIn, db: Session = Depends(get_db),
                 current: models.Employee = Depends(get_current_employee)):
    _require_access(current)
    a = _get(db, audit_id)
    if not _can_edit(current, a):
        raise HTTPException(status_code=403, detail="Bu hisobotni faqat muallif yoki bo'lim boshlig'i tahrirlay oladi")
    if payload.title is not None and payload.title.strip():
        a.title = payload.title.strip()[:300]
    if payload.data is not None:
        a.data = {**DEFAULT_DATA, **payload.data}
    a.updated_by = current.id
    a.updated_at = datetime.utcnow()
    db.commit(); db.refresh(a)
    return _full(a, current)


@router.put("/{audit_id}/photos/{slot}")
def set_photo(audit_id: int, slot: str, payload: PhotoIn, db: Session = Depends(get_db),
              current: models.Employee = Depends(get_current_employee)):
    _require_access(current)
    a = _get(db, audit_id)
    if not _can_edit(current, a):
        raise HTTPException(status_code=403, detail="Tahrirlashga ruxsat yo'q")
    if slot not in PHOTO_SLOTS:
        raise HTTPException(status_code=400, detail="Noto'g'ri surat joyi")
    if payload.image and (len(payload.image) > MAX_PHOTO_CHARS or not re.match(r"^data:image/(jpeg|png);base64,", payload.image)):
        raise HTTPException(status_code=400, detail="Surat JPG/PNG bo'lishi va 3 MB dan oshmasligi kerak")
    photos = dict(a.photos or {})
    if payload.image:
        photos[slot] = payload.image
    else:
        photos.pop(slot, None)
    a.photos = photos
    a.updated_by = current.id
    a.updated_at = datetime.utcnow()
    db.commit()
    return {"ok": True}


@router.post("/calc")
def calc_preview(payload: AuditIn, current: models.Employee = Depends(get_current_employee)):
    """Forma o'zgarganda jonli hisob-kitob (saqlamasdan)."""
    _require_access(current)
    return calculate({**DEFAULT_DATA, **(payload.data or {})})


@router.get("/{audit_id}/docx")
def download_docx(audit_id: int, db: Session = Depends(get_db), current: models.Employee = Depends(get_current_employee)):
    _require_access(current)
    a = _get(db, audit_id)
    content = build_docx(a.data or {}, a.photos or {})
    safe = re.sub(r"[^\w\-]+", "_", a.title, flags=re.UNICODE).strip("_")[:80] or f"energoaudit_{a.id}"
    from urllib.parse import quote
    return Response(
        content, media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f"attachment; filename=\"energoaudit_{a.id}.docx\"; filename*=UTF-8''{quote(safe)}.docx"},
    )


@router.delete("/{audit_id}")
def delete_audit(audit_id: int, db: Session = Depends(get_db), current: models.Employee = Depends(get_current_employee)):
    _require_access(current)
    a = _get(db, audit_id)
    if not _can_edit(current, a):
        raise HTTPException(status_code=403, detail="O'chirishga ruxsat yo'q")
    db.delete(a); db.commit()
    return {"ok": True}
