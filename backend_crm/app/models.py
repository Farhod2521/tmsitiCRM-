import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, Enum as SAEnum, DateTime, UniqueConstraint, Text, BigInteger
from sqlalchemy.orm import relationship
from .database import Base


class RoleEnum(str, enum.Enum):
    superadmin          = "superadmin"
    direktor            = "direktor"
    zamdirektor         = "zamdirektor"
    bolim_boshligi      = "bolim_boshligi"
    boshqarma_boshligi  = "boshqarma_boshligi"
    xodim               = "xodim"
    kadr                = "kadr"    # kadrlar bo'limi vakili — kadr_ball beradi
    ijro                = "ijro"    # ijro nazorati vakili  — ijro_ball beradi

    # superadmin-like roles (can see everything)
    @classmethod
    def admin_roles(cls):
        return {cls.superadmin, cls.direktor, cls.zamdirektor}


class EmployeeStatusEnum(str, enum.Enum):
    faol            = "faol"             # oddiy, faol ishlamoqda
    otpuska         = "otpuska"          # otpuskada
    dekret          = "dekret"           # dekret ta'tilida
    shafyor_farrosh = "shafyor_farrosh"  # shofyor/farrosh — davomat/telegram eslatmalariga kiritilmaydi


class DeptTypeEnum(str, enum.Enum):
    rahbariyat  = "rahbariyat"
    bolim       = "bolim"
    boshqarma   = "boshqarma"
    xizmat      = "xizmat"


class WorkLocationEnum(str, enum.Enum):
    vazirlik     = "vazirlik"
    labaratoriya = "labaratoriya"


class Department(Base):
    __tablename__ = "departments"

    id        = Column(Integer, primary_key=True, index=True)
    name      = Column(String(400), nullable=False)
    dept_type = Column(SAEnum(DeptTypeEnum, name="dept_type_enum"), nullable=False)
    order_num = Column(Integer, default=0)

    employees = relationship("Employee", back_populates="department")


class Employee(Base):
    __tablename__ = "employees"

    id              = Column(Integer, primary_key=True, index=True)
    full_name       = Column(String(200), nullable=False)
    position        = Column(String(300), nullable=False)
    department_id   = Column(Integer, ForeignKey("departments.id"), nullable=True)
    work_rate       = Column(Float, default=1.0, nullable=False)
    phone           = Column(String(20), unique=True, nullable=False, index=True)
    hashed_password = Column(String(200), nullable=False)
    enc_password    = Column(Text, nullable=True)   # joriy parol, qaytarib olinadigan shifrda (superadmin uchun)
    role            = Column(SAEnum(RoleEnum, name="role_enum"), default=RoleEnum.xodim, nullable=False)
    status          = Column(SAEnum(EmployeeStatusEnum, name="employee_status_enum"), default=EmployeeStatusEnum.faol, nullable=False)
    is_active       = Column(Boolean, default=True, nullable=False)
    photo_base64    = Column(Text, nullable=True)   # "data:image/jpeg;base64,..." — yuz tanish uchun
    telegram_id       = Column(BigInteger, unique=True, nullable=True)
    telegram_username = Column(String(100), nullable=True)
    work_location   = Column(SAEnum(WorkLocationEnum, name="work_location_enum"), default=WorkLocationEnum.vazirlik, nullable=False)

    department      = relationship("Department", back_populates="employees")
    tabel_records   = relationship("TabelRecord", foreign_keys="TabelRecord.employee_id", back_populates="employee")
    scores          = relationship("Score", foreign_keys="Score.employee_id", back_populates="employee")

    @property
    def has_photo(self) -> bool:
        return bool(self.photo_base64)


class TabelRecord(Base):
    """Oylik davomat jadvali — har bir xodim, har bir kun."""
    __tablename__ = "tabel_records"
    __table_args__ = (
        UniqueConstraint("employee_id", "year", "month", "day", name="uq_tabel_day"),
    )

    id          = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    year        = Column(Integer, nullable=False)
    month       = Column(Integer, nullable=False)   # 1-12
    day         = Column(Integer, nullable=False)   # 1-31
    code        = Column(String(10), default="8")   # "8","4","X","Б","К","У/Т","М/Т",""
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by  = Column(Integer, ForeignKey("employees.id"), nullable=True)

    employee    = relationship("Employee", foreign_keys=[employee_id], back_populates="tabel_records")
    author      = relationship("Employee", foreign_keys=[created_by])


class Attendance(Base):
    """Xodim ishga kelganini GPS bilan belgilash — har kuni bir marta."""
    __tablename__ = "attendances"
    __table_args__ = (
        UniqueConstraint("employee_id", "date", name="uq_attendance_day"),
    )

    id          = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    date        = Column(String(10), nullable=False)   # "2026-06-09" (YYYY-MM-DD)
    check_in    = Column(DateTime, default=datetime.utcnow)  # aniq vaqt (UTC)
    latitude    = Column(Float, nullable=False)
    longitude   = Column(Float, nullable=False)
    distance_m  = Column(Float, nullable=True)         # binogacha masofa (metr)

    employee    = relationship("Employee", foreign_keys=[employee_id])


class AttendanceNote(Base):
    """Xodimning kechikish/kelmaslik haqidagi arizasi — bitta kun yoki sanalar
    oralig'i (date_from—date_to) uchun yoziladi. Oddiy xodim yozsa — bo'lim
    boshlig'i va kadr roliga; bo'lim boshlig'i yozsa — faqat kadr roliga
    ko'rinadi. Har yuborilishda yangi ariza sifatida saqlanadi (tarix)."""
    __tablename__ = "attendance_notes"

    id            = Column(Integer, primary_key=True, index=True)
    employee_id   = Column(Integer, ForeignKey("employees.id"), nullable=False)
    note_type     = Column(String(20), nullable=False)   # "kechikish" | "kelmaslik"
    text          = Column(Text, nullable=True)
    date_from     = Column(String(10), nullable=False)   # "2026-06-09"
    date_to       = Column(String(10), nullable=False)   # "2026-06-09"
    expected_time = Column(String(5), nullable=True)     # "kechikish" uchun taxminiy kelish vaqti, "10:30"
    created_at    = Column(DateTime, default=datetime.utcnow)

    # Kadr roli tomonidan ko'rib chiqilishi: "kutilmoqda" | "sababli" | "sababsiz"
    review_status = Column(String(20), nullable=False, default="kutilmoqda")
    reviewed_by   = Column(Integer, ForeignKey("employees.id"), nullable=True)
    reviewed_at   = Column(DateTime, nullable=True)

    employee    = relationship("Employee", foreign_keys=[employee_id])
    reviewer    = relationship("Employee", foreign_keys=[reviewed_by])


class PasswordResetCode(Base):
    """Profil sahifasidan parolni o'zgartirish uchun Telegram orqali
    yuboriladigan 5 xonali tasdiqlash kodi (3 daqiqa amal qiladi)."""
    __tablename__ = "password_reset_codes"

    id          = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    code        = Column(String(5), nullable=False)
    expires_at  = Column(DateTime, nullable=False)
    used_at     = Column(DateTime, nullable=True)
    created_at  = Column(DateTime, default=datetime.utcnow)

    employee    = relationship("Employee", foreign_keys=[employee_id])


class Score(Base):
    """Oylik ball baholash jadvali."""
    __tablename__ = "scores"
    __table_args__ = (
        UniqueConstraint("employee_id", "year", "month", name="uq_score_month"),
    )

    id              = Column(Integer, primary_key=True, index=True)
    employee_id     = Column(Integer, ForeignKey("employees.id"), nullable=False)
    year            = Column(Integer, nullable=False)
    month           = Column(Integer, nullable=False)  # 1-12
    bolim_ball      = Column(Float, nullable=True)      # 0-65,  haftalik tasdiqlangan hisobotlar yig'indisi (avtomatik)
    kadr_ball       = Column(Integer, nullable=True)   # 0-25,  kadrlar bo'limi beradi
    direktor_ball   = Column(Integer, nullable=True)   # 0-100, direktor beradi
    ijro_ball       = Column(Integer, nullable=True)   # 0-10,  ijro nazoratidan
    comment         = Column(String(500), nullable=True)
    report_file_name = Column(String(255), nullable=True)  # yuklangan fayl nomi
    report_file_b64  = Column(Text, nullable=True)          # fayl base64 (PDF/doc)
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by      = Column(Integer, ForeignKey("employees.id"), nullable=True)

    employee        = relationship("Employee", foreign_keys=[employee_id], back_populates="scores")
    author          = relationship("Employee", foreign_keys=[created_by])


class IjroDocManba(str, enum.Enum):
    pq_pf    = "pq_pf"
    vm       = "vm"
    qv       = "qv"
    direktor = "direktor"

class IjroDocHolati(str, enum.Enum):
    jarayonda            = "jarayonda"
    bajarildi            = "bajarildi"
    muddati_yaqin        = "muddati_yaqin"
    kechikmoqda          = "kechikmoqda"
    bolimga_yonaltirildi = "bolimga_yonaltirildi"

class IjroDocTur(str, enum.Enum):
    kiruvchi  = "kiruvchi"
    chiquvchi = "chiquvchi"
    ichki     = "ichki"

class IjroDocDavriyligi(str, enum.Enum):
    bir_martalik = "bir_martalik"
    har_chorakda = "har_chorakda"
    har_yili     = "har_yili"


class IjroDocBolimHolati(str, enum.Enum):
    yuborildi        = "yuborildi"
    qabul_qilindi    = "qabul_qilindi"
    rad_etildi       = "rad_etildi"
    bajarilmoqda     = "bajarilmoqda"
    tasdiq_kutilmoqda = "tasdiq_kutilmoqda"  # bo'lim yakunladi, IJRO tasdig'ini kutmoqda
    bajarildi        = "bajarildi"           # IJRO tasdiqlagandan keyingina shu holatga o'tadi


class IjroDocument(Base):
    """Ijro nazorati uchun hujjat va topshiriqlar."""
    __tablename__ = "ijro_documents"

    id                       = Column(Integer, primary_key=True, index=True)
    tur                      = Column(SAEnum(IjroDocTur,       name="ijro_doc_tur_enum"),       default=IjroDocTur.kiruvchi,            nullable=False)
    manba                    = Column(SAEnum(IjroDocManba,     name="ijro_doc_manba_enum"),      nullable=False)
    hujjat_raqami            = Column(String(100),  nullable=True)
    hujjat_sanasi            = Column(String(20),   nullable=True)
    sarlavha                 = Column(String(500),  nullable=True)
    mazmun                   = Column(Text,         nullable=True)
    qoshimcha_malumot        = Column(Text,         nullable=True)
    masul_orinbosar_id       = Column(Integer, ForeignKey("employees.id"), nullable=True)
    masul_bolimlar           = Column(String(500),  nullable=True)   # JSON: "[1,3,5]"
    ijro_muddati             = Column(DateTime,     nullable=True)
    davriyligi               = Column(SAEnum(IjroDocDavriyligi, name="ijro_doc_davriyligi_enum"), default=IjroDocDavriyligi.bir_martalik, nullable=False)
    kelishuvchi_tashkilotlar = Column(String(500),  nullable=True)
    fayl_name                = Column(String(255),  nullable=True)
    fayl_b64                 = Column(Text,         nullable=True)
    holati                   = Column(SAEnum(IjroDocHolati, name="ijro_doc_holati_enum"), default=IjroDocHolati.jarayonda, nullable=False)
    qayta_sabab              = Column(Text,         nullable=True)
    created_by               = Column(Integer, ForeignKey("employees.id"), nullable=True)
    created_at               = Column(DateTime, default=datetime.utcnow)

    creator         = relationship("Employee", foreign_keys=[created_by])
    masul_orinbosar = relationship("Employee", foreign_keys=[masul_orinbosar_id])
    bolim_assignments = relationship("IjroDocBolim", back_populates="document", cascade="all, delete-orphan")


class IjroDocBolim(Base):
    """Hujjat qaysi bo'limlarga yuborilgani va ularning holati."""
    __tablename__ = "ijro_doc_bolimlar"
    __table_args__ = (UniqueConstraint("doc_id", "bolim_id", name="uq_doc_bolim"),)

    id         = Column(Integer, primary_key=True, index=True)
    doc_id     = Column(Integer, ForeignKey("ijro_documents.id", ondelete="CASCADE"), nullable=False)
    bolim_id   = Column(Integer, ForeignKey("departments.id"),   nullable=False)
    holati     = Column(SAEnum(IjroDocBolimHolati, name="ijro_doc_bolim_holati_enum"),
                        default=IjroDocBolimHolati.yuborildi, nullable=False)
    izoh       = Column(Text, nullable=True)
    assigned_at= Column(DateTime, default=datetime.utcnow)
    qaror_at   = Column(DateTime, nullable=True)
    qaror_by   = Column(Integer, ForeignKey("employees.id"), nullable=True)

    # Bo'lim ichida topshiriqni bajarayotgan aniq xodim. Bo'lim qabul qilganda
    # avtomatik bo'lim boshlig'ining o'ziga o'rnatiladi; keyin boshqa xodimga
    # qayta biriktirilishi mumkin (IjroDocBolimAssignLog orqali tarix saqlanadi).
    xodim_id         = Column(Integer, ForeignKey("employees.id"), nullable=True)
    xodim_assigned_at= Column(DateTime, nullable=True)

    # Topshiriqni yakunlash (bajarildi deb belgilash): izoh + bir nechta fayl.
    yakunlash_izohi   = Column(Text, nullable=True)
    # Pydantic schemasidagi "yakunlash_fayllar" (List[...]) bilan avtomatik
    # from_attributes to'qnashuvining oldini olish uchun atribut nomi boshqacha,
    # DB ustun nomi esa saqlanib qolgan.
    yakunlash_fayllar_raw = Column("yakunlash_fayllar", Text, nullable=True)   # JSON: [{"name":..,"b64":..}, ...]
    yakunlangan_at    = Column(DateTime, nullable=True)
    yakunlagan_by     = Column(Integer, ForeignKey("employees.id"), nullable=True)

    document        = relationship("IjroDocument", back_populates="bolim_assignments")
    bolim           = relationship("Department")
    qaror_beruvchi  = relationship("Employee", foreign_keys=[qaror_by])
    xodim           = relationship("Employee", foreign_keys=[xodim_id])
    yakunlovchi     = relationship("Employee", foreign_keys=[yakunlagan_by])


class IjroDocBolimAssignLog(Base):
    """Bo'lim ichida topshiriq kimga (qayta) biriktirilgani haqidagi tarix —
    direktor/ijro rollarga to'liq shaffoflik uchun."""
    __tablename__ = "ijro_doc_bolim_assign_log"

    id           = Column(Integer, primary_key=True, index=True)
    doc_bolim_id = Column(Integer, ForeignKey("ijro_doc_bolimlar.id", ondelete="CASCADE"), nullable=False)
    xodim_id     = Column(Integer, ForeignKey("employees.id"), nullable=False)
    assigned_by  = Column(Integer, ForeignKey("employees.id"), nullable=True)
    assigned_at  = Column(DateTime, default=datetime.utcnow)

    doc_bolim       = relationship("IjroDocBolim")
    xodim           = relationship("Employee", foreign_keys=[xodim_id])
    assigned_by_emp = relationship("Employee", foreign_keys=[assigned_by])


class WeeklyReport(Base):
    """Haftalik hisobot — xodim/bo'lim boshlig'i o'zi yuklaydi, rahbari tasdiqlab ball qo'yadi."""
    __tablename__ = "weekly_reports"
    __table_args__ = (
        UniqueConstraint("employee_id", "year", "month", "week", name="uq_weekly_report"),
    )

    id            = Column(Integer, primary_key=True, index=True)
    employee_id   = Column(Integer, ForeignKey("employees.id"), nullable=False)
    year          = Column(Integer, nullable=False)
    month         = Column(Integer, nullable=False)   # 1-12
    week          = Column(Integer, nullable=False)   # 1-5 (shu oydagi taqvim haftasi tartib raqami)
    file_name     = Column(String(255), nullable=True)
    file_b64      = Column(Text, nullable=True)
    uploaded_at   = Column(DateTime, nullable=True)
    ball          = Column(Float, nullable=True)      # tasdiqlangach qo'yiladigan ball
    confirmed_at  = Column(DateTime, nullable=True)
    confirmed_by  = Column(Integer, ForeignKey("employees.id"), nullable=True)

    employee      = relationship("Employee", foreign_keys=[employee_id])
    reviewer      = relationship("Employee", foreign_keys=[confirmed_by])


class TelegramLinkToken(Base):
    """Xodim CRM profilida "Telegram" tugmasini bosganda yaratiladigan, bir martalik,
    muddati tez tugaydigan token — add_account_bot shu orqali xodimni aniqlaydi
    (telefon raqamini ochiq deep-linkda yubormaslik uchun)."""
    __tablename__ = "telegram_link_tokens"

    id          = Column(Integer, primary_key=True, index=True)
    token       = Column(String(64), unique=True, nullable=False, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    expires_at  = Column(DateTime, nullable=False)
    used_at     = Column(DateTime, nullable=True)
    created_at  = Column(DateTime, default=datetime.utcnow)

    employee    = relationship("Employee")


class LocationSetting(Base):
    """Ish joyi turi (vazirlik / labaratoriya) uchun geolokatsiya markazi va radiusi."""
    __tablename__ = "location_settings"

    id             = Column(Integer, primary_key=True, index=True)
    location_type  = Column(SAEnum(WorkLocationEnum, name="location_type_enum"), unique=True, nullable=False)
    latitude       = Column(Float, nullable=True)
    longitude      = Column(Float, nullable=True)
    radius_meters  = Column(Integer, default=100, nullable=False)
    updated_at     = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
