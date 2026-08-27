"""Ichki hujjatlar oqimi: Xodim (yoki bo'lim boshlig'ining o'zi) hujjat kiritadi ->
Bo'lim boshlig'i ko'rib chiqib, qaysi zamdirektorga yo'naltirishni tanlab tasdiqlaydi ->
Zamdirektor tasdiqlaydi -> IJRO roli yakuniy holatda ko'radi (faqat ko'rish, harakatsiz).
Har bir bosqichda rad etish sababi bilan mumkin; rad etilsa hujjat "rad_etildi" bo'lib
qoladi, kim yuklagan bo'lsa o'shanga ko'rinadi va u "parent_doc_id" orqali bog'langan
yangi hujjat sifatida qaytadan yuboradi."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from .. import models, schemas
from ..database import get_db
from ..deps import get_current_employee
from ..telegram import send_telegram_message_to

router = APIRouter(prefix="/internal-docs", tags=["Ichki hujjatlar"])

_HEAD_ROLES = {models.RoleEnum.bolim_boshligi, models.RoleEnum.boshqarma_boshligi}
_ADMIN_ROLES = {models.RoleEnum.superadmin, models.RoleEnum.direktor, models.RoleEnum.zamdirektor}


def _notify(employee: Optional[models.Employee], text: str) -> None:
    """Xodimning shaxsiy Telegramiga xabar yuboradi — telegram ulanmagan bo'lsa
    yoki yuborishda xato bo'lsa, asosiy amalni to'xtatmasdan sokin o'tkazib yuboriladi."""
    if not employee or not employee.telegram_id:
        return
    try:
        send_telegram_message_to(employee.telegram_id, text)
    except Exception:
        pass


def _doc_summary(doc: models.InternalDocument) -> str:
    mazmun = f"\n\U0001F4DD Mazmuni: {doc.mazmun}" if doc.mazmun else ""
    return f"\U0001F4CB Nomi: {doc.nomi}{mazmun}\n\U0001F516 № {doc.hujjat_raqami}"


def _dept_heads(db: Session, department_id: Optional[int]) -> List[models.Employee]:
    if not department_id:
        return []
    return (
        db.query(models.Employee)
        .filter(models.Employee.role.in_(_HEAD_ROLES),
                models.Employee.department_id == department_id,
                models.Employee.telegram_id.isnot(None))
        .all()
    )


def _notify_all(employees, text: str) -> None:
    for e in employees:
        _notify(e, text)


def _log(db: Session, doc_id: int, action: str, izoh: Optional[str], actor_id: Optional[int]) -> None:
    db.add(models.InternalDocumentLog(doc_id=doc_id, action=action, izoh=izoh, actor_id=actor_id))


def _is_editable(doc: models.InternalDocument) -> bool:
    """Hujjat egasi (kim yaratgan bo'lsa) tahrirlashi/o'chirishi mumkin bo'lgan
    holatlar: rad etilgan (qayta yuborish uchun), yoki hali "keyingi" tasdiqlovchi
    tomonidan tasdiqlanmagan bosqichda. Bo'lim boshlig'i o'zi yaratgan hujjatda bu
    chegara zamdirektor tasdig'i, oddiy xodimda esa bo'lim boshlig'i tasdig'i."""
    if doc.status == models.InternalDocumentStatus.rad_etildi:
        return True
    creator_is_head = bool(doc.creator and doc.creator.role in _HEAD_ROLES)
    if creator_is_head:
        return doc.status in (models.InternalDocumentStatus.bolim_tasdiqladi, models.InternalDocumentStatus.zamdirektor_oqidi)
    return doc.status in (models.InternalDocumentStatus.yuborildi, models.InternalDocumentStatus.bolim_oqidi)


def _make_out(doc: models.InternalDocument, current: models.Employee, db: Optional[Session] = None, full: bool = True) -> schemas.InternalDocumentOut:
    cls = schemas.InternalDocumentOut if full else schemas.InternalDocumentListOut
    out = cls.model_validate(doc)
    out.department_nomi  = doc.department.name if doc.department else None
    out.zamdirektor_nomi = doc.zamdirektor.full_name if doc.zamdirektor else None
    out.created_by_nomi  = doc.creator.full_name if doc.creator else None
    out.editable          = doc.created_by == current.id and _is_editable(doc)
    if full and db is not None:
        logs = (
            db.query(models.InternalDocumentLog)
            .filter(models.InternalDocumentLog.doc_id == doc.id)
            .order_by(models.InternalDocumentLog.created_at.asc())
            .all()
        )
        out.log = [
            schemas.InternalDocumentLogOut(
                id=l.id, action=l.action, izoh=l.izoh,
                actor_nomi=l.actor.full_name if l.actor else None,
                created_at=l.created_at,
            )
            for l in logs
        ]
    return out


def _can_view(current: models.Employee, doc: models.InternalDocument) -> bool:
    if current.role in _ADMIN_ROLES or current.role == models.RoleEnum.ijro:
        return True
    if doc.created_by == current.id:
        return True
    if doc.zamdirektor_id == current.id:
        return True
    if current.role in _HEAD_ROLES and current.department_id == doc.department_id:
        return True
    return False


@router.post("/", response_model=schemas.InternalDocumentOut, status_code=201)
def create_doc(
    data:    schemas.InternalDocumentIn,
    db:      Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    if not current.department_id:
        raise HTTPException(status_code=400, detail="Sizga bo'lim biriktirilmagan")

    is_head = current.role in _HEAD_ROLES
    if is_head and not data.zamdirektor_id:
        raise HTTPException(status_code=422, detail="Zamdirektorni tanlash shart")
    if data.zamdirektor_id:
        zam = db.query(models.Employee).filter(models.Employee.id == data.zamdirektor_id).first()
        if not zam or zam.role != models.RoleEnum.zamdirektor:
            raise HTTPException(status_code=400, detail="Zamdirektor topilmadi")

    if data.parent_doc_id:
        parent = db.query(models.InternalDocument).filter(models.InternalDocument.id == data.parent_doc_id).first()
        if not parent or parent.created_by != current.id:
            raise HTTPException(status_code=400, detail="Avvalgi hujjat topilmadi")

    doc = models.InternalDocument(
        hujjat_raqami="",   # flush qilib id olingandan keyin to'ldiriladi
        nomi=data.nomi,
        mazmun=data.mazmun,
        fayl_name=data.fayl_name,
        fayl_b64=data.fayl_b64,
        department_id=current.department_id,
        zamdirektor_id=data.zamdirektor_id if is_head else None,
        status=models.InternalDocumentStatus.bolim_tasdiqladi if is_head else models.InternalDocumentStatus.yuborildi,
        parent_doc_id=data.parent_doc_id,
        created_by=current.id,
    )
    db.add(doc)
    db.flush()
    doc.hujjat_raqami = f"IH-{datetime.utcnow().year}-{doc.id:06d}"

    _log(db, doc.id, "yaratildi", None, current.id)
    if is_head:
        _log(db, doc.id, "bolim_tasdiqladi", None, current.id)

    db.commit()
    db.refresh(doc)

    if is_head:
        _notify(zam, f"\U0001F4E5 Yangi hujjat yaratildi\n\U0001F464 Yubordi: {current.full_name}\n{_doc_summary(doc)}")
    else:
        _notify_all(_dept_heads(db, current.department_id),
                     f"\U0001F4E8 Yangi hujjat yuborildi\n\U0001F464 Xodim: {current.full_name}\n{_doc_summary(doc)}")

    return _make_out(doc, current, db)


@router.get("/mine", response_model=List[schemas.InternalDocumentListOut])
def my_docs(
    db:      Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    """Joriy foydalanuvchi o'zi yaratgan hujjatlar — "Mening hujjatlarim" tabi uchun."""
    docs = (
        db.query(models.InternalDocument)
        .options(joinedload(models.InternalDocument.department), joinedload(models.InternalDocument.zamdirektor))
        .filter(models.InternalDocument.created_by == current.id)
        .order_by(models.InternalDocument.created_at.desc())
        .all()
    )
    return [_make_out(d, current, full=False) for d in docs]


@router.get("/bolim-inbox", response_model=List[schemas.InternalDocumentListOut])
def bolim_inbox(
    db:      Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    """Bo'lim boshlig'i ko'rib chiqishi kerak bo'lgan, xodimlardan kelgan hujjatlar
    (o'zi yaratganlari bu yerda ko'rinmaydi — ular /mine da)."""
    if current.role not in (_HEAD_ROLES | _ADMIN_ROLES):
        raise HTTPException(status_code=403, detail="Ruxsat yo'q")
    q = db.query(models.InternalDocument).options(
        joinedload(models.InternalDocument.department), joinedload(models.InternalDocument.zamdirektor),
        joinedload(models.InternalDocument.creator),
    )
    if current.role in _HEAD_ROLES:
        if not current.department_id:
            return []
        q = q.filter(
            models.InternalDocument.department_id == current.department_id,
            models.InternalDocument.created_by != current.id,
        )
    docs = q.order_by(models.InternalDocument.created_at.desc()).all()
    return [_make_out(d, current, full=False) for d in docs]


@router.get("/zamdirektor-inbox", response_model=List[schemas.InternalDocumentListOut])
def zamdirektor_inbox(
    db:      Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    """Zamdirektorga yo'naltirilgan hujjatlar. Zamdirektor faqat o'ziga
    yuborilganlarni ko'radi; direktor/superadmin barchasini (faqat ko'rish, harakat
    qila olmaydi — tasdiqlash/rad etish faqat tayinlangan zamdirektorning o'zida)."""
    if current.role not in (_ADMIN_ROLES):
        raise HTTPException(status_code=403, detail="Ruxsat yo'q")
    q = db.query(models.InternalDocument).options(
        joinedload(models.InternalDocument.department), joinedload(models.InternalDocument.zamdirektor),
        joinedload(models.InternalDocument.creator),
    ).filter(models.InternalDocument.status.in_([
        models.InternalDocumentStatus.bolim_tasdiqladi,
        models.InternalDocumentStatus.zamdirektor_oqidi,
        models.InternalDocumentStatus.zamdirektor_tasdiqladi,
        models.InternalDocumentStatus.ijrochi_oqidi,
        models.InternalDocumentStatus.rad_etildi,
    ]))
    if current.role == models.RoleEnum.zamdirektor:
        q = q.filter(models.InternalDocument.zamdirektor_id == current.id)
    docs = q.order_by(models.InternalDocument.created_at.desc()).all()
    return [_make_out(d, current, full=False) for d in docs]


@router.get("/ijro-view", response_model=List[schemas.InternalDocumentListOut])
def ijro_view(
    db:      Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    """Zamdirektor tasdiqlagan hujjatlar — IJRO roli faqat ko'radi, harakat qilmaydi."""
    if current.role not in ({models.RoleEnum.ijro} | _ADMIN_ROLES):
        raise HTTPException(status_code=403, detail="Ruxsat yo'q")
    docs = (
        db.query(models.InternalDocument)
        .options(joinedload(models.InternalDocument.department), joinedload(models.InternalDocument.zamdirektor),
                 joinedload(models.InternalDocument.creator))
        .filter(models.InternalDocument.status.in_([
            models.InternalDocumentStatus.zamdirektor_tasdiqladi,
            models.InternalDocumentStatus.ijrochi_oqidi,
        ]))
        .order_by(models.InternalDocument.updated_at.desc())
        .all()
    )
    return [_make_out(d, current, full=False) for d in docs]


@router.get("/zamdirektorlar")
def list_zamdirektorlar(
    db:      Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    """Zamdirektor lavozimidagi xodimlar ro'yxati — hujjat yaratish/tasdiqlashda
    tanlash uchun. `/employees/` bo'lim boshlig'i uchun faqat o'z bo'limini
    qaytaradi (zamdirektor odatda boshqa bo'limda bo'ladi), shuning uchun bu
    alohida, cheklanmagan endpoint kerak."""
    zams = (
        db.query(models.Employee)
        .filter(models.Employee.role == models.RoleEnum.zamdirektor, models.Employee.is_active == True)
        .order_by(models.Employee.full_name)
        .all()
    )
    return [{"id": z.id, "full_name": z.full_name, "position": z.position} for z in zams]


@router.get("/{doc_id}", response_model=schemas.InternalDocumentOut)
def get_doc(
    doc_id:  int,
    db:      Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    doc = db.query(models.InternalDocument).filter(models.InternalDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Hujjat topilmadi")
    if not _can_view(current, doc):
        raise HTTPException(status_code=403, detail="Ruxsat yo'q")

    if (current.role in _HEAD_ROLES and current.department_id == doc.department_id
            and doc.status == models.InternalDocumentStatus.yuborildi):
        doc.status = models.InternalDocumentStatus.bolim_oqidi
        _log(db, doc.id, "bolim_oqidi", None, current.id)
        db.commit()
        db.refresh(doc)
    elif (doc.zamdirektor_id == current.id
            and doc.status == models.InternalDocumentStatus.bolim_tasdiqladi):
        doc.status = models.InternalDocumentStatus.zamdirektor_oqidi
        _log(db, doc.id, "zamdirektor_oqidi", None, current.id)
        db.commit()
        db.refresh(doc)
    elif (current.role == models.RoleEnum.ijro
            and doc.status == models.InternalDocumentStatus.zamdirektor_tasdiqladi):
        doc.status = models.InternalDocumentStatus.ijrochi_oqidi
        _log(db, doc.id, "ijrochi_oqidi", None, current.id)
        db.commit()
        db.refresh(doc)

        msg = f"\U0001F441 Ijrochi hujjatni ko'rdi\n{_doc_summary(doc)}"
        _notify(doc.creator, msg)
        _notify_all(_dept_heads(db, doc.department_id), msg)
        _notify(doc.zamdirektor, msg)

    return _make_out(doc, current, db)


@router.get("/{doc_id}/file")
def download_file(
    doc_id:  int,
    db:      Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    doc = db.query(models.InternalDocument).filter(models.InternalDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Hujjat topilmadi")
    if not _can_view(current, doc):
        raise HTTPException(status_code=403, detail="Ruxsat yo'q")
    if not doc.fayl_b64:
        raise HTTPException(status_code=404, detail="Fayl topilmadi")
    return {"file_name": doc.fayl_name, "file_b64": doc.fayl_b64}


@router.patch("/{doc_id}", response_model=schemas.InternalDocumentOut)
def edit_doc(
    doc_id:  int,
    data:    schemas.InternalDocumentEditIn,
    db:      Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    """Hujjat egasi (yaratgan xodim) tahrirlaydi. Rad etilgan bo'lsa, tahrirlash
    avtomatik qayta yuborish hisoblanadi — rad etgan bosqichga (bo'lim boshlig'i
    yoki xuddi shu zamdirektorga) qaytadan yuboriladi, izoh tozalanadi."""
    doc = db.query(models.InternalDocument).filter(models.InternalDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Hujjat topilmadi")
    if doc.created_by != current.id:
        raise HTTPException(status_code=403, detail="Faqat hujjat egasi tahrirlashi mumkin")
    if not _is_editable(doc):
        raise HTTPException(status_code=400, detail="Hujjatni hozir tahrirlab bo'lmaydi")

    fields = data.model_dump(exclude_unset=True)
    if "nomi" in fields and fields["nomi"]:
        doc.nomi = fields["nomi"]
    if "mazmun" in fields:
        doc.mazmun = fields["mazmun"]
    if "fayl_name" in fields:
        doc.fayl_name = fields["fayl_name"]
    if "fayl_b64" in fields:
        doc.fayl_b64 = fields["fayl_b64"]

    if doc.status == models.InternalDocumentStatus.rad_etildi:
        last_reject = (
            db.query(models.InternalDocumentLog)
            .filter(models.InternalDocumentLog.doc_id == doc.id,
                    models.InternalDocumentLog.action.in_(["bolim_rad_etdi", "zamdirektor_rad_etdi"]))
            .order_by(models.InternalDocumentLog.created_at.desc())
            .first()
        )
        back_to_zamdirektor = bool(last_reject and last_reject.action == "zamdirektor_rad_etdi")
        doc.status = (
            models.InternalDocumentStatus.bolim_tasdiqladi
            if back_to_zamdirektor
            else models.InternalDocumentStatus.yuborildi
        )
        doc.rad_sababi = None
        _log(db, doc.id, "qayta_yuborildi", None, current.id)

        db.commit()
        db.refresh(doc)

        if back_to_zamdirektor:
            _notify(doc.zamdirektor, f"\U0001F504 Hujjat qayta kiritildi\n\U0001F464 Yubordi: {current.full_name}\n{_doc_summary(doc)}")
        else:
            _notify_all(_dept_heads(db, doc.department_id),
                         f"\U0001F504 Hujjat qayta kiritildi\n\U0001F464 Yubordi: {current.full_name}\n{_doc_summary(doc)}")

        return _make_out(doc, current, db)

    db.commit()
    db.refresh(doc)
    return _make_out(doc, current, db)


@router.delete("/{doc_id}", status_code=204)
def delete_doc(
    doc_id:  int,
    db:      Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    doc = db.query(models.InternalDocument).filter(models.InternalDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Hujjat topilmadi")
    if doc.created_by != current.id:
        raise HTTPException(status_code=403, detail="Faqat hujjat egasi o'chirishi mumkin")
    if not _is_editable(doc):
        raise HTTPException(status_code=400, detail="Hujjatni hozir o'chirib bo'lmaydi")
    db.delete(doc)
    db.commit()


@router.post("/{doc_id}/approve", response_model=schemas.InternalDocumentOut)
def bolim_approve(
    doc_id:  int,
    data:    schemas.InternalDocApproveIn,
    db:      Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    doc = db.query(models.InternalDocument).filter(models.InternalDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Hujjat topilmadi")
    if current.role not in (_HEAD_ROLES | _ADMIN_ROLES):
        raise HTTPException(status_code=403, detail="Ruxsat yo'q")
    if current.role in _HEAD_ROLES and current.department_id != doc.department_id:
        raise HTTPException(status_code=403, detail="Bu sizning bo'limingiz emas")
    if doc.status not in (models.InternalDocumentStatus.yuborildi, models.InternalDocumentStatus.bolim_oqidi):
        raise HTTPException(status_code=400, detail="Hujjat allaqachon ko'rib chiqilgan")

    zam = db.query(models.Employee).filter(models.Employee.id == data.zamdirektor_id).first()
    if not zam or zam.role != models.RoleEnum.zamdirektor:
        raise HTTPException(status_code=400, detail="Zamdirektor topilmadi")

    doc.zamdirektor_id = data.zamdirektor_id
    doc.status = models.InternalDocumentStatus.bolim_tasdiqladi
    _log(db, doc.id, "bolim_tasdiqladi", None, current.id)
    db.commit()
    db.refresh(doc)

    _notify(zam, f"\U0001F4E5 Yangi hujjat yaratildi\n\U0001F464 Yubordi: {current.full_name}\n{_doc_summary(doc)}")
    if doc.created_by != current.id:
        _notify(doc.creator, f"✅ Hujjat tasdiqlandi, zamdirektorga yuborildi\n{_doc_summary(doc)}")

    return _make_out(doc, current, db)


@router.post("/{doc_id}/reject", response_model=schemas.InternalDocumentOut)
def bolim_reject(
    doc_id:  int,
    data:    schemas.InternalDocRejectIn,
    db:      Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    doc = db.query(models.InternalDocument).filter(models.InternalDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Hujjat topilmadi")
    if current.role not in (_HEAD_ROLES | _ADMIN_ROLES):
        raise HTTPException(status_code=403, detail="Ruxsat yo'q")
    if current.role in _HEAD_ROLES and current.department_id != doc.department_id:
        raise HTTPException(status_code=403, detail="Bu sizning bo'limingiz emas")
    if doc.status not in (models.InternalDocumentStatus.yuborildi, models.InternalDocumentStatus.bolim_oqidi):
        raise HTTPException(status_code=400, detail="Hujjat allaqachon ko'rib chiqilgan")
    if not data.izoh or not data.izoh.strip():
        raise HTTPException(status_code=422, detail="Rad etish sababini yozing")

    doc.status = models.InternalDocumentStatus.rad_etildi
    doc.rad_sababi = data.izoh
    _log(db, doc.id, "bolim_rad_etdi", data.izoh, current.id)
    db.commit()
    db.refresh(doc)

    _notify(doc.creator, f"\U0000274C Hujjat rad etildi\n\U0001F4AC Sababi: {data.izoh}\n{_doc_summary(doc)}")

    return _make_out(doc, current, db)


@router.post("/{doc_id}/zamdirektor-approve", response_model=schemas.InternalDocumentOut)
def zamdirektor_approve(
    doc_id:  int,
    db:      Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    doc = db.query(models.InternalDocument).filter(models.InternalDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Hujjat topilmadi")
    if doc.zamdirektor_id != current.id:
        raise HTTPException(status_code=403, detail="Ruxsat yo'q")
    if doc.status not in (models.InternalDocumentStatus.bolim_tasdiqladi, models.InternalDocumentStatus.zamdirektor_oqidi):
        raise HTTPException(status_code=400, detail="Hujjat hali bo'lim boshlig'i tomonidan tasdiqlanmagan")

    doc.status = models.InternalDocumentStatus.zamdirektor_tasdiqladi
    _log(db, doc.id, "zamdirektor_tasdiqladi", None, current.id)
    db.commit()
    db.refresh(doc)

    msg = f"✅ Zamdirektor tasdiqladi\n{_doc_summary(doc)}"
    _notify(doc.creator, msg)
    _notify_all(_dept_heads(db, doc.department_id), msg)

    return _make_out(doc, current, db)


@router.post("/{doc_id}/zamdirektor-reject", response_model=schemas.InternalDocumentOut)
def zamdirektor_reject(
    doc_id:  int,
    data:    schemas.InternalDocRejectIn,
    db:      Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    doc = db.query(models.InternalDocument).filter(models.InternalDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Hujjat topilmadi")
    if doc.zamdirektor_id != current.id:
        raise HTTPException(status_code=403, detail="Ruxsat yo'q")
    if doc.status not in (models.InternalDocumentStatus.bolim_tasdiqladi, models.InternalDocumentStatus.zamdirektor_oqidi):
        raise HTTPException(status_code=400, detail="Hujjat hali bo'lim boshlig'i tomonidan tasdiqlanmagan")
    if not data.izoh or not data.izoh.strip():
        raise HTTPException(status_code=422, detail="Rad etish sababini yozing")

    doc.status = models.InternalDocumentStatus.rad_etildi
    doc.rad_sababi = data.izoh
    _log(db, doc.id, "zamdirektor_rad_etdi", data.izoh, current.id)
    db.commit()
    db.refresh(doc)

    _notify(doc.creator, f"\U0000274C Hujjat rad etildi\n\U0001F4AC Sababi: {data.izoh}\n{_doc_summary(doc)}")

    return _make_out(doc, current, db)
