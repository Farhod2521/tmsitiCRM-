"""Zamdirektorga boradigan "🕘 Davomat vaqti to'g'rilandi" Telegram xabarini
O'ZINGIZGA yuborib ko'rish. Bazaga HECH NARSA yozilmaydi — xabar haqiqiy
yuborishdagi kod (correction_message) bilan yasaladi, faqat sizga boradi.

Backend konteynerida:

  docker compose -f docker-compose.prod.yml exec backend python test_tuzatish_xabar.py
      → 994252521 raqamiga: o'zingiz uchun bugungi sana, 10:21 → 09:00 namunasi

  ... python test_tuzatish_xabar.py --xodim 901234567 --sana 2026-10-12 --eski 10:21 --yangi 09:00 \\
          --sabab "Oilaviy sabab, ariza bor"
      → boshqa xodimning shu kungi haqiqiy izohi (ariza) bilan

  ... python test_tuzatish_xabar.py --korsat
      → yubormasdan, xabar matnini shu yerda chiqaradi

Parametrlar:
  --phone   xabar kimga boradi (Telegram bog'langan bo'lishi kerak), standart 994252521
  --xodim   vaqti "to'g'rilangan" xodim (standart — --phone egasi)
  --sana    YYYY-MM-DD (standart — bugun)
  --eski / --yangi   HH:MM (eski bo'sh bo'lsa: --eski "")
  --sabab   to'g'rilash sababi
"""
import argparse
import re
import sys
from datetime import datetime, timedelta, timezone

from app.database import SessionLocal
from app import models
from app.routers.daily import correction_message, correction_keyboard, _day_note, _late
from app.telegram import telegram_api

TZ_UZ = timezone(timedelta(hours=5))


def find(db, phone: str) -> models.Employee:
    want = re.sub(r"\D", "", phone or "")[-9:]
    for e in db.query(models.Employee).all():
        if re.sub(r"\D", "", e.phone or "").endswith(want):
            return e
    sys.exit(f"❌ {phone} raqamli xodim topilmadi")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--phone", default="994252521")
    ap.add_argument("--xodim")
    ap.add_argument("--sana", default=datetime.now(TZ_UZ).strftime("%Y-%m-%d"))
    ap.add_argument("--eski", default="10:21")
    ap.add_argument("--yangi", default="09:00")
    ap.add_argument("--sabab", default="Sababli kechikish — xodim izoh yozgan, ariza ko'rib chiqilgan (TEST)")
    ap.add_argument("--korsat", action="store_true", help="yubormasdan matnni chiqarish")
    a = ap.parse_args()

    db = SessionLocal()
    try:
        me = find(db, a.phone)
        emp = find(db, a.xodim) if a.xodim else me
        eski = a.eski or None
        # Saqlanmaydigan (vaqtinchalik) yozuv — faqat xabar matni uchun
        c = models.AttendanceCorrection(
            employee_id=emp.id, date=a.sana, old_check_in=eski, new_check_in=a.yangi, source="qolda",
            reason=a.sabab, corrected_by=me.id, created_at=datetime.utcnow(), status="kutilmoqda",
            late_before=_late(a.sana, eski), late_after=_late(a.sana, a.yangi),
            note_text=_day_note(db, emp.id, a.sana),
        )
        c.employee, c.corrector = emp, me
        text = correction_message(c)
        print("─" * 60)
        print(re.sub(r"</?[bi]>", "", text))
        print("─" * 60)
        if a.korsat:
            return
        if not me.telegram_id:
            sys.exit(f"❌ {me.full_name} Telegram'ga bog'lanmagan — avval profil orqali bog'lang")
        # Tugmalar ham xuddi haqiqiydagidek; test (id=0) bosilsa — bot "Test xabar" deb javob beradi
        res = telegram_api("sendMessage", {"chat_id": me.telegram_id, "text": "🧪 <i>TEST xabar</i>\n\n" + text,
                                           "parse_mode": "HTML", "reply_markup": correction_keyboard(0)})
        print(f"✅ Yuborildi → {me.full_name} (telegram_id={me.telegram_id})" if res
              else "❌ Yuborilmadi — TELEGRAM_BOT_TOKEN va botga /start bosilganini tekshiring")
    finally:
        db.rollback()   # hech narsa saqlanmaydi
        db.close()


if __name__ == "__main__":
    main()
