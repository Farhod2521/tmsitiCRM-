import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, Enum as SAEnum, DateTime, UniqueConstraint, Text
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
    faol     = "faol"      # oddiy, faol ishlamoqda
    otpuska  = "otpuska"   # otpuskada
    dekret   = "dekret"    # dekret ta'tilida


class DeptTypeEnum(str, enum.Enum):
    rahbariyat  = "rahbariyat"
    bolim       = "bolim"
    boshqarma   = "boshqarma"
    xizmat      = "xizmat"


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
    role            = Column(SAEnum(RoleEnum, name="role_enum"), default=RoleEnum.xodim, nullable=False)
    status          = Column(SAEnum(EmployeeStatusEnum, name="employee_status_enum"), default=EmployeeStatusEnum.faol, nullable=False)
    is_active       = Column(Boolean, default=True, nullable=False)
    photo_base64    = Column(Text, nullable=True)   # "data:image/jpeg;base64,..." — yuz tanish uchun

    department      = relationship("Department", back_populates="employees")
    tabel_records   = relationship("TabelRecord", foreign_keys="TabelRecord.employee_id", back_populates="employee")
    scores          = relationship("Score", foreign_keys="Score.employee_id", back_populates="employee")


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
    bolim_ball      = Column(Integer, nullable=True)   # 0-65,  bo'lim boshlig'i beradi
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
