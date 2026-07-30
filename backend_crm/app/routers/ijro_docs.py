"""Ijro nazorati hujjatlari va topshiriqlari."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
import json
from datetime import datetime
from ..database import get_db
from ..deps import get_current_employee
from .. import models, schemas

router = APIRouter(prefix="/ijro-docs", tags=["Ijro Documents"])

_ALLOWED = {
    models.RoleEnum.ijro,
    models.RoleEnum.superadmin,
    models.RoleEnum.direktor,
    models.RoleEnum.zamdirektor,
}

_BOLIM_ROLES = {
    models.RoleEnum.bolim_boshligi,
    models.RoleEnum.boshqarma_boshligi,
}

_ADMIN_ROLES = {
    models.RoleEnum.superadmin,
    models.RoleEnum.direktor,
    models.RoleEnum.zamdirektor,
}

def _require_ijro(current: models.Employee = Depends(get_current_employee)) -> models.Employee:
    if current.role not in _ALLOWED:
        raise HTTPException(status_code=403, detail="Ruxsat yo'q")
    return current

def _require_bolim(current: models.Employee = Depends(get_current_employee)) -> models.Employee:
    if current.role not in (_BOLIM_ROLES | _ADMIN_ROLES | _ALLOWED):
        raise HTTPException(status_code=403, detail="Ruxsat yo'q")
    return current


def _fill_doc_out(item: schemas.IjroDocOut, doc: models.IjroDocument, db: Session) -> schemas.IjroDocOut:
    """Hujjat chiqish sxemasiga qo'shimcha nomlarni to'ldiradi."""
    if doc.masul_orinbosar:
        item.masul_orinbosar_nomi = doc.masul_orinbosar.full_name
    if doc.masul_bolimlar:
        try:
            ids = json.loads(doc.masul_bolimlar)
            depts = db.query(models.Department).filter(models.Department.id.in_(ids)).all()
            dept_map = {d.id: d.name for d in depts}
            # holat map from bolim_assignments
            holat_map: dict[int, str] = {
                ab.bolim_id: ab.holati.value
                for ab in doc.bolim_assignments
            }
            item.masul_bolimlar_nomi = ", ".join(dept_map.get(i, str(i)) for i in ids)
            item.masul_bolimlar_info = json.dumps([
                {"id": i, "name": dept_map.get(i, str(i)), "holati": holat_map.get(i, "yuborildi")}
                for i in ids
            ])
            # Rad etilmagan (hozir faol) bo'lim(lar)ning boshlig'i F.I.Sh.
            active_ids = [i for i in ids if holat_map.get(i, "yuborildi") != "rad_etildi"]
            if active_ids:
                boshliqlar = db.query(models.Employee).filter(
                    models.Employee.department_id.in_(active_ids),
                    models.Employee.role.in_([models.RoleEnum.bolim_boshligi, models.RoleEnum.boshqarma_boshligi]),
                ).all()
                if boshliqlar:
                    item.masul_bolim_boshliqlari_nomi = ", ".join(b.full_name for b in boshliqlar)
        except (json.JSONDecodeError, TypeError):
            pass
    return item

def _make_bolim_out(ab: models.IjroDocBolim) -> schemas.IjroDocBolimOut:
    out = schemas.IjroDocBolimOut.model_validate(ab)
    out.bolim_nomi = ab.bolim.name if ab.bolim else None
    out.qaror_by_nomi = ab.qaror_beruvchi.full_name if ab.qaror_beruvchi else None
    if ab.document:
        out.doc_id            = ab.document.id
        out.doc_sarlavha      = ab.document.sarlavha
        out.doc_manba         = ab.document.manba.value if ab.document.manba else None
        out.doc_hujjat_raqami = ab.document.hujjat_raqami
        out.doc_ijro_muddati  = ab.document.ijro_muddati
    return out


@router.get("/", response_model=List[schemas.IjroDocOut])
def list_docs(
    tur:    Optional[str] = None,
    manba:  Optional[str] = None,
    holati: Optional[str] = None,
    db:     Session = Depends(get_db),
    _:      models.Employee = Depends(_require_ijro),
):
    q = db.query(models.IjroDocument)
    if tur:    q = q.filter(models.IjroDocument.tur    == tur)
    if manba:  q = q.filter(models.IjroDocument.manba  == manba)
    if holati: q = q.filter(models.IjroDocument.holati == holati)
    docs = q.order_by(models.IjroDocument.created_at.desc()).all()
    return [_fill_doc_out(schemas.IjroDocOut.model_validate(d), d, db) for d in docs]


@router.post("/", response_model=schemas.IjroDocOut, status_code=201)
def create_doc(
    data:    schemas.IjroDocIn,
    db:      Session = Depends(get_db),
    current: models.Employee = Depends(_require_ijro),
):
    doc = models.IjroDocument(**data.model_dump(), created_by=current.id)
    db.add(doc)
    db.flush()   # get doc.id before commit

    # Auto-create IjroDocBolim rows for each selected department
    if data.masul_bolimlar:
        try:
            bolim_ids = json.loads(data.masul_bolimlar)
            for bid in bolim_ids:
                ab = models.IjroDocBolim(doc_id=doc.id, bolim_id=bid)
                db.add(ab)
        except (json.JSONDecodeError, TypeError):
            pass

    db.commit()
    db.refresh(doc)
    return _fill_doc_out(schemas.IjroDocOut.model_validate(doc), doc, db)


# ─── Bolim inbox (specific routes BEFORE /{doc_id} to avoid Starlette conflict) ─

@router.get("/bolim-inbox", response_model=List[schemas.IjroDocBolimOut])
def bolim_inbox(
    holati:  Optional[str] = None,
    db:      Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    """Bo'lim boshlig'i o'z bo'limiga yuborilgan hujjatlarni ko'radi."""
    if current.role not in (_BOLIM_ROLES | _ADMIN_ROLES | _ALLOWED):
        raise HTTPException(status_code=403, detail="Ruxsat yo'q")

    q = db.query(models.IjroDocBolim)
    if current.role in _BOLIM_ROLES:
        if not current.department_id:
            return []
        q = q.filter(models.IjroDocBolim.bolim_id == current.department_id)
    # admin/ijro sees all
    if holati:
        q = q.filter(models.IjroDocBolim.holati == holati)
    rows = q.order_by(models.IjroDocBolim.assigned_at.desc()).all()
    return [_make_bolim_out(r) for r in rows]


@router.get("/bolim-inbox/{doc_bolim_id}/detail", response_model=schemas.IjroDocTracking)
def bolim_doc_detail(
    doc_bolim_id: int,
    db:      Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    """Hujjatning to'liq tafsilotlari: doc + barcha bolim holatlari."""
    if current.role not in (_BOLIM_ROLES | _ADMIN_ROLES | _ALLOWED):
        raise HTTPException(status_code=403, detail="Ruxsat yo'q")
    ab = db.query(models.IjroDocBolim).filter(models.IjroDocBolim.id == doc_bolim_id).first()
    if not ab:
        raise HTTPException(status_code=404, detail="Topilmadi")
    doc = ab.document
    doc_out = schemas.IjroDocOut.model_validate(doc)
    if doc.masul_orinbosar:
        doc_out.masul_orinbosar_nomi = doc.masul_orinbosar.full_name
    bolimlar = [_make_bolim_out(b) for b in doc.bolim_assignments]
    return schemas.IjroDocTracking(doc=doc_out, bolimlar=bolimlar)


@router.post("/bolim-inbox/{doc_bolim_id}/qaror", response_model=schemas.IjroDocBolimOut)
def bolim_qaror(
    doc_bolim_id: int,
    data:    schemas.IjroDocBolimQaror,
    db:      Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    """Qabul qilish yoki rad etish."""
    if current.role not in (_BOLIM_ROLES | _ADMIN_ROLES | _ALLOWED):
        raise HTTPException(status_code=403, detail="Ruxsat yo'q")
    ab = db.query(models.IjroDocBolim).filter(models.IjroDocBolim.id == doc_bolim_id).first()
    if not ab:
        raise HTTPException(status_code=404, detail="Topilmadi")
    if current.role in _BOLIM_ROLES and ab.bolim_id != current.department_id:
        raise HTTPException(status_code=403, detail="Bu sizning bo'limingiz emas")
    ab.holati   = data.holati
    ab.izoh     = data.izoh
    ab.qaror_at = datetime.utcnow()
    ab.qaror_by = current.id
    db.commit()
    db.refresh(ab)
    return _make_bolim_out(ab)


# ─── Parameterized routes (after specific ones) ───────────────────────────────

@router.get("/{doc_id}", response_model=schemas.IjroDocOut)
def get_doc(
    doc_id: int,
    db:     Session = Depends(get_db),
    _:      models.Employee = Depends(_require_ijro),
):
    doc = db.query(models.IjroDocument).filter(models.IjroDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Topilmadi")
    return _fill_doc_out(schemas.IjroDocOut.model_validate(doc), doc, db)


@router.patch("/{doc_id}/status", response_model=schemas.IjroDocOut)
def update_status(
    doc_id: int,
    data:   schemas.IjroDocStatusIn,
    db:     Session = Depends(get_db),
    _:      models.Employee = Depends(_require_ijro),
):
    doc = db.query(models.IjroDocument).filter(models.IjroDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Topilmadi")
    doc.holati = data.holati
    if data.qayta_sabab:
        doc.qayta_sabab = data.qayta_sabab
    db.commit()
    db.refresh(doc)
    return _fill_doc_out(schemas.IjroDocOut.model_validate(doc), doc, db)


@router.patch("/{doc_id}", response_model=schemas.IjroDocOut)
def update_doc(
    doc_id: int,
    data:   schemas.IjroDocUpdate,
    db:     Session = Depends(get_db),
    _:      models.Employee = Depends(_require_ijro),
):
    doc = db.query(models.IjroDocument).filter(models.IjroDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Topilmadi")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(doc, field, value)
    db.commit()
    db.refresh(doc)
    return _fill_doc_out(schemas.IjroDocOut.model_validate(doc), doc, db)


@router.delete("/{doc_id}", status_code=204)
def delete_doc(
    doc_id:  int,
    db:      Session = Depends(get_db),
    current: models.Employee = Depends(_require_ijro),
):
    doc = db.query(models.IjroDocument).filter(models.IjroDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Topilmadi")
    db.delete(doc)
    db.commit()


@router.get("/{doc_id}/tracking", response_model=schemas.IjroDocTracking)
def doc_tracking(
    doc_id: int,
    db:     Session = Depends(get_db),
    _:      models.Employee = Depends(_require_bolim),
):
    """Hujjat bo'yicha to'liq monitoring: qaysi bo'lim, qanday holat."""
    doc = db.query(models.IjroDocument).filter(models.IjroDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Topilmadi")
    doc_out = schemas.IjroDocOut.model_validate(doc)
    if doc.masul_orinbosar:
        doc_out.masul_orinbosar_nomi = doc.masul_orinbosar.full_name
    bolimlar = [_make_bolim_out(b) for b in doc.bolim_assignments]
    return schemas.IjroDocTracking(doc=doc_out, bolimlar=bolimlar)


@router.post("/{doc_id}/add-bolim", response_model=schemas.IjroDocTracking)
def add_bolim(
    doc_id: int,
    data:   schemas.BolimAddIn,
    db:     Session = Depends(get_db),
    _:      models.Employee = Depends(_require_ijro),
):
    """Hujjatga yangi bo'lim biriktirish yoki rad etilgan bo'limni qayta yuborish."""
    doc = db.query(models.IjroDocument).filter(models.IjroDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Topilmadi")

    # Check bolim exists
    bolim = db.query(models.Department).filter(models.Department.id == data.bolim_id).first()
    if not bolim:
        raise HTTPException(status_code=404, detail="Bo'lim topilmadi")

    existing_ab = db.query(models.IjroDocBolim).filter(
        models.IjroDocBolim.doc_id == doc_id,
        models.IjroDocBolim.bolim_id == data.bolim_id,
    ).first()

    if existing_ab:
        # Reset status — qayta yuborish
        existing_ab.holati     = models.IjroDocBolimHolati.yuborildi
        existing_ab.izoh       = None
        existing_ab.qaror_at   = None
        existing_ab.qaror_by   = None
        existing_ab.assigned_at = datetime.utcnow()
    else:
        db.add(models.IjroDocBolim(doc_id=doc_id, bolim_id=data.bolim_id))
        # masul_bolimlar JSON ga ham qo'shamiz
        try:
            ids = json.loads(doc.masul_bolimlar or "[]")
            if data.bolim_id not in ids:
                ids.append(data.bolim_id)
                doc.masul_bolimlar = json.dumps(ids)
        except (json.JSONDecodeError, TypeError):
            doc.masul_bolimlar = json.dumps([data.bolim_id])

    db.commit()
    db.refresh(doc)
    doc_out = schemas.IjroDocOut.model_validate(doc)
    _fill_doc_out(doc_out, doc, db)
    bolimlar = [_make_bolim_out(b) for b in doc.bolim_assignments]
    return schemas.IjroDocTracking(doc=doc_out, bolimlar=bolimlar)
