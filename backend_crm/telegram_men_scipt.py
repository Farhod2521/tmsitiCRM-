"""Telegram jonli lokatsiya orqali "Ishga keldim" ni bitta xodim (telefon raqami
bo'yicha) uchun tekshirish skripti. Backend konteynerida ishga tushiriladi:

  docker compose -f docker-compose.prod.yml exec backend python telegram_men_scipt.py
      → holat: Telegram bog'langanmi, ish joylari va radiuslar, bugungi davomat

  ... python telegram_men_scipt.py --watch
      → har 3 soniyada bugungi davomatni kuzatadi: telefondan botga jonli lokatsiya
        yuboring va kelgan vaqt yozilishini shu yerda ko'ring (Ctrl+C — chiqish)

  ... python telegram_men_scipt.py --check 41.3045 69.4801
      → shu nuqta qaysi ish joyiga qancha masofada, hududdami (hech narsa yozmaydi)

  ... python telegram_men_scipt.py --simulate 41.3045 69.4801
      → bot yuborgandek to'liq tekshiruvdan o'tkazadi (hududda bo'lsa davomat YOZILADI)

  ... python telegram_men_scipt.py --send
      → bot shu xodimga "📍 Ishga keldim" inline tugmali xabar yuboradi; tugma
        bosilganda bot jonli lokatsiya yuborish yo'riqnomasini beradi

  ... python telegram_men_scipt.py --reset
      → shu xodimning FAQAT BUGUNGI davomat yozuvini o'chiradi (qayta sinash uchun)

Boshqa raqam uchun: --phone 901234567
"""
import argparse
import re
import sys
import time
from datetime import datetime, timedelta, timezone

from app.database import SessionLocal
from app import models
from app.routers.attendance import nearest_work_location, work_locations

DEFAULT_PHONE = "994252521"
TZ_UZ = timezone(timedelta(hours=5))


def digits(s: str) -> str:
    return re.sub(r"\D", "", s or "")


def find_employee(db, phone: str) -> models.Employee:
    want = digits(phone)[-9:]
    for e in db.query(models.Employee).all():
        if digits(e.phone).endswith(want):
            return e
    sys.exit(f"❌ {phone} raqamli xodim topilmadi")


def today() -> str:
    return datetime.now(TZ_UZ).strftime("%Y-%m-%d")


def today_record(db, emp):
    return db.query(models.Attendance).filter(models.Attendance.employee_id == emp.id,
                                              models.Attendance.date == today()).first()


def fmt_record(a) -> str:
    if a is None:
        return "— hali belgilanmagan"
    src = "Telegram (jonli lokatsiya)" if a.source == "telegram" else "Ilova/sayt"
    dist = f", {int(a.distance_m)} m" if a.distance_m is not None else ""
    return f"✅ {a.check_in:%H:%M:%S} — {src}{dist}"


def status(db, emp):
    print("=" * 60)
    print(f"Xodim      : {emp.full_name} ({emp.phone})")
    print(f"Bo'lim     : {emp.department.name if emp.department else '—'}  ·  rol: {emp.role.value}")
    print(f"Telegram   : {'bog`langan, id=' + str(emp.telegram_id) if emp.telegram_id else '❌ BOG`LANMAGAN — avval CRM profilidan Telegramni ulang'}")
    print("Ish joylari (shulardan birining radiusi ichida bo'lsa — qabul qilinadi):")
    for name, lat, lng, r in work_locations(db):
        print(f"   • {name:13} {lat:.6f}, {lng:.6f}   radius {int(r)} m")
    print(f"Bugun ({today()}): {fmt_record(today_record(db, emp))}")
    print("=" * 60)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--phone", default=DEFAULT_PHONE)
    g = ap.add_mutually_exclusive_group()
    g.add_argument("--watch", action="store_true")
    g.add_argument("--check", nargs=2, type=float, metavar=("LAT", "LNG"))
    g.add_argument("--simulate", nargs=2, type=float, metavar=("LAT", "LNG"))
    g.add_argument("--reset", action="store_true")
    g.add_argument("--send", action="store_true")
    args = ap.parse_args()

    db = SessionLocal()
    emp = find_employee(db, args.phone)
    status(db, emp)

    if args.check:
        place, dist, radius, inside = nearest_work_location(db, *args.check)
        print(f"Nuqta {args.check[0]}, {args.check[1]} → eng yaqin: {place}, {int(dist)} m "
              f"(radius {int(radius)} m) — {'✅ HUDUD ICHIDA' if inside else '❌ hududdan tashqarida'}")

    elif args.simulate:
        if not emp.telegram_id:
            sys.exit("❌ Telegram bog'lanmagan — simulyatsiya qilib bo'lmaydi")
        from app.routers.telegram_bot import LiveLocationIn, live_location_checkin
        res = live_location_checkin(LiveLocationIn(
            telegram_id=emp.telegram_id, latitude=args.simulate[0], longitude=args.simulate[1],
            live_period=900, horizontal_accuracy=15, sent_at=int(time.time())), db)
        print(f"Bot javobi [{res.status}]:\n{res.message}")

    elif args.send:
        if not emp.telegram_id:
            sys.exit("❌ Telegram bog'lanmagan — xabar yuborib bo'lmaydi")
        from app.telegram import telegram_api
        res = telegram_api("sendMessage", {
            "chat_id": emp.telegram_id,
            "text": (f"Assalomu alaykum, {emp.full_name}!\n\n"
                     "Ishga kelganingizni belgilash uchun quyidagi tugmani bosing 👇"),
            "reply_markup": {"inline_keyboard": [[{"text": "📍 Ishga keldim", "callback_data": "keldim"}]]},
        })
        print("📨 Xabar yuborildi — telefoningizda tugmani bosing." if res else
              "❌ Yuborilmadi (TELEGRAM_BOT_TOKEN yoki bot bloklanganini tekshiring; backend logida xato bor).")

    elif args.reset:
        a = today_record(db, emp)
        if a is None:
            print("Bugungi yozuv yo'q — o'chiradigan narsa yo'q.")
        else:
            ans = input(f"Bugungi yozuv ({fmt_record(a)}) o'chirilsinmi? [y/N] ").strip().lower()
            if ans == "y":
                db.delete(a); db.commit()
                print("🗑  O'chirildi. Endi botga qayta jonli lokatsiya yuborib sinashingiz mumkin.")
            else:
                print("Bekor qilindi.")

    elif args.watch:
        print("👀 Kuzatilmoqda... Telefondan botga JONLI lokatsiya yuboring (📎 → Joylashuv → Jonli). Ctrl+C — chiqish.")
        last = None
        try:
            while True:
                db.expire_all()
                a = today_record(db, emp)
                cur = fmt_record(a)
                if cur != last:
                    print(f"[{datetime.now(TZ_UZ):%H:%M:%S}] {cur}")
                    last = cur
                time.sleep(3)
        except KeyboardInterrupt:
            print("\nTugadi.")
    db.close()


if __name__ == "__main__":
    main()
