"""
Backend login ni tekshirish.
Foydalanish:  python test_login.py
"""
import os, sys
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal, Base, engine
from app import models
from app.auth import verify_password, get_password_hash

Base.metadata.create_all(bind=engine)
db = SessionLocal()

print("=" * 50)

# 1) Jadval tekshirish
dept_count = db.query(models.Department).count()
emp_count  = db.query(models.Employee).count()
print(f"Departments: {dept_count}")
print(f"Employees  : {emp_count}")

if emp_count == 0:
    print("\n❌ Baza bo'sh! Avval 'python seed.py' ishlatng.")
    db.close(); sys.exit(1)

# 2) +998900000001 xodimini topish
phone = "+998900000001"
emp = db.query(models.Employee).filter(models.Employee.phone == phone).first()
if not emp:
    print(f"\n❌ {phone} topilmadi. Seed qayta ishlating.")
    db.close(); sys.exit(1)

print(f"\nXodim topildi : {emp.full_name}")
print(f"Rol           : {emp.role}")

# 3) Parol tekshirish
for test_pw in ["998900000001", "+998900000001"]:
    ok = verify_password(test_pw, emp.hashed_password)
    print(f"Parol '{test_pw}': {'✅ TO'G'RI' if ok else '❌ XATO'}")

print("=" * 50)

# 4) Barcha parollarni shu onda to'g'ri formatga keltirish
fix = input("\nParollarni to'g'rilash (+ siz)? [y/n]: ").strip().lower()
if fix == "y":
    all_emps = db.query(models.Employee).all()
    for e in all_emps:
        pw = e.phone.lstrip("+")
        e.hashed_password = get_password_hash(pw)
    db.commit()
    print(f"✅ {len(all_emps)} ta xodim paroli yangilandi!")
    emp2 = db.query(models.Employee).filter(models.Employee.phone == phone).first()
    ok2  = verify_password("998900000001", emp2.hashed_password)
    print(f"Qayta tekshiruv: {'✅ OK' if ok2 else '❌ Hali xato'}")

db.close()
