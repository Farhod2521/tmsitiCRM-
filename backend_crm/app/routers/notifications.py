from datetime import datetime, timedelta
from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy.orm import Session
from .. import models, schemas, note_flow
from ..database import get_db
from ..deps import get_current_employee
from .employees import revert_expired_statuses

router = APIRouter(prefix="/notifications", tags=["Bildirishnomalar"])

R = models.RoleEnum
_ADMIN = {R.superadmin, R.direktor, R.zamdirektor}
_HEADS = {R.bolim_boshligi, R.boshqarma_boshligi}

# Rol -> frontend bo'limi (layout) prefiksi
_PREFIX = {
    R.superadmin: "/superadmin", R.direktor: "/superadmin", R.zamdirektor: "/superadmin",
    R.bolim_boshligi: "/bolimboshliq", R.boshqarma_boshligi: "/bolimboshliq",
    R.ijro: "/ijro", R.kadr: "/xodim", R.xodim: "/xodim",
}


def _href(role, section: str) -> str:
    p = _PREFIX.get(role, "/xodim")
    if p == "/superadmin":
        return {"izohlar": "/superadmin/izohlar", "hujjatlar": "/superadmin/ichki-hujjatlar"}.get(section, "/superadmin/nazorat")
    if p == "/xodim":
        return "/xodim/izohlar" if section == "izohlar" else "/xodim/ijro-nazorati"
    if p == "/bolimboshliq" and section == "izohlar":
        return "/bolimboshliq/izohlar"
    return f"{p}/nazorat"


@router.get("", response_model=schemas.NotificationsOut)
def my_notifications(
    background: BackgroundTasks,
    db:      Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    """Joriy foydalanuvchidan javob/harakat kutayotgan ishlar soni — header'dagi
    qo'ng'iroqcha va menyudagi qizil sonlar uchun. Ish bajarilgach son o'zi kamayadi."""
    role = current.role
    items: list[schemas.NotificationItem] = []

    def add(key: str, section: str, title: str, count: int):
        if count > 0:
            items.append(schemas.NotificationItem(key=key, section=section, title=title,
                                                  count=count, href=_href(role, section)))

    Note = models.AttendanceNote
    # Rejalashtirilgan holatlar (sanasi kelgan ta'til va h.k.) — har daqiqalik so'rovda yangilanadi
    revert_expired_statuses(db)
    # Bo'lim boshlig'isiz kadrga tushib qolgan arizalar — boshliqqa qaytariladi
    moved = note_flow.reroute_to_heads(db)
    if moved:
        background.add_task(note_flow.after_reroute, moved)
    # ── Davomat izohlari (arizalar) ───────────────────────────────────────────
    if role in _HEADS and current.department_id:
        add("izoh_bolim", "izohlar", "Tasdig'ingizni kutayotgan davomat arizalari",
            db.query(Note).join(models.Employee, Note.employee_id == models.Employee.id)
            .filter(Note.review_status == "bolim_kutilmoqda",
                    models.Employee.department_id == current.department_id,
                    Note.employee_id != current.id).count())
    if role == R.kadr:
        add("izoh_kadr", "izohlar", "Ko'rib chiqilmagan davomat arizalari",
            db.query(Note).filter(Note.review_status == "kutilmoqda").count())
    elif role in _ADMIN:
        add("izoh_admin", "izohlar", "Tasdig'ingizni kutayotgan davomat izohlari",
            db.query(Note).filter(Note.review_status == "kadr_tasdiqladi").count())

    # ── Ichki hujjatlar ───────────────────────────────────────────────────────
    Doc, DS = models.InternalDocument, models.InternalDocumentStatus
    if role == R.zamdirektor:
        add("hujjat_zam", "hujjatlar", "Tasdig'ingizni kutayotgan xodim hujjatlari",
            db.query(Doc).filter(Doc.zamdirektor_id == current.id,
                                 Doc.status.in_([DS.bolim_tasdiqladi, DS.zamdirektor_oqidi])).count())
    elif role in _HEADS and current.department_id:
        add("hujjat_bolim", "hujjatlar", "Ko'rib chiqilmagan xodim hujjatlari",
            db.query(Doc).filter(Doc.department_id == current.department_id,
                                 Doc.created_by != current.id,
                                 Doc.status.in_([DS.yuborildi, DS.bolim_oqidi])).count())
    elif role == R.ijro:
        add("hujjat_ijro", "hujjatlar", "Zamdirektor tasdiqlagan yangi hujjatlar",
            db.query(Doc).filter(Doc.status == DS.zamdirektor_tasdiqladi).count())

    # ── Ijro nazorati ─────────────────────────────────────────────────────────
    DB, BH = models.IjroDocBolim, models.IjroDocBolimHolati
    ID = models.IjroDocument
    if role in _ADMIN:
        # Bo'limlar rad etgan topshiriqlar (izoh/sabab bilan) — so'nggi 30 kun
        since = datetime.utcnow() - timedelta(days=30)
        q = (db.query(DB).join(ID, DB.doc_id == ID.id)
             .filter(DB.holati == BH.rad_etildi, DB.qaror_at >= since,
                     ID.holati != models.IjroDocHolati.bajarildi))
        overdue = db.query(ID).filter(ID.ijro_muddati.isnot(None), ID.ijro_muddati < datetime.utcnow(),
                                      ID.holati != models.IjroDocHolati.bajarildi)
        if role == R.zamdirektor:
            q = q.filter(ID.masul_orinbosar_id == current.id)
            overdue = overdue.filter(ID.masul_orinbosar_id == current.id)
        add("ijro_rad", "ijro", "Ijro: bo'limlar rad etgan topshiriqlar (izoh bilan)", q.count())
        add("ijro_kech", "ijro", "Ijro: muddati o'tgan topshiriqlar", overdue.count())
    elif role in _HEADS and current.department_id:
        add("ijro_bolim", "ijro", "Bo'limingizga kelgan yangi ijro topshiriqlari",
            db.query(DB).filter(DB.bolim_id == current.department_id, DB.holati == BH.yuborildi).count())
    elif role == R.ijro:
        add("ijro_tasdiq", "ijro", "Tasdig'ingizni kutayotgan bajarilgan topshiriqlar",
            db.query(DB).filter(DB.holati == BH.tasdiq_kutilmoqda).count())

    # Shaxsan biriktirilgan, hali yakunlanmagan topshiriqlar (har qanday rol)
    add("ijro_mine", "ijro", "Sizga biriktirilgan bajarilmagan topshiriqlar",
        db.query(DB).filter(DB.xodim_id == current.id,
                            DB.holati.in_([BH.qabul_qilindi, BH.bajarilmoqda])).count())

    return schemas.NotificationsOut(total=sum(i.count for i in items), items=items)
