"""Bir martalik qo'lda tekshirish uchun: kunlik davomat-eslatma rasmini
haqiqiy (yoki namunaviy) ma'lumot bilan berilgan telegram_id'ga yuboradi —
guruhga yuborilishini kutmasdan, natijani darhol ko'rish uchun.

Ishlatish (konteyner ichida):
    docker compose -f docker-compose.prod.yml exec telegram_bot python test_send_reminder.py <telegram_id>
    docker compose -f docker-compose.prod.yml exec telegram_bot python test_send_reminder.py <telegram_id> --dummy
"""
import asyncio
import datetime as dt
import os
import sys

import httpx
from telegram import Bot

from reminder_image import build_reminder_image

_WEEKDAYS_UZ = ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba"]

_DUMMY_NAMES = [f"Test Xodimov {i}." for i in range(1, 71)]


async def main():
    if len(sys.argv) < 2:
        print("Ishlatish: python test_send_reminder.py <telegram_id> [--dummy]")
        sys.exit(1)
    chat_id = int(sys.argv[1])
    dummy = "--dummy" in sys.argv

    bot_token = os.environ["TELEGRAM_BOT_TOKEN"]
    backend_url = os.getenv("BACKEND_URL", "http://backend:8000").rstrip("/")
    bot_secret = os.environ["BOT_INTERNAL_SECRET"]

    if dummy:
        date_obj = dt.datetime.now()
        count, names = 70, _DUMMY_NAMES
    else:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(f"{backend_url}/bot/attendance-reminder", headers={"X-Bot-Secret": bot_secret})
        data = resp.json()
        date_obj = dt.datetime.strptime(data["date"], "%Y-%m-%d")
        count, names = data["count"], data["names"]
        print(f"Bugungi haqiqiy ma'lumot: {count} ta xodim 'Ishga keldim' bosmagan.")

    image_bytes = build_reminder_image(
        date_str=date_obj.strftime("%d-%m-%Y"),
        weekday=_WEEKDAYS_UZ[date_obj.weekday()],
        count=count,
        names=names,
    )
    bot = Bot(bot_token)
    await bot.send_photo(chat_id=chat_id, photo=image_bytes)
    print("Yuborildi.")


if __name__ == "__main__":
    asyncio.run(main())
