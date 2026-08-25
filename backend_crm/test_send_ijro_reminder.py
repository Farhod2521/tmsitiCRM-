"""Bir martalik qo'lda tekshirish uchun: IJRO 'muddati eng kam qolgan 10 ta
topshiriq' rasmini haqiqiy ma'lumot bilan berilgan telegram_id'ga yuboradi —
guruh sozlamasiga (TELEGRAM_CHAT_ID) tegmasdan, natijani darhol shaxsiy chatda
ko'rish uchun.

Ishlatish (konteyner ichida):
    docker compose -f docker-compose.prod.yml exec backend python test_send_ijro_reminder.py <telegram_id>
"""
import sys

from app.database import SessionLocal
from app.routers.ijro_docs import _urgent_task_rows
from app.ijro_reminder_image import build_ijro_reminder_image
from app.telegram import send_telegram_photo_to


def main():
    if len(sys.argv) < 2:
        print("Ishlatish: python test_send_ijro_reminder.py <telegram_id>")
        sys.exit(1)
    chat_id = int(sys.argv[1])

    db = SessionLocal()
    try:
        tasks = _urgent_task_rows(db, limit=10)
    finally:
        db.close()

    if not tasks:
        print("Hozircha xodimga biriktirilgan faol topshiriq yo'q — rasm bo'sh shablon bilan yuboriladi.")

    print(f"Topilgan topshiriqlar: {len(tasks)} ta")
    image_bytes = build_ijro_reminder_image(tasks)
    ok = send_telegram_photo_to(chat_id, image_bytes)
    print("Yuborildi." if ok else "Yuborib bo'lmadi — TELEGRAM_BOT_TOKEN yoki chat_id'ni tekshiring.")


if __name__ == "__main__":
    main()
