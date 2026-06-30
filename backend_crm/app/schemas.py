from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date
from .models import RoleEnum, DeptTypeEnum, EmployeeStatusEnum


# ── Department ────────────────────────────────────────────────────────────────
class DepartmentCreate(BaseModel):
    name: str
    dept_type: DeptTypeEnum
    order_num: int = 0

class DepartmentOut(BaseModel):
    id: int
    name: str
    dept_type: DeptTypeEnum
    order_num: int = 0
    model_config = {"from_attributes": True}


# ── Employee ──────────────────────────────────────────────────────────────────
class EmployeeCreate(BaseModel):
    full_name: str
    position: str
    department_id: Optional[int] = None
    work_rate: float = 1.0
    phone: str
    password: str
    role: RoleEnum = RoleEnum.xodim

class EmployeeUpdate(BaseModel):
    full_name: Optional[str] = None
    position: Optional[str] = None
    department_id: Optional[int] = None
    work_rate: Optional[float] = None
    phone: Optional[str] = None
    password: Optional[str] = None
    role: Optional[RoleEnum] = None
    is_active: Optional[bool] = None

class EmployeeOut(BaseModel):
    id: int
    full_name: str
    position: str
    department_id: Optional[int] = None
    work_rate: float
    phone: str
    role: RoleEnum
    status: EmployeeStatusEnum
    is_active: bool
    department: Optional[DepartmentOut] = None
    model_config = {"from_attributes": True}

class SetStatusIn(BaseModel):
    status: EmployeeStatusEnum


# ── Auth ──────────────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    phone: str
    password: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    id: int
    full_name: str
    role: str
    department_id: Optional[int] = None
    phone: str


# ── Tabel ─────────────────────────────────────────────────────────────────────
class TabelDayIn(BaseModel):
    employee_id: int
    year: int
    month: int
    day: int
    code: str  # "8","4","X","Б","К","У/Т","М/Т",""

class TabelDayOut(BaseModel):
    id: int
    employee_id: int
    year: int
    month: int
    day: int
    code: str
    updated_at: datetime
    model_config = {"from_attributes": True}

class TabelBatchIn(BaseModel):
    """Bir oy uchun ko'p kunni bir vaqtda saqlash."""
    records: List[TabelDayIn]

class TabelMonthRecord(BaseModel):
    """Bir xodimning bir oylik tabeli."""
    employee_id: int
    full_name: str
    position: str
    work_rate: float
    days: dict  # {day: code}  e.g. {"1":"8","2":"X",...}
    model_config = {"from_attributes": True}


# ── Attendance / Davomat ──────────────────────────────────────────────────────
class CheckInIn(BaseModel):
    latitude: float
    longitude: float

class AttendanceOut(BaseModel):
    id: int
    employee_id: int
    date: str
    check_in: datetime
    latitude: float
    longitude: float
    distance_m: Optional[float] = None
    late_minutes: int = 0          # ish boshlanish vaqtidan kechikish (daqiqa)
    check_in_local: Optional[str] = None  # "HH:MM" — UTC+5 mahalliy vaqt
    model_config = {"from_attributes": True}


# ── Employee photo ────────────────────────────────────────────────────────────
class PhotoIn(BaseModel):
    photo_base64: str  # "data:image/jpeg;base64,..."


# ── Attendance Admin ─────────────────────────────────────────────────────────
class AdminDavomatRow(BaseModel):
    employee_id: int
    full_name: str
    position: str
    department: Optional[str] = None
    check_in_local: Optional[str] = None   # "HH:MM" — kelgan bo'lsa
    late_minutes: Optional[int] = None     # None = kelmagan
    distance_m: Optional[float] = None
    arrived: bool


# ── Score / Ball ──────────────────────────────────────────────────────────────
class ScoreIn(BaseModel):
    employee_id: int
    year: int
    month: int
    bolim_ball: Optional[float] = None  # 0-65 (haftalik hisobotlar yig'indisi, avtomatik)
    kadr_ball: Optional[int] = None     # 0-25
    direktor_ball: Optional[int] = None # 0-100
    ijro_ball: Optional[int] = None     # 0-10
    comment: Optional[str] = None

class ScoreOut(BaseModel):
    id: int
    employee_id: int
    year: int
    month: int
    bolim_ball: Optional[float] = None
    kadr_ball: Optional[int] = None
    direktor_ball: Optional[int] = None
    ijro_ball: Optional[int] = None
    comment: Optional[str] = None
    report_file_name: Optional[str] = None   # fayl nomi (ko'rsatish uchun)
    updated_at: datetime
    model_config = {"from_attributes": True}


class ReportFileIn(BaseModel):
    employee_id: int
    year: int
    month: int
    file_name: str
    file_b64: str   # "data:application/pdf;base64,..."


# ── Kadr/Ijro/Direktor ball berish ───────────────────────────────────────────
class SetRoleIn(BaseModel):
    role: RoleEnum

class EmpScoreRowOut(BaseModel):
    """Barcha xodimlar + oy bali — kadr/ijro/direktor sahifalari uchun."""
    employee_id:    int
    full_name:      str
    position:       str
    role:           str
    department_id:  Optional[int] = None
    department_name:Optional[str] = None
    bolim_ball:     Optional[float] = None
    kadr_ball:      Optional[int] = None
    direktor_ball:  Optional[int] = None
    ijro_ball:      Optional[int] = None
    report_file_name: Optional[str] = None

class BulkScoreItemIn(BaseModel):
    employee_id:    int
    bolim_ball:     Optional[float] = None
    kadr_ball:      Optional[int] = None
    direktor_ball:  Optional[int] = None
    ijro_ball:      Optional[int] = None

class BulkScoreIn(BaseModel):
    year:       int
    month:      int
    employees:  List[BulkScoreItemIn]


# ── Haftalik hisobot ─────────────────────────────────────────────────────────
class WeekInfo(BaseModel):
    week: int
    start: date
    end: date
    label: str
    max_ball: float
    is_current: bool = False

class WeeklyReportUploadIn(BaseModel):
    year: int
    month: int
    week: int
    file_name: str
    file_b64: str   # "data:application/pdf;base64,..."

class WeeklyReportScoreIn(BaseModel):
    ball: float

class WeeklyReportOut(BaseModel):
    id: int
    employee_id: int
    employee_name: Optional[str] = None
    year: int
    month: int
    week: int
    week_label: Optional[str] = None
    max_ball: Optional[float] = None
    is_current: bool = False
    file_name: Optional[str] = None
    uploaded_at: Optional[datetime] = None
    ball: Optional[float] = None
    confirmed_at: Optional[datetime] = None
    confirmed_by: Optional[int] = None
    model_config = {"from_attributes": True}

class WeeklyTeamRowOut(BaseModel):
    """Bitta xodim + shu oydagi barcha haftalik hisobotlari (tasdiqlovchi ko'rinishi)."""
    employee_id: int
    full_name: str
    position: str
    department_name: Optional[str] = None
    weeks: List[WeeklyReportOut]
    bolim_ball: Optional[float] = None

class PendingMessageOut(BaseModel):
    text: str
    count: int

class TelegramMessageIn(BaseModel):
    text: str
