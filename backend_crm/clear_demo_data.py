"""
Prezentatsiya oldidan demo ma'lumotlarni tozalash skripti.

Joriy oy uchun quyidagilarni o'chiradi:
  - scores         (kadr/ijro/bo'lim/direktor ballari + yuklangan hisobot fayllari)
  - attendances    (GPS orqali keldi-keti belgilash)
  - tabel_records  (kunlik tabel kodlari: 8, 4, X va h.k.)

Xodimlar, bo'limlar va boshqa hech narsaga tegilmaydi.

Ishlatish:
  python clear_demo_data.py                  -> faqat ko'rsatadi (DRY RUN), hech narsa o'chmaydi
  python clear_demo_data.py --confirm         -> joriy oy uchun haqiqatdan o'chiradi
  python clear_demo_data.py --year 2026 --month 6 --confirm   -> aniq oy uchun
"""
import sys, os, argparse
from datetime import datetime
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal
from app import models


def main():
    parser = argparse.ArgumentParser(description="Demo ball/davomat ma'lumotlarini tozalash")
    parser.add_argument("--year",  type=int, default=datetime.now().year)
    parser.add_argument("--month", type=int, default=datetime.now().month)
    parser.add_argument("--confirm", action="store_true",
                         help="Bu flag bo'lmasa skript faqat ko'rsatadi, hech narsa o'chmaydi")
    args = parser.parse_args()

    year, month = args.year, args.month
    month_prefix = f"{year}-{month:02d}-"  # attendances.date "YYYY-MM-DD" formatda

    db = SessionLocal()
    try:
        scores_q     = db.query(models.Score).filter(
            models.Score.year == year, models.Score.month == month,
        )
        attendance_q = db.query(models.Attendance).filter(
            models.Attendance.date.like(f"{month_prefix}%"),
        )
        tabel_q      = db.query(models.TabelRecord).filter(
            models.TabelRecord.year == year, models.TabelRecord.month == month,
        )

        scores_count     = scores_q.count()
        attendance_count = attendance_q.count()
        tabel_count      = tabel_q.count()

        print(f"\n=== {year}-{month:02d} uchun topilgan yozuvlar ===")
        print(f"  scores (ball/hisobot)      : {scores_count}")
        print(f"  attendances (GPS davomat)  : {attendance_count}")
        print(f"  tabel_records (kunlik kod) : {tabel_count}")
        print(f"  JAMI                       : {scores_count + attendance_count + tabel_count}\n")

        if not args.confirm:
            print("DRY RUN: hech narsa o'chirilmadi.")
            print("Haqiqatdan o'chirish uchun --confirm bilan ishga tushiring:")
            print(f"  python clear_demo_data.py --year {year} --month {month} --confirm\n")
            return

        if scores_count + attendance_count + tabel_count == 0:
            print("O'chiriladigan narsa yo'q.")
            return

        deleted_scores     = scores_q.delete(synchronize_session=False)
        deleted_attendance = attendance_q.delete(synchronize_session=False)
        deleted_tabel      = tabel_q.delete(synchronize_session=False)
        db.commit()

        print("=== Tozalandi ===")
        print(f"  scores       : {deleted_scores} ta o'chirildi")
        print(f"  attendances  : {deleted_attendance} ta o'chirildi")
        print(f"  tabel_records: {deleted_tabel} ta o'chirildi")
        print("\nTizim shu oy uchun 'bo'sh' holatga qaytdi.\n")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
