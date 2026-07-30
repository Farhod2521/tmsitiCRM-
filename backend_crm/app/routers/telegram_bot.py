"""add_account_bot uchun ichki API — faqat X-Bot-Secret header bilan chaqiriladi.
Bu yerda oddiy foydalanuvchi tokeni (JWT) talab qilinmaydi: xodim kimligi CRM
profilida yaratilgan bir martalik `token` (TelegramLinkToken) orqali aniqlanadi —
telefon raqami yoki parol ochiq deep-linkda yuborilmaydi va tekshirilmaydi."""
from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from ..deps import require_bot_secret
from ..auth import get_password_hash, encrypt_password
from .. import models, schemas

router = APIRouter(prefix="/bot", tags=["Telegram Bot"], dependencies=[Depends(require_bot_secret)])


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
    if not emp or not emp.is_active:
        return schemas.BotLinkOut(ok=False, detail="Hisob topilmadi yoki bloklangan")

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
