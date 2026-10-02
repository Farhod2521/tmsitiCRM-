"""add_account_bot uchun ichki API — faqat X-Bot-Secret header bilan chaqiriladi.
Bu yerda oddiy foydalanuvchi tokeni (JWT) talab qilinmaydi: xodim kimligi CRM
profilida yaratilgan bir martalik `token` (TelegramLinkToken) orqali aniqlanadi —
telefon raqami yoki parol ochiq deep-linkda yuborilmaydi va tekshirilmaydi."""
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from ..deps import require_bot_secret
from ..auth import get_password_hash, encrypt_password
from .. import models, schemas
from .attendance import get_absent_employees, build_pending_message_text, nearest_work_location
from pydantic import BaseModel
from typing import Optional
from .. import note_flow

router = APIRouter(prefix="/bot", tags=["Telegram Bot"], dependencies=[Depends(require_bot_secret)])

_TZ_UZ = timezone(timedelta(hours=5))


@router.post("/link-account", response_model=schemas.BotLinkOut)
def link_account(data: schemas.BotLinkIn, db: Session = Depends(get_db)):
    """Xodim botda kontaktini ulashib, yangi parol kiritganda chaqiriladi.
    `token` — CRM profilida (autentifikatsiyadan o'tgan holda) yaratilgan bir
    martalik havola; shu orqali qaysi xodim ekanligi aniqlanadi. Tasdiqlangach,
    telegram_id/username bog'lanadi, CRM telefon raqami Telegram kontaktidan
    olingan haqiqiy raqamga yangilanadi va yangi parol o'rnatiladi."""
    link = db.query(models.TelegramLinkToken).filter(models.TelegramLinkToken.token == data.token).first()
    if not link or link.used_at is not None or link.expires_at < datetime.utcnow():
        return schemas.BotLinkOut(ok=False, detail="Havola muddati o'tgan yoki ishlatilgan. CRM profilingizdagi tugmani qaytadan bosing.")

    emp = db.query(models.Employee).filter(models.Employee.id == link.employee_id).first()
    # is_active bu yerda TEKSHIRILMAYDI: u "ball/statistikada hisoblanadi" belgisi
    # (ta'til, bolnichniy, safarda false) — hisob bloklangani emas.
    if not emp:
        return schemas.BotLinkOut(ok=False, detail="Hisob topilmadi. CRM profilingizdagi tugmani qaytadan bosing.")

    # Bu telegram_id boshqa xodimga bog'langan bo'lsa, avval bo'shatamiz
    # (masalan, xodim eski akkauntini qayta bog'laganda).
    db.query(models.Employee).filter(
        models.Employee.telegram_id == data.telegram_id,
        models.Employee.id != emp.id,
    ).update({"telegram_id": None, "telegram_username": None})

    if data.verified_phone and data.verified_phone != emp.phone:
        clash = db.query(models.Employee).filter(
            models.Employee.phone == data.verified_phone,
            models.Employee.id != emp.id,
        ).first()
        if clash:
            return schemas.BotLinkOut(ok=False, detail="Bu telefon raqami allaqachon boshqa xodimga tegishli")
        emp.phone = data.verified_phone

    emp.hashed_password = get_password_hash(data.new_password)
    emp.enc_password = encrypt_password(data.new_password)
    if data.photo_base64:
        emp.photo_base64 = data.photo_base64
    emp.telegram_id = data.telegram_id
    emp.telegram_username = data.telegram_username
    link.used_at = datetime.utcnow()
    db.commit()
    return schemas.BotLinkOut(ok=True, full_name=emp.full_name, phone=emp.phone)


@router.post("/attendance-notes/review", response_model=schemas.BotNoteReviewOut)
def bot_review_note(data: schemas.BotNoteReviewIn, background: BackgroundTasks, db: Session = Depends(get_db)):
    """Telegram'dagi "Tasdiqlash"/"Rad etish" inline tugmasi bosilganda bot
    chaqiradi. Saytdagi tasdiqlash bilan bir xil mantiq (note_flow.apply_review);
    xabarlarni tahrirlash va keyingi bosqichga yuborish — fonda."""
    actor = db.query(models.Employee).filter(models.Employee.telegram_id == data.telegram_id).first()
    if not actor:
        return schemas.BotNoteReviewOut(ok=False, message="Telegram hisobingiz CRM'ga bog'lanmagan")
    note = db.query(models.AttendanceNote).filter(models.AttendanceNote.id == data.note_id).first()
    if not note:
        return schemas.BotNoteReviewOut(ok=False, message="Ariza topilmadi")
    if note.review_status != data.stage:
        return schemas.BotNoteReviewOut(ok=False, message="Bu bosqich allaqachon ko'rib chiqilgan")
    try:
        prev = note_flow.apply_review(db, note, actor, data.approve)
    except note_flow.ReviewError as e:
        return schemas.BotNoteReviewOut(ok=False, message=str(e))
    background.add_task(note_flow.after_review, note.id, prev, actor.id, data.approve, "bot")
    return schemas.BotNoteReviewOut(ok=True, message="✅ Tasdiqlandi" if data.approve else "❌ Rad etildi")


class LiveLocationIn(BaseModel):
    telegram_id: int
    latitude: float
    longitude: float
    live_period: Optional[int] = None          # jonli lokatsiyada bo'ladi, oddiysida — yo'q
    horizontal_accuracy: Optional[float] = None
    sent_at: int                               # xabar (yoki tahrir) vaqti, unix
    is_forwarded: bool = False
    is_update: bool = False                    # jonli lokatsiyaning keyingi yangilanishi (edited_message)


class LiveLocationOut(BaseModel):
    ok: bool
    status: str        # checked_in | already | far | rejected
    message: str
    reply: bool = True  # bot javob yozsinmi (yangilanishlarda — faqat holat o'zgarsa)


LIVE_MAX_AGE_SEC = 120      # xabar shu soniyadan eski bo'lsa — qabul qilinmaydi
LIVE_MAX_ACCURACY_M = 150   # GPS aniqligi bundan yomon bo'lsa — qabul qilinmaydi


@router.post("/attendance/live-location", response_model=LiveLocationOut)
def live_location_checkin(data: LiveLocationIn, db: Session = Depends(get_db)):
    """Telegram bot orqali "Ishga keldim": faqat JONLI lokatsiya (live_period bor),
    forward qilinmagan, yangi (≤2 daq) va ofis hududida bo'lsa kelgan vaqt yoziladi.
    Jonli lokatsiya yo'lda yoqilsa — ofis hududiga kirgan paytdagi yangilanishda
    belgilanadi. Bugun belgilangan bo'lsa — vaqt o'zgartirilmaydi."""
    upd = data.is_update
    emp = db.query(models.Employee).filter(models.Employee.telegram_id == data.telegram_id).first()
    if not emp:
        return LiveLocationOut(ok=False, status="rejected", reply=not upd,
                               message="❌ Telegram hisobingiz CRM'ga bog'lanmagan. CRM profilingizdagi \"Telegram'ni ulash\" tugmasidan foydalaning.")
    if data.is_forwarded:
        return LiveLocationOut(ok=False, status="rejected", reply=not upd,
                               message="❌ Forward qilingan lokatsiya qabul qilinmaydi. O'zingiz jonli lokatsiya yuboring.")
    if not data.live_period:
        return LiveLocationOut(ok=False, status="rejected", reply=not upd,
                               message="❌ Faqat JONLI lokatsiya qabul qilinadi.\n\n📎 → Joylashuv → «Jonli joylashuvni ulashish» ni tanlang.")
    now_utc = datetime.now(timezone.utc)
    if abs(now_utc.timestamp() - data.sent_at) > LIVE_MAX_AGE_SEC:
        return LiveLocationOut(ok=False, status="rejected", reply=not upd,
                               message="❌ Lokatsiya eskirgan. Yangi jonli lokatsiya yuboring.")

    now = datetime.now(_TZ_UZ).replace(tzinfo=None)
    today = now.strftime("%Y-%m-%d")
    existing = db.query(models.Attendance).filter(models.Attendance.employee_id == emp.id,
                                                  models.Attendance.date == today).first()
    if existing:
        return LiveLocationOut(ok=True, status="already", reply=not upd,
                               message=f"ℹ️ Bugun allaqachon {existing.check_in:%H:%M} da belgilangansiz. Jonli lokatsiyani o'chirib qo'yishingiz mumkin.")
    if data.horizontal_accuracy is not None and data.horizontal_accuracy > LIVE_MAX_ACCURACY_M:
        return LiveLocationOut(ok=False, status="rejected", reply=not upd,
                               message=f"⚠️ GPS aniqligi past (±{int(data.horizontal_accuracy)} m). Ochiqroq joyga chiqib qayta urinib ko'ring.")

    # Belgilangan barcha ish joylari (vazirlik, labaratoriya) — har biri o'z radiusi bilan
    place, dist, radius, inside = nearest_work_location(db, data.latitude, data.longitude)
    if not inside:
        return LiveLocationOut(ok=False, status="far", reply=not upd,
                               message=f"📍 Siz eng yaqin ish joyidan ({place}) {int(dist)} m uzoqdasiz (ruxsat: {int(radius)} m).\n"
                                       "Jonli lokatsiyani o'chirmang — hududga kirganingizda avtomatik belgilanadi.")

    db.add(models.Attendance(employee_id=emp.id, date=today, check_in=now, latitude=data.latitude,
                             longitude=data.longitude, distance_m=round(dist, 1), source="telegram"))
    db.commit()
    return LiveLocationOut(ok=True, status="checked_in", reply=True,
                           message=f"✅ {emp.full_name}, kelganingiz {now:%H:%M} da belgilandi ({place}, {int(dist)} m).\n"
                                   "Jonli lokatsiyani endi o'chirib qo'yishingiz mumkin.")


@router.post("/reset-password", response_model=schemas.BotResetOut)
def reset_password(data: schemas.BotResetIn, db: Session = Depends(get_db)):
    """Allaqachon bog'langan telegram_id orqali yangi parol o'rnatadi (eski parolni bilish shart emas)."""
    emp = db.query(models.Employee).filter(models.Employee.telegram_id == data.telegram_id).first()
    if not emp:
        return schemas.BotResetOut(ok=False, detail="Bu Telegram hisobi hech qanday xodimga bog'lanmagan")

    emp.hashed_password = get_password_hash(data.new_password)
    emp.enc_password = encrypt_password(data.new_password)
    db.commit()
    return schemas.BotResetOut(ok=True, phone=emp.phone)


@router.get("/attendance-reminder", response_model=schemas.BotAttendanceReminderOut)
def attendance_reminder(db: Session = Depends(get_db)):
    """Har kuni ertalab soat 09:01'da bot orqali avtomatik eslatma yuborish uchun:
    bugun hali 'Ishga keldim' bosmagan xodimlar ro'yxati — shaxsiy xabar
    yuborish uchun telegram_id borlar, va guruhga yuboriladigan tayyor matn."""
    date = datetime.now(_TZ_UZ).strftime("%Y-%m-%d")
    absent = get_absent_employees(db, date)
    personal = [
        schemas.BotAbsentEmployeeOut(telegram_id=e.telegram_id, full_name=e.full_name)
        for e in absent if e.telegram_id
    ]
    return schemas.BotAttendanceReminderOut(
        date=date,
        count=len(absent),
        group_text=build_pending_message_text(absent, date),
        names=[e.full_name for e in absent],
        personal=personal,
    )
