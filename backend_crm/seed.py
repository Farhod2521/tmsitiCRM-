"""
Bazani tozalab, barcha xodimlarni employee.xlsx dan qayta yozish.
Ishlatish:  python seed.py  yoki  python seed.py --reset
"""
import sys, os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal, Base, engine
from app import models
from app.auth import get_password_hash

# ── Departmentlar (tartib bo'yicha) ──────────────────────────────────────────
DEPARTMENTS = [
    {"id": 1,  "name": "Rahbariyat",                                                          "dept_type": "rahbariyat", "order_num": 1},
    {"id": 2,  "name": "Yuridik bo'lim",                                                       "dept_type": "bolim",       "order_num": 2},
    {"id": 3,  "name": "Buxgalteriya va moliya bo'limi",                                       "dept_type": "bolim",       "order_num": 3},
    {"id": 4,  "name": "Inson resurslarini rivojlantirish bo'limi",                            "dept_type": "bolim",       "order_num": 4},
    {"id": 5,  "name": "Texnik me'yorlash boshqarmasi",                                        "dept_type": "boshqarma",   "order_num": 5},
    {"id": 6,  "name": "Normativ hujjatlarni tizimlashtirish va atamalar bo'limi",             "dept_type": "bolim",       "order_num": 6},
    {"id": 7,  "name": "Xalqaro normalarni uyg'unlashtirish boshqarmasi",                      "dept_type": "boshqarma",   "order_num": 7},
    {"id": 8,  "name": "Standartlashtirish boshqarmasi",                                       "dept_type": "boshqarma",   "order_num": 8},
    {"id": 9,  "name": "Muvofiqlikni baholash boshqarmasi",                                    "dept_type": "boshqarma",   "order_num": 9},
    {"id": 10, "name": "Energoaudit va energosamaradorlik ekspertizasi bo'limi",               "dept_type": "bolim",       "order_num": 10},
    {"id": 11, "name": "Ilmiy-tadqiqotlar va innovatsiyalar bo'limi",                          "dept_type": "bolim",       "order_num": 11},
    {"id": 12, "name": "Ta'lim xizmatlarini ko'rsatish bo'limi",                               "dept_type": "bolim",       "order_num": 12},
    {"id": 13, "name": "Xalqaro aloqalar va marketing bo'limi",                                "dept_type": "bolim",       "order_num": 13},
    {"id": 14, "name": "Ijro nazorati bo'limi",                                                "dept_type": "bolim",       "order_num": 14},
    {"id": 15, "name": "Qurilishda narxlarni shakllantirish bo'limi",                          "dept_type": "bolim",       "order_num": 15},
    {"id": 16, "name": "Axborot texnologiyalarini joriy etish bo'limi",                        "dept_type": "bolim",       "order_num": 16},
    {"id": 17, "name": "Shaharsozlik sohasida raqamli texnologiyalarni rivojlantirish bo'limi","dept_type": "bolim",       "order_num": 17},
    {"id": 18, "name": "Komplaens nazorat xizmati",                                            "dept_type": "xizmat",      "order_num": 18},
    {"id": 19, "name": "Loyihalashtirish bo'limi",                                             "dept_type": "bolim",       "order_num": 19},
    {"id": 20, "name": "Texnik va xizmat ko'rsatuvchi xodimlar",                               "dept_type": "xizmat",      "order_num": 20},
]

# Superadmin alohida
SUPERADMIN = {
    "full_name": "Superadmin",
    "position": "Tizim administratori",
    "department_id": None,
    "work_rate": 1.0,
    "phone": "+998900000000",
    "role": "superadmin",
}

# ── Xodimlar (Excel ma'lumotlari asosida) ────────────────────────────────────
# phone: +99890100NNNN  (NNNN = tartib raqami)
# password = phone (+ belgisiz)
EMPLOYEES = [
    # === Rahbariyat (dept_id=1) — superadmin/direktor/zamdirektor huquqlar ===
    {"full_name":"R.Kuchkarov",        "position":"Direktor",                             "dept_id":1,  "rate":1.0, "ph":"+998901000001","role":"direktor"},
    {"full_name":"Abduholiqov A.",      "position":"Direktorning birinchi o'rinbosari",    "dept_id":1,  "rate":1.0, "ph":"+998901000002","role":"zamdirektor"},
    {"full_name":"Dusatov B.",          "position":"Direktorning o'rinbosari",             "dept_id":1,  "rate":1.0, "ph":"+998901000003","role":"zamdirektor"},
    {"full_name":"Xodjayev B.",         "position":"Maslahatchi",                          "dept_id":1,  "rate":1.0, "ph":"+998901000004","role":"zamdirektor"},

    # === Yuridik bo'lim (dept_id=2) ===
    {"full_name":"Ismatov U.",          "position":"Bo'lim boshlig'i",                     "dept_id":2,  "rate":1.0, "ph":"+998901000005","role":"bolim_boshligi"},
    {"full_name":"Tursunov K.",         "position":"Yuriskonsult",                         "dept_id":2,  "rate":1.0, "ph":"+998901000006","role":"xodim"},

    # === Buxgalteriya va moliya bo'limi (dept_id=3) ===
    {"full_name":"Rixsiyeva F.",        "position":"Bosh hisobchi",                        "dept_id":3,  "rate":1.0, "ph":"+998901000007","role":"bolim_boshligi"},
    {"full_name":"Xudayshukurov O.",    "position":"Mutaxassis",                           "dept_id":3,  "rate":1.0, "ph":"+998901000008","role":"xodim"},

    # === Inson resurslarini rivojlantirish bo'limi (dept_id=4) ===
    {"full_name":"Tulyaganova N.",      "position":"Bo'lim boshlig'i",                     "dept_id":4,  "rate":1.0, "ph":"+998901000009","role":"bolim_boshligi"},
    {"full_name":"Ismatullayeva N.",    "position":"Bosh mutaxassis",                      "dept_id":4,  "rate":1.0, "ph":"+998901000010","role":"xodim"},

    # === Texnik me'yorlash boshqarmasi (dept_id=5) ===
    {"full_name":"Jo'rayev D.",         "position":"Boshqarma boshlig'i",                  "dept_id":5,  "rate":1.0, "ph":"+998901000011","role":"boshqarma_boshligi"},
    {"full_name":"Niyazov M.",          "position":"Bosh mutaxassis",                      "dept_id":5,  "rate":1.0, "ph":"+998901000012","role":"xodim"},
    {"full_name":"Mirbabayeva D.",      "position":"Bosh mutaxassis",                      "dept_id":5,  "rate":1.0, "ph":"+998901000013","role":"xodim"},
    {"full_name":"Safarov F.",          "position":"Bosh mutaxassis",                      "dept_id":5,  "rate":1.0, "ph":"+998901000014","role":"xodim"},
    {"full_name":"Baltayev J.",         "position":"Bosh mutaxassis",                      "dept_id":5,  "rate":1.0, "ph":"+998901000015","role":"xodim"},
    {"full_name":"Magdanov M.",         "position":"Bosh mutaxassis",                      "dept_id":5,  "rate":1.0, "ph":"+998901000016","role":"xodim"},
    {"full_name":"Islamova N.",         "position":"Bosh mutaxassis",                      "dept_id":5,  "rate":1.0, "ph":"+998901000017","role":"xodim"},
    {"full_name":"Ibragimov A.",        "position":"Bosh mutaxassis",                      "dept_id":5,  "rate":1.0, "ph":"+998901000018","role":"xodim"},
    {"full_name":"Naimov I.",           "position":"Yetakchi mutaxassis",                  "dept_id":5,  "rate":1.0, "ph":"+998901000019","role":"xodim"},
    {"full_name":"Xaydarov A.",         "position":"Mutaxassis",                           "dept_id":5,  "rate":1.0, "ph":"+998901000020","role":"xodim"},

    # === Normativ hujjatlar bo'limi (dept_id=6) ===
    {"full_name":"Tadjixodjayeva S.",   "position":"Bo'lim boshlig'i",                     "dept_id":6,  "rate":1.0, "ph":"+998901000021","role":"bolim_boshligi"},
    {"full_name":"Mansurov Sh.",        "position":"Bosh mutaxassis",                      "dept_id":6,  "rate":1.0, "ph":"+998901000022","role":"xodim"},
    {"full_name":"Meliyeva L.",         "position":"Bosh mutaxassis",                      "dept_id":6,  "rate":1.0, "ph":"+998901000023","role":"xodim"},
    {"full_name":"Anvarov D.",          "position":"Yetakchi mutaxassis",                  "dept_id":6,  "rate":1.0, "ph":"+998901000024","role":"xodim"},

    # === Xalqaro normalar boshqarmasi (dept_id=7) ===
    {"full_name":"Nurmirzayev A.",      "position":"Boshqarma boshlig'i",                  "dept_id":7,  "rate":1.0, "ph":"+998901000025","role":"boshqarma_boshligi"},
    {"full_name":"Sobirov M.",          "position":"Bosh mutaxassis",                      "dept_id":7,  "rate":1.0, "ph":"+998901000026","role":"xodim"},
    {"full_name":"Abduraimova X.",      "position":"Bosh mutaxassis",                      "dept_id":7,  "rate":1.0, "ph":"+998901000027","role":"xodim"},
    {"full_name":"Nabiyeva Sh.",        "position":"Yetakchi mutaxassis",                  "dept_id":7,  "rate":1.0, "ph":"+998901000028","role":"xodim"},
    {"full_name":"Adashova M.",         "position":"Yetakchi mutaxassis",                  "dept_id":7,  "rate":1.0, "ph":"+998901000029","role":"xodim"},

    # === Standartlashtirish boshqarmasi (dept_id=8) ===
    {"full_name":"Golubeva S.",         "position":"Boshqarma boshlig'i",                  "dept_id":8,  "rate":1.0, "ph":"+998901000030","role":"boshqarma_boshligi"},
    {"full_name":"Mustafoyeva N.",      "position":"Bosh mutaxassis",                      "dept_id":8,  "rate":1.0, "ph":"+998901000031","role":"xodim"},
    {"full_name":"Akromov F.",          "position":"Bosh mutaxassis",                      "dept_id":8,  "rate":1.0, "ph":"+998901000032","role":"xodim"},
    {"full_name":"Nasriddinova Z.",     "position":"Bosh mutaxassis",                      "dept_id":8,  "rate":1.0, "ph":"+998901000033","role":"xodim"},
    {"full_name":"Kenjayeva M.",        "position":"Yetakchi mutaxassis",                  "dept_id":8,  "rate":1.0, "ph":"+998901000034","role":"xodim"},
    {"full_name":"Yoqubjonova M.",      "position":"Yetakchi mutaxassis",                  "dept_id":8,  "rate":1.0, "ph":"+998901000035","role":"xodim"},
    {"full_name":"Rixsiboyev N.",       "position":"Mutaxassis",                           "dept_id":8,  "rate":1.0, "ph":"+998901000036","role":"xodim"},
    {"full_name":"Xazratkulova G.",     "position":"Mutaxassis",                           "dept_id":8,  "rate":1.0, "ph":"+998901000037","role":"xodim"},
    {"full_name":"Nosirov A.",          "position":"Mutaxassis",                           "dept_id":8,  "rate":1.0, "ph":"+998901000038","role":"xodim"},
    {"full_name":"Baratova F.",         "position":"Mutaxassis",                           "dept_id":8,  "rate":0.5, "ph":"+998901000039","role":"xodim"},
    {"full_name":"Yuldashbayev A.",     "position":"Mutaxassis",                           "dept_id":8,  "rate":1.0, "ph":"+998901000040","role":"xodim"},
    {"full_name":"Tog'aeva S.",         "position":"Mutaxassis",                           "dept_id":8,  "rate":1.0, "ph":"+998901000041","role":"xodim"},

    # === Muvofiqlikni baholash boshqarmasi (dept_id=9) ===
    {"full_name":"Mirsaidov J.",        "position":"Boshqarma boshlig'i",                  "dept_id":9,  "rate":1.0, "ph":"+998901000042","role":"boshqarma_boshligi"},
    {"full_name":"Xamidov M.",          "position":"Organ rahbari",                        "dept_id":9,  "rate":1.0, "ph":"+998901000043","role":"xodim"},
    {"full_name":"Qilichov S.",         "position":"Organ rahbari",                        "dept_id":9,  "rate":1.0, "ph":"+998901000044","role":"xodim"},
    {"full_name":"G'ozibekov S.",       "position":"Laboratoriya boshlig'i",               "dept_id":9,  "rate":1.0, "ph":"+998901000045","role":"xodim"},
    {"full_name":"Bayseytov A.",        "position":"Bosh mutaxassis",                      "dept_id":9,  "rate":1.0, "ph":"+998901000046","role":"xodim"},
    {"full_name":"Otajanov R.",         "position":"Bosh mutaxassis",                      "dept_id":9,  "rate":1.0, "ph":"+998901000047","role":"xodim"},
    {"full_name":"Qilichov S. (2)",     "position":"Yetakchi mutaxassis",                  "dept_id":9,  "rate":1.0, "ph":"+998901000048","role":"xodim"},
    {"full_name":"Norboyev Yo.",        "position":"Mutaxassis",                           "dept_id":9,  "rate":1.0, "ph":"+998901000049","role":"xodim"},
    {"full_name":"Raximov X.",          "position":"Mutaxassis",                           "dept_id":9,  "rate":1.0, "ph":"+998901000050","role":"xodim"},
    {"full_name":"Saparova D.",         "position":"Mutaxassis",                           "dept_id":9,  "rate":1.0, "ph":"+998901000051","role":"xodim"},
    {"full_name":"Jo'rayev A.",         "position":"Mutaxassis",                           "dept_id":9,  "rate":1.0, "ph":"+998901000052","role":"xodim"},
    {"full_name":"Otajonov N.",         "position":"Mutaxassis",                           "dept_id":9,  "rate":1.0, "ph":"+998901000053","role":"xodim"},
    {"full_name":"Nosirov Sh.",         "position":"Mutaxassis",                           "dept_id":9,  "rate":1.0, "ph":"+998901000054","role":"xodim"},

    # === Energoaudit bo'limi (dept_id=10) ===
    {"full_name":"Aliyev A.",           "position":"Bo'lim boshlig'i",                     "dept_id":10, "rate":1.0, "ph":"+998901000055","role":"bolim_boshligi"},
    {"full_name":"Mamedov A.",          "position":"Bosh mutaxassis",                      "dept_id":10, "rate":1.0, "ph":"+998901000056","role":"xodim"},
    {"full_name":"Raximov F.",          "position":"Yetakchi mutaxassis",                  "dept_id":10, "rate":1.0, "ph":"+998901000057","role":"xodim"},
    {"full_name":"Mazitmuratov A.",     "position":"Mutaxassis",                           "dept_id":10, "rate":1.0, "ph":"+998901000058","role":"xodim"},

    # === Ilmiy-tadqiqotlar bo'limi (dept_id=11) ===
    {"full_name":"Omonxonova M.",       "position":"Yetakchi mutaxassis",                  "dept_id":11, "rate":1.0, "ph":"+998901000059","role":"xodim"},
    {"full_name":"Abdumutaliyev B.",    "position":"Mutaxassis",                           "dept_id":11, "rate":1.0, "ph":"+998901000060","role":"xodim"},

    # === Ta'lim xizmatlari bo'limi (dept_id=12) ===
    {"full_name":"Djumanazarov Sh.",    "position":"Bo'lim boshlig'i",                     "dept_id":12, "rate":1.0, "ph":"+998901000061","role":"bolim_boshligi"},
    {"full_name":"Bekchanova L.",       "position":"Mutaxassis",                           "dept_id":12, "rate":1.0, "ph":"+998901000062","role":"xodim"},

    # === Xalqaro aloqalar va marketing (dept_id=13) ===
    {"full_name":"Tadjibayeva X.",      "position":"Bosh mutaxassis",                      "dept_id":13, "rate":1.0, "ph":"+998901000063","role":"xodim"},

    # === Ijro nazorati bo'limi (dept_id=14) ===
    {"full_name":"Jovliyev A.",         "position":"Bo'lim boshlig'i",                     "dept_id":14, "rate":1.0, "ph":"+998901000064","role":"bolim_boshligi"},
    {"full_name":"Jabbarova S.",        "position":"Mutaxassis",                           "dept_id":14, "rate":1.0, "ph":"+998901000065","role":"xodim"},

    # === Qurilishda narxlar bo'limi (dept_id=15) ===
    {"full_name":"Xoliyorov O.",        "position":"Bo'lim boshlig'i",                     "dept_id":15, "rate":1.0, "ph":"+998901000066","role":"bolim_boshligi"},
    {"full_name":"Zaytseva N.",         "position":"Bosh mutaxassis",                      "dept_id":15, "rate":1.0, "ph":"+998901000067","role":"xodim"},
    {"full_name":"Toirov S.",           "position":"Bosh mutaxassis",                      "dept_id":15, "rate":1.0, "ph":"+998901000068","role":"xodim"},
    {"full_name":"Nigmatov Yu.",        "position":"Mutaxassis",                           "dept_id":15, "rate":1.0, "ph":"+998901000069","role":"xodim"},

    # === Axborot texnologiyalari bo'limi (dept_id=16) ===
    {"full_name":"Baratov V.",          "position":"Bo'lim boshlig'i",                     "dept_id":16, "rate":1.0, "ph":"+998901000070","role":"bolim_boshligi"},
    {"full_name":"Abdikarimov F.",      "position":"Bosh mutaxassis",                      "dept_id":16, "rate":1.0, "ph":"+998901000071","role":"xodim"},

    # === Shaharsozlik raqamli texnologiyalari bo'limi (dept_id=17) ===
    {"full_name":"Karimboyev A.",       "position":"Bo'lim boshlig'i",                     "dept_id":17, "rate":1.0, "ph":"+998901000072","role":"bolim_boshligi"},
    {"full_name":"Mahkamov N.",         "position":"Yetakchi mutaxassis",                  "dept_id":17, "rate":1.0, "ph":"+998901000073","role":"xodim"},

    # === Komplaens nazorat xizmati (dept_id=18) ===
    {"full_name":"Kaxxorov U.",         "position":"Bosh mutaxassis",                      "dept_id":18, "rate":1.0, "ph":"+998901000074","role":"xodim"},

    # === Loyihalashtirish bo'limi (dept_id=19) ===
    {"full_name":"Rustamov B.",         "position":"Bo'lim boshlig'i",                     "dept_id":19, "rate":1.0, "ph":"+998901000075","role":"bolim_boshligi"},
    {"full_name":"Ro'zmatov A.",        "position":"Arxitektor",                           "dept_id":19, "rate":1.0, "ph":"+998901000076","role":"xodim"},

    # === Texnik xizmat ko'rsatuvchi xodimlar (dept_id=20) ===
    {"full_name":"Toxtayev K.",         "position":"Yengil avtomobil haydovchisi",         "dept_id":20, "rate":1.0, "ph":"+998901000077","role":"xodim"},
    {"full_name":"Ubaydullayeva D.",    "position":"Farrosh",                              "dept_id":20, "rate":0.5, "ph":"+998901000078","role":"xodim"},
    {"full_name":"Irgasheva F.",        "position":"Farrosh",                              "dept_id":20, "rate":0.5, "ph":"+998901000079","role":"xodim"},
]


def reset_db():
    """Barcha jadvallarni tozalash."""
    print("[...] Jadvallar tozalanmoqda...")
    # Drop order matters: child tables first
    for tbl in reversed(Base.metadata.sorted_tables):
        engine.execute(tbl.delete()) if hasattr(engine, 'execute') else None

    with engine.begin() as conn:
        for tbl in reversed(Base.metadata.sorted_tables):
            conn.execute(tbl.delete())
    print("[OK] Barcha jadvallar bo'shatildi")


def seed(force_reset: bool = False):
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        if force_reset:
            print("[...] Bazani tozalash...")
            with engine.begin() as conn:
                for tbl in reversed(Base.metadata.sorted_tables):
                    conn.execute(tbl.delete())
            print("[OK] Baza tozalandi")

        # ── Departments ──────────────────────────────────────────────────────
        existing_depts = db.query(models.Department).count()
        if force_reset or existing_depts == 0:
            for d in DEPARTMENTS:
                dept = models.Department(
                    id=d["id"],
                    name=d["name"],
                    dept_type=models.DeptTypeEnum(d["dept_type"]),
                    order_num=d["order_num"],
                )
                db.merge(dept)
            db.commit()
            print(f"[OK] {len(DEPARTMENTS)} ta bo'lim/boshqarma qo'shildi")

        # ── Superadmin ────────────────────────────────────────────────────────
        sa = db.query(models.Employee).filter(models.Employee.phone == SUPERADMIN["phone"]).first()
        if not sa:
            pwd = SUPERADMIN["phone"].lstrip("+")
            db.add(models.Employee(
                full_name=SUPERADMIN["full_name"],
                position=SUPERADMIN["position"],
                department_id=SUPERADMIN["department_id"],
                work_rate=SUPERADMIN["work_rate"],
                phone=SUPERADMIN["phone"],
                hashed_password=get_password_hash(pwd),
                role=models.RoleEnum.superadmin,
                is_active=True,
            ))
            db.commit()
            print(f"[OK] Superadmin qo'shildi: {SUPERADMIN['phone']}")

        # ── Employees ─────────────────────────────────────────────────────────
        added = 0
        for e in EMPLOYEES:
            existing = db.query(models.Employee).filter(models.Employee.phone == e["ph"]).first()
            pwd = e["ph"].lstrip("+")
            if existing:
                existing.full_name   = e["full_name"]
                existing.position    = e["position"]
                existing.department_id = e["dept_id"]
                existing.work_rate   = e["rate"]
                existing.hashed_password = get_password_hash(pwd)
                existing.role        = models.RoleEnum(e["role"])
                existing.is_active   = True
            else:
                db.add(models.Employee(
                    full_name=e["full_name"],
                    position=e["position"],
                    department_id=e["dept_id"],
                    work_rate=e["rate"],
                    phone=e["ph"],
                    hashed_password=get_password_hash(pwd),
                    role=models.RoleEnum(e["role"]),
                    is_active=True,
                ))
                added += 1
        db.commit()
        total = db.query(models.Employee).count()
        print(f"[OK] Xodimlar: {total} ta (yangi: {added})")
        print()
        print("=" * 60)
        print("LOGIN MA'LUMOTLARI (parol = telefon, + belgisiz):")
        print("=" * 60)
        print(f"  Superadmin             : +998900000000  /  998900000000")
        print(f"  Direktor (R.Kuchkarov) : +998901000001  /  998901000001")
        print(f"  Zamdirektor            : +998901000002  /  998901000002")
        print(f"  Bolim boshligi (Normativ): +998901000021 / 998901000021")
        print(f"  Bolim boshligi (AT)    : +998901000070  /  998901000070")
        print(f"  Oddiy xodim            : +998901000022  /  998901000022")
        print("=" * 60)

    except Exception as exc:
        db.rollback()
        print(f"[ERROR] {exc}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    force = "--reset" in sys.argv
    seed(force_reset=force)
