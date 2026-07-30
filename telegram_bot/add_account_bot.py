"""
TMSITI CRM — add_account_bot

Xodimning Telegram hisobini CRM profiliga bog'laydi. Xavfsizlik uchun xodim
ochiq deep-linkda o'z telefon raqami yoki paroli orqali emas, balki CRM
profilida (autentifikatsiyadan o'tgan holda) yaratilgan BIR MARTALIK, tez
muddati tugaydigan `token` orqali aniqlanadi — shuning uchun botga telefon
yoki eski parolni qayta kiritish shart emas.

Oqim:
  1. CRM profili "Telefon va parolni tasdiqlash" tugmasini bosadi → backend
     token yaratadi → https://t.me/<bot>?start=link_<token> ochiladi.
  2. Bot namuna surat bilan birga oq fondagi selfi so'raydi — bu profil
     rasmi sifatida saqlanadi.
  3. Bot Telegramning "Kontakt yuborish" tugmasi orqali HAQIQIY (Telegramga
     ro'yxatdan o'tgan) telefon raqamini so'raydi — qo'lda yozilgan raqam
     qabul qilinmaydi.
  4. Bot yangi parol so'raydi.
  5. Bot backendga {token, verified_phone, new_password, photo_base64,
     telegram_id, telegram_username} yuboradi. Backend token orqali xodimni
     topadi, CRM telefon raqamini haqiqiy raqamga yangilaydi, yangi parolni
     o'rnatadi, profil rasmini saqlaydi va telegram_id/username'ni bog'laydi.
  6. Keyingi safar parolni almashtirish uchun (token shart emas — Telegram
     hisobi allaqachon tasdiqlangan): https://t.me/<bot>?start=reset

Muhit o'zgaruvchilari:
  TELEGRAM_BOT_TOKEN   — @BotFather bergan token
  BACKEND_URL          — masalan http://backend:8000 (docker tarmog'ida)
  BOT_INTERNAL_SECRET  — backenddagi BOT_INTERNAL_SECRET bilan bir xil bo'lishi shart
"""
import base64
import logging
import os
import re

from dotenv import load_dotenv
load_dotenv()  # mahalliy ishga tushirishda shu papkadagi .env'ni o'qiydi (Dockerda muhit o'zgaruvchilari orqali beriladi)

import httpx
from telegram import KeyboardButton, ReplyKeyboardMarkup, ReplyKeyboardRemove, Update
from telegram.ext import (
    Application, ApplicationBuilder, CommandHandler, ContextTypes,
    ConversationHandler, MessageHandler, filters,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("add_account_bot")

BOT_TOKEN   = os.environ["TELEGRAM_BOT_TOKEN"]
BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:8000").rstrip("/")
BOT_SECRET  = os.environ["BOT_INTERNAL_SECRET"]

SAMPLE_PHOTO_PATH = os.path.join(os.path.dirname(__file__), "sample_photo.jpg")

PHOTO, CONTACT, NEW_PASSWORD_LINK, NEW_PASSWORD_RESET = range(4)

_HEADERS = {"X-Bot-Secret": BOT_SECRET}

_CONTACT_KEYBOARD = ReplyKeyboardMarkup(
    [[KeyboardButton("📱 Telefon raqamni yuborish", request_contact=True)]],
    resize_keyboard=True, one_time_keyboard=True,
)


def _clean_phone(text: str) -> str:
    """Faqat raqam va boshidagi '+' ni qoldiradi: '+998 90 123-45-67' -> '+998901234567'."""
    digits = re.sub(r"[^0-9]", "", text.strip())
    return f"+{digits}" if digits else ""


async def _try_delete(update: Update):
    """Parol yozilgan xabarni suhbatdan o'chiradi (maxfiylik uchun) — muvaffaqiyatsiz bo'lsa jim o'tkaziladi."""
    try:
        await update.message.delete()
    except Exception:
        pass


# ─── /start ────────────────────────────────────────────────────────────────

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    payload = context.args[0] if context.args else ""

    if payload == "reset":
        await update.message.reply_text(
            "🔑 Parolni o'zgartirish\n\n"
            "Yangi parolingizni yozing (kamida 4 belgi):"
        )
        return NEW_PASSWORD_RESET

    if payload.startswith("link_") and len(payload) > len("link_"):
        context.user_data["token"] = payload[len("link_"):]
        caption = (
            "👋 TMSITI CRM — hisobni bog'lash\n\n"
            "📸 Avval profilingiz uchun surat kerak. Namunadagi kabi — "
            "oq (yoki och) fonda, yuzingiz aniq ko'rinadigan selfi yuboring:"
        )
        if os.path.isfile(SAMPLE_PHOTO_PATH):
            with open(SAMPLE_PHOTO_PATH, "rb") as f:
                await update.message.reply_photo(photo=f, caption=caption)
        else:
            log.warning("sample_photo.jpg topilmadi — namunasiz davom etilmoqda")
            await update.message.reply_text(caption)
        return PHOTO

    await update.message.reply_text(
        "⚠️ Bu botni to'g'ridan-to'g'ri emas, CRM profilingiz sahifasidagi "
        "\"Telefon va parolni tasdiqlash\" tugmasi orqali oching."
    )
    return ConversationHandler.END


async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    await update.message.reply_text("Bekor qilindi.", reply_markup=ReplyKeyboardRemove())
    context.user_data.clear()
    return ConversationHandler.END


# ─── Profil surati ────────────────────────────────────────────────────────────

async def receive_photo(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    photo = update.message.photo[-1]  # eng katta o'lchamdagisi
    tg_file = await photo.get_file()
    photo_bytes = await tg_file.download_as_bytearray()
    b64 = base64.b64encode(photo_bytes).decode()
    context.user_data["photo_base64"] = f"data:image/jpeg;base64,{b64}"

    await update.message.reply_text(
        "✅ Surat qabul qilindi.\n\n"
        "📱 Endi Telegramda ro'yxatdan o'tgan telefon raqamingizni tasdiqlash uchun "
        "pastdagi tugmani bosing:",
        reply_markup=_CONTACT_KEYBOARD,
    )
    return CONTACT


async def remind_send_photo(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    await update.message.reply_text("Iltimos, rasm (selfi) yuboring — matn emas.")
    return PHOTO


# ─── Hisobni bog'lash oqimi ──────────────────────────────────────────────────

async def receive_contact(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    contact = update.message.contact
    # Faqat foydalanuvchining o'z kontakti qabul qilinadi (boshqa birovning
    # vizitkasini ulashishi bilan hisob bog'lanib qolmasligi uchun).
    if contact.user_id and contact.user_id != update.effective_user.id:
        await update.message.reply_text("Iltimos, faqat o'zingizning telefon raqamingizni yuboring.", reply_markup=_CONTACT_KEYBOARD)
        return CONTACT

    verified_phone = _clean_phone(contact.phone_number)
    if len(verified_phone) < 10:
        await update.message.reply_text("Telefon raqamini o'qib bo'lmadi. Qaytadan urinib ko'ring:", reply_markup=_CONTACT_KEYBOARD)
        return CONTACT

    context.user_data["verified_phone"] = verified_phone
    await update.message.reply_text(
        "🔑 Endi yangi parolingizni o'rnating (kamida 4 belgi):",
        reply_markup=ReplyKeyboardRemove(),
    )
    return NEW_PASSWORD_LINK


async def remind_use_button(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Foydalanuvchi qo'lda matn yozsa — qabul qilinmaydi, faqat tugma orqali."""
    await update.message.reply_text(
        "Iltimos, telefon raqamingizni qo'lda yozmang — pastdagi tugmani bosib yuboring:",
        reply_markup=_CONTACT_KEYBOARD,
    )
    return CONTACT


async def receive_new_password_link(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    new_password = update.message.text
    await _try_delete(update)

    if len(new_password) < 4:
        await update.message.reply_text("Parol juda qisqa. Kamida 4 belgidan iborat parol kiriting:")
        return NEW_PASSWORD_LINK

    token          = context.user_data.get("token", "")
    verified_phone = context.user_data.get("verified_phone", "")
    photo_base64   = context.user_data.get("photo_base64")
    user = update.effective_user
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{BACKEND_URL}/bot/link-account",
                headers=_HEADERS,
                json={
                    "token": token,
                    "verified_phone": verified_phone,
                    "new_password": new_password,
                    "photo_base64": photo_base64,
                    "telegram_id": user.id,
                    "telegram_username": user.username,
                },
            )
        data = resp.json()
    except Exception:
        log.exception("link-account so'rovida xatolik")
        await update.message.reply_text("⚠️ Serverga ulanishda xatolik yuz berdi. Birozdan so'ng qayta urinib ko'ring.")
        return ConversationHandler.END

    if data.get("ok"):
        await update.message.reply_text(
            f"✅ Tabriklaymiz, {data.get('full_name', '')}!\n"
            "Hisobingiz Telegramga bog'landi.\n\n"
            f"📱 Login (telefon): {data.get('phone', verified_phone)}\n"
            f"🔑 Parol: {new_password}"
        )
    else:
        await update.message.reply_text(f"❌ {data.get('detail', 'Xatolik yuz berdi')}.")

    context.user_data.clear()
    return ConversationHandler.END


# ─── Parolni o'zgartirish oqimi (allaqachon bog'langan xodim uchun) ──────────

async def receive_new_password_reset(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    new_password = update.message.text
    await _try_delete(update)

    if len(new_password) < 4:
        await update.message.reply_text("Parol juda qisqa. Kamida 4 belgidan iborat parol kiriting:")
        return NEW_PASSWORD_RESET

    user = update.effective_user
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{BACKEND_URL}/bot/reset-password",
                headers=_HEADERS,
                json={"telegram_id": user.id, "new_password": new_password},
            )
        data = resp.json()
    except Exception:
        log.exception("reset-password so'rovida xatolik")
        await update.message.reply_text("⚠️ Serverga ulanishda xatolik yuz berdi. Birozdan so'ng qayta urinib ko'ring.")
        return ConversationHandler.END

    if data.get("ok"):
        await update.message.reply_text(
            "✅ Parolingiz muvaffaqiyatli yangilandi!\n\n"
            f"📱 Login (telefon): {data.get('phone')}\n"
            f"🔑 Parol: {new_password}"
        )
    else:
        await update.message.reply_text(
            f"❌ {data.get('detail', 'Xatolik yuz berdi')}.\n\n"
            "Avval CRM profilingizdagi \"Telefon va parolni tasdiqlash\" tugmasi orqali hisobingizni bog'lang."
        )

    context.user_data.clear()
    return ConversationHandler.END


def build_app() -> Application:
    app = ApplicationBuilder().token(BOT_TOKEN).build()

    conv = ConversationHandler(
        entry_points=[CommandHandler("start", start)],
        states={
            PHOTO: [
                MessageHandler(filters.PHOTO, receive_photo),
                MessageHandler(filters.TEXT & ~filters.COMMAND, remind_send_photo),
            ],
            CONTACT: [
                MessageHandler(filters.CONTACT, receive_contact),
                MessageHandler(filters.TEXT & ~filters.COMMAND, remind_use_button),
            ],
            NEW_PASSWORD_LINK:  [MessageHandler(filters.TEXT & ~filters.COMMAND, receive_new_password_link)],
            NEW_PASSWORD_RESET: [MessageHandler(filters.TEXT & ~filters.COMMAND, receive_new_password_reset)],
        },
        fallbacks=[CommandHandler("cancel", cancel)],
    )
    app.add_handler(conv)
    return app


if __name__ == "__main__":
    log.info("add_account_bot ishga tushmoqda...")
    build_app().run_polling(allowed_updates=Update.ALL_TYPES)
