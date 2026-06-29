"""
Barcha jadvallar va enum turlarini o'chirib qayta yaratadi.
Ishlatish: python reset_db.py
"""
import sys, os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import text
from app.database import Base, engine
from app import models  # noqa: F401 – triggers model registration

def reset():
    print("[1] Jadvallar o'chirilmoqda...")
    with engine.begin() as conn:
        conn.execute(text(
            "DROP TABLE IF EXISTS tabel_records, scores, employees, departments CASCADE"
        ))
        conn.execute(text("DROP TYPE IF EXISTS role_enum CASCADE"))
        conn.execute(text("DROP TYPE IF EXISTS dept_type_enum CASCADE"))
    print("[OK] Eski jadvallar o'chirildi")

    print("[2] Yangi jadvallar yaratilmoqda...")
    Base.metadata.create_all(bind=engine)
    print("[OK] Barcha jadvallar yaratildi")

if __name__ == "__main__":
    reset()
