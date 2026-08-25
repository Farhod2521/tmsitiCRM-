"""Ijro nazorati hujjatlari va topshiriqlari."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload, selectinload, defer
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


def _fill_doc_out(item, doc: models.IjroDocument, db: Session):
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

def _make_bolim_out(ab: models.IjroDocBolim, db: Optional[Session] = None, include_files: bool = True) -> schemas.IjroDocBolimOut:
    out = schemas.IjroDocBolimOut.model_validate(ab)
    out.bolim_nomi = ab.bolim.name if ab.bolim else None
    out.qaror_by_nomi = ab.qaror_beruvchi.full_name if ab.qaror_beruvchi else None
    out.xodim_nomi = ab.xodim.full_name if ab.xodim else None
    out.yakunlagan_by_nomi = ab.yakunlovchi.full_name if ab.yakunlovchi else None
    # Ro'yxat (list) so'rovlarida fayllar (og'ir base64) o'qilmaydi — faqat bitta
    # topshiriq ochilganda (/detail) kerak bo'ladi.
    if include_files and ab.yakunlash_fayllar_raw:
        try:
            out.yakunlash_fayllar = [schemas.YakunlashFayl(**f) for f in json.loads(ab.yakunlash_fayllar_raw)]
        except (json.JSONDecodeError, TypeError):
            out.yakunlash_fayllar = []
    if ab.document:
        out.doc_id            = ab.document.id
        out.doc_sarlavha      = ab.document.sarlavha
        out.doc_mazmun        = ab.document.mazmun
        out.doc_qoshimcha_malumot = ab.document.qoshimcha_malumot
        out.doc_manba         = ab.document.manba.value if ab.document.manba else None
        out.doc_hujjat_raqami = ab.document.hujjat_raqami
        out.doc_ijro_muddati  = ab.document.ijro_muddati
    if db is not None:
        logs = (
            db.query(models.IjroDocBolimAssignLog)
            .filter(models.IjroDocBolimAssignLog.doc_bolim_id == ab.id)
            .order_by(models.IjroDocBolimAssignLog.assigned_at.asc())
            .all()
        )
        out.assign_log = [
            schemas.IjroDocBolimAssignLogOut(
                id=log.id,
                xodim_id=log.xodim_id,
                xodim_nomi=log.xodim.full_name if log.xodim else None,
                assigned_by=log.assigned_by,
                assigned_by_nomi=log.assigned_by_emp.full_name if log.assigned_by_emp else None,
                assigned_at=log.assigned_at,
            )
            for log in logs
        ]
    return out


def _log_assignment(db: Session, doc_bolim_id: int, xodim_id: int, assigned_by: Optional[int]):
    db.add(models.IjroDocBolimAssignLog(
        doc_bolim_id=doc_bolim_id,
        xodim_id=xodim_id,
        assigned_by=assigned_by,
    ))


@router.get("/", response_model=List[schemas.IjroDocListOut])
def list_docs(
    tur:    Optional[str] = None,
    manba:  Optional[str] = None,
    holati: Optional[str] = None,
    db:     Session = Depends(get_db),
    _:      models.Employee = Depends(_require_ijro),
):
    # fayl_b64 (og'ir base64 blob) ro'yxatda kerak emas — sahifani sekinlashtirmasligi
    # uchun bazadan o'qilmaydi (faqat /{doc_id} orqali bitta hujjat ochilganda keladi).
    # masul_orinbosar/bolim_assignments ham oldindan (bitta so'rovda) yuklanadi — har
    # bir hujjat uchun alohida so'rov (N+1) yubormaslik uchun.
    q = db.query(models.IjroDocument).options(
        defer(models.IjroDocument.fayl_b64),
        joinedload(models.IjroDocument.masul_orinbosar),
        selectinload(models.IjroDocument.bolim_assignments),
    )
    if tur:    q = q.filter(models.IjroDocument.tur    == tur)
    if manba:  q = q.filter(models.IjroDocument.manba  == manba)
    if holati: q = q.filter(models.IjroDocument.holati == holati)
    docs = q.order_by(models.IjroDocument.created_at.desc()).all()
    return [_fill_doc_out(schemas.IjroDocListOut.model_validate(d), d, db) for d in docs]


@router.post("/", response_model=schemas.IjroDocOut, status_code=201)
def create_doc(
    data:    schemas.IjroDocIn,
    db:      Session = Depends(get_db),
    current: models.Employee = Depends(_require_ijro),
):
    doc_data = data.model_dump(exclude={"masul_bolimlar_xodimlar"})
    doc = models.IjroDocument(**doc_data, created_by=current.id)
    db.add(doc)
    db.flush()   # get doc.id before commit

    # Bo'lim_id -> boshlang'ich ijrochi xodim_id (ixtiyoriy, forma orqali tanlangan)
    xodim_map: dict[int, int] = {}
    if data.masul_bolimlar_xodimlar:
        try:
            xodim_map = {int(k): v for k, v in json.loads(data.masul_bolimlar_xodimlar).items()}
        except (json.JSONDecodeError, TypeError, ValueError):
            xodim_map = {}

    # Auto-create IjroDocBolim rows for each selected department
    if data.masul_bolimlar:
        try:
            bolim_ids = json.loads(data.masul_bolimlar)
            for bid in bolim_ids:
                ab = models.IjroDocBolim(doc_id=doc.id, bolim_id=bid)
                xodim_id = xodim_map.get(bid)
                if xodim_id:
                    xodim = db.query(models.Employee).filter(
                        models.Employee.id == xodim_id,
                        models.Employee.department_id == bid,
                    ).first()
                    if xodim:
                        ab.xodim_id = xodim_id
                        ab.xodim_assigned_at = datetime.utcnow()
                        # Hujjat yaratishda aniq ijrochi tanlangan bo'lsa, bo'lim
                        # avtomatik qabul qilingan hisoblanadi — qabul/rad etish
                        # bosqichi shart emas.
                        ab.holati   = models.IjroDocBolimHolati.qabul_qilindi
                        ab.qaror_at = datetime.utcnow()
                        ab.qaror_by = current.id
                db.add(ab)
                db.flush()
                if ab.xodim_id:
                    _log_assignment(db, ab.id, ab.xodim_id, current.id)
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

    # Bog'liq xodim/bo'lim/hujjat obyektlari oldindan (bitta so'rovda) yuklanadi —
    # aks holda har bir qator uchun alohida so'rov (N+1) ketib, ro'yxat sekinlashadi.
    # Fayllar (og'ir base64) esa ro'yxatda kerak emas — faqat /detail ochilganda.
    q = db.query(models.IjroDocBolim).options(
        joinedload(models.IjroDocBolim.bolim),
        joinedload(models.IjroDocBolim.qaror_beruvchi),
        joinedload(models.IjroDocBolim.xodim),
        joinedload(models.IjroDocBolim.yakunlovchi),
        joinedload(models.IjroDocBolim.document),
        defer(models.IjroDocBolim.yakunlash_fayllar_raw),
    )
    if current.role in _BOLIM_ROLES:
        if not current.department_id:
            return []
        q = q.filter(models.IjroDocBolim.bolim_id == current.department_id)
    # admin/ijro sees all
    if holati:
        q = q.filter(models.IjroDocBolim.holati == holati)
    rows = q.order_by(models.IjroDocBolim.assigned_at.desc()).all()
    return [_make_bolim_out(r, include_files=False) for r in rows]


@router.get("/bolim-inbox/{doc_bolim_id}/detail", response_model=schemas.IjroDocTracking)
def bolim_doc_detail(
    doc_bolim_id: int,
    db:      Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    """Hujjatning to'liq tafsilotlari: doc + barcha bolim holatlari."""
    ab = db.query(models.IjroDocBolim).filter(models.IjroDocBolim.id == doc_bolim_id).first()
    if not ab:
        raise HTTPException(status_code=404, detail="Topilmadi")
    if current.role not in (_BOLIM_ROLES | _ADMIN_ROLES | _ALLOWED) and ab.xodim_id != current.id:
        raise HTTPException(status_code=403, detail="Ruxsat yo'q")
    doc = ab.document
    doc_out = schemas.IjroDocOut.model_validate(doc)
    if doc.masul_orinbosar:
        doc_out.masul_orinbosar_nomi = doc.masul_orinbosar.full_name
    bolimlar = [_make_bolim_out(b, db) for b in doc.bolim_assignments]
    return schemas.IjroDocTracking(doc=doc_out, bolimlar=bolimlar)


@router.post("/bolim-inbox/{doc_bolim_id}/qaror", response_model=schemas.IjroDocBolimOut)
def bolim_qaror(
    doc_bolim_id: int,
    data:    schemas.IjroDocBolimQaror,
    db:      Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    """Qabul qilish yoki rad etish. Qabul qilinganda ijrochi xodim sifatida
    avtomatik bo'lim boshlig'ining o'zi (qaror beruvchi) belgilanadi — u
    keyinchalik /assign orqali boshqa xodimga qayta biriktirishi mumkin."""
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
    if data.holati == models.IjroDocBolimHolati.qabul_qilindi and not ab.xodim_id:
        ab.xodim_id = current.id
        ab.xodim_assigned_at = datetime.utcnow()
        db.flush()
        _log_assignment(db, ab.id, current.id, current.id)
    db.commit()
    db.refresh(ab)
    return _make_bolim_out(ab, db)


@router.post("/bolim-inbox/{doc_bolim_id}/assign", response_model=schemas.IjroDocBolimOut)
def assign_xodim(
    doc_bolim_id: int,
    data:    schemas.AssignXodimIn,
    db:      Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    """Qabul qilingan topshiriqni bo'lim ichidagi aniq xodimga (qayta) biriktirish.
    Faqat shu bo'limning boshlig'i (yoki admin/ijro rollar) qila oladi, va faqat
    o'z bo'limidagi xodimga."""
    if current.role not in (_BOLIM_ROLES | _ADMIN_ROLES | _ALLOWED):
        raise HTTPException(status_code=403, detail="Ruxsat yo'q")
    ab = db.query(models.IjroDocBolim).filter(models.IjroDocBolim.id == doc_bolim_id).first()
    if not ab:
        raise HTTPException(status_code=404, detail="Topilmadi")
    if current.role in _BOLIM_ROLES and ab.bolim_id != current.department_id:
        raise HTTPException(status_code=403, detail="Bu sizning bo'limingiz emas")
    if ab.holati == models.IjroDocBolimHolati.rad_etildi:
        raise HTTPException(status_code=400, detail="Rad etilgan topshiriqqa xodim biriktirib bo'lmaydi")

    xodim = db.query(models.Employee).filter(models.Employee.id == data.xodim_id).first()
    if not xodim:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")
    if xodim.department_id != ab.bolim_id:
        raise HTTPException(status_code=400, detail="Bu xodim shu bo'limga tegishli emas")

    ab.xodim_id = xodim.id
    ab.xodim_assigned_at = datetime.utcnow()
    db.flush()
    _log_assignment(db, ab.id, xodim.id, current.id)
    db.commit()
    db.refresh(ab)
    return _make_bolim_out(ab, db)


@router.post("/bolim-inbox/{doc_bolim_id}/yakunlash", response_model=schemas.IjroDocBolimOut)
def yakunlash(
    doc_bolim_id: int,
    data:    schemas.IjroDocBolimYakunlashIn,
    db:      Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    """Bo'lim qabul qilgan topshiriqni yakunlash: izoh + bir nechta fayl bilan
    'tasdiqlanishi kutilmoqda' deb belgilash — hujjat haqiqatda 'bajarildi'ga
    faqat IJRO nazorati (yoki admin) uni ko'rib chiqib tasdiqlagandan keyin o'tadi
    (ijro-qaror endpoint). Bo'lim boshlig'i yoki topshiriq shaxsan biriktirilgan
    xodimning o'zi yakunlashi mumkin. Direktor/ijro rollar tracking orqali ko'radi."""
    ab = db.query(models.IjroDocBolim).filter(models.IjroDocBolim.id == doc_bolim_id).first()
    if not ab:
        raise HTTPException(status_code=404, detail="Topilmadi")
    is_assigned_xodim = ab.xodim_id == current.id
    if current.role not in (_BOLIM_ROLES | _ADMIN_ROLES | _ALLOWED) and not is_assigned_xodim:
        raise HTTPException(status_code=403, detail="Ruxsat yo'q")
    if current.role in _BOLIM_ROLES and ab.bolim_id != current.department_id and not is_assigned_xodim:
        raise HTTPException(status_code=403, detail="Bu sizning bo'limingiz emas")
    if ab.holati not in (models.IjroDocBolimHolati.qabul_qilindi, models.IjroDocBolimHolati.bajarilmoqda):
        raise HTTPException(status_code=400, detail="Avval topshiriqni qabul qilish kerak")

    ab.holati = models.IjroDocBolimHolati.tasdiq_kutilmoqda
    ab.yakunlash_izohi = data.izoh
    ab.yakunlash_fayllar_raw = json.dumps([f.model_dump() for f in data.fayllar], ensure_ascii=False) if data.fayllar else None
    ab.yakunlangan_at = datetime.utcnow()
    ab.yakunlagan_by = current.id
    db.commit()
    db.refresh(ab)
    return _make_bolim_out(ab, db)


@router.post("/bolim-inbox/{doc_bolim_id}/ijro-qaror", response_model=schemas.IjroDocBolimOut)
def ijro_qaror(
    doc_bolim_id: int,
    data:    schemas.IjroReviewIn,
    db:      Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    """Bo'lim yakunlab (tasdiq kutilmoqda holatiga) yuborgan hisobotni ijro nazorati
    (direktor/ijro) ko'rib chiqadi: 'yechish' — tasdiqlaydi, bo'lim 'bajarildi'
    deb belgilanadi (barcha bo'limlar bajarilsa/rad etilsa, hujjat ham 'bajarildi'
    deb yopiladi); 'rad_etish' — hisobotni rad etadi, bo'lim qayta 'rad etildi'
    holatiga o'tadi."""
    if current.role not in (_ADMIN_ROLES | _ALLOWED):
        raise HTTPException(status_code=403, detail="Ruxsat yo'q")
    ab = db.query(models.IjroDocBolim).filter(models.IjroDocBolim.id == doc_bolim_id).first()
    if not ab:
        raise HTTPException(status_code=404, detail="Topilmadi")
    if ab.holati != models.IjroDocBolimHolati.tasdiq_kutilmoqda:
        raise HTTPException(status_code=400, detail="Bo'lim hali topshiriqni yakunlab yubormagan")

    if data.qaror == "rad_etish":
        ab.holati   = models.IjroDocBolimHolati.rad_etildi
        ab.izoh     = data.izoh
        ab.qaror_at = datetime.utcnow()
        ab.qaror_by = current.id
    else:
        # "yechish" — endi bo'lim haqiqatda bajarildi deb tasdiqlanadi
        ab.holati   = models.IjroDocBolimHolati.bajarildi
        ab.qaror_at = datetime.utcnow()
        ab.qaror_by = current.id
        doc = ab.document
        siblings = db.query(models.IjroDocBolim).filter(models.IjroDocBolim.doc_id == ab.doc_id).all()
        if doc and all(s.holati in (models.IjroDocBolimHolati.bajarildi, models.IjroDocBolimHolati.rad_etildi) for s in siblings):
            doc.holati = models.IjroDocHolati.bajarildi

    db.commit()
    db.refresh(ab)
    return _make_bolim_out(ab, db)


@router.get("/my-tasks", response_model=List[schemas.IjroDocBolimOut])
def my_tasks(
    db:      Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    """Xodimga shaxsan biriktirilgan topshiriqlar — profil sahifasidagi
    'Ijro nazorati' bo'limi uchun."""
    rows = (
        db.query(models.IjroDocBolim)
        .options(
            joinedload(models.IjroDocBolim.bolim),
            joinedload(models.IjroDocBolim.qaror_beruvchi),
            joinedload(models.IjroDocBolim.xodim),
            joinedload(models.IjroDocBolim.yakunlovchi),
            joinedload(models.IjroDocBolim.document),
            defer(models.IjroDocBolim.yakunlash_fayllar_raw),
        )
        .filter(models.IjroDocBolim.xodim_id == current.id)
        .order_by(models.IjroDocBolim.xodim_assigned_at.desc())
        .all()
    )
    # assign_log va fayllar bu yerda kerak emas — tanlangan topshiriq bosilganda
    # /bolim-inbox/{id}/detail orqali to'liq holda alohida yuklanadi.
    return [_make_bolim_out(r, include_files=False) for r in rows]


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
    bolimlar = [_make_bolim_out(b, db) for b in doc.bolim_assignments]
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
        existing_ab.xodim_id   = None
        existing_ab.xodim_assigned_at = None
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
    bolimlar = [_make_bolim_out(b, db) for b in doc.bolim_assignments]
    return schemas.IjroDocTracking(doc=doc_out, bolimlar=bolimlar)


# ─── Telegram: muddati eng kam qolgan 10 ta topshiriqni rasm qilib yuborish ────

_URGENT_EXCLUDED_HOLATI = {models.IjroDocBolimHolati.rad_etildi, models.IjroDocBolimHolati.bajarildi}


def _urgent_task_rows(db: Session, limit: int = 10) -> list[dict]:
    """Xodimga biriktirilgan, hali yakunlanmagan (rad etilmagan/bajarilmagan)
    topshiriqlarni muddati eng yaqinlaridan (yoki o'tib ketganlaridan) boshlab qaytaradi."""
    rows = (
        db.query(models.IjroDocBolim, models.IjroDocument, models.Employee, models.Department)
        .join(models.IjroDocument, models.IjroDocBolim.doc_id == models.IjroDocument.id)
        .join(models.Employee, models.IjroDocBolim.xodim_id == models.Employee.id)
        .join(models.Department, models.IjroDocBolim.bolim_id == models.Department.id)
        .filter(
            models.IjroDocBolim.xodim_id.isnot(None),
            models.IjroDocBolim.holati.notin_(_URGENT_EXCLUDED_HOLATI),
        )
        .order_by(models.IjroDocument.ijro_muddati.is_(None), models.IjroDocument.ijro_muddati.asc())
        .limit(limit)
        .all()
    )
    return [
        {
            "full_name":     emp.full_name,
            "position":      emp.position,
            "dept_name":     dept.name,
            "mazmun":        doc.mazmun or doc.sarlavha,
            "hujjat_raqami": doc.hujjat_raqami,
            "holati":        ab.holati.value if hasattr(ab.holati, "value") else ab.holati,
            "ijro_muddati":  doc.ijro_muddati,
            "doc_id":        doc.id,
        }
        for ab, doc, emp, dept in rows
    ]


@router.post("/send-telegram-reminder")
def send_telegram_reminder(
    db: Session = Depends(get_db),
    current: models.Employee = Depends(_require_ijro),
):
    """Muddati eng kam qolgan (yoki o'tib ketgan) 10 ta topshiriqni ijro.png
    shabloni ustiga chizib, Telegram guruhiga rasm sifatida yuboradi."""
    from ..ijro_reminder_image import build_ijro_reminder_image
    from ..telegram import send_telegram_photo

    tasks = _urgent_task_rows(db, limit=10)
    if not tasks:
        raise HTTPException(status_code=400, detail="Hozircha xodimga biriktirilgan faol topshiriq yo'q")

    image_bytes = build_ijro_reminder_image(tasks)
    try:
        ok = send_telegram_photo(image_bytes)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    if not ok:
        raise HTTPException(status_code=502, detail="Telegram rasmni yuborib bo'lmadi")
    return {"ok": True, "count": len(tasks)}
