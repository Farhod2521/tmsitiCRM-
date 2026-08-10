from pydantic import BaseModel
from typing import Optional, List, Literal
from datetime import datetime, date
from .models import RoleEnum, DeptTypeEnum, EmployeeStatusEnum, WorkLocationEnum, IjroDocManba, IjroDocHolati, IjroDocTur, IjroDocDavriyligi, IjroDocBolimHolati


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
    status_date_from: Optional[str] = None
    status_date_to: Optional[str] = None
    is_active: bool
    department: Optional[DepartmentOut] = None
    telegram_id: Optional[int] = None
    telegram_username: Optional[str] = None
    work_location: WorkLocationEnum = WorkLocationEnum.vazirlik
    has_photo: bool = False
    model_config = {"from_attributes": True}

class SetStatusIn(BaseModel):
    status: EmployeeStatusEnum
    date_from: Optional[str] = None
    date_to: Optional[str] = None

class SetWorkLocationIn(BaseModel):
    work_location: WorkLocationEnum

class EmployeePasswordOut(BaseModel):
    id: int
    password: Optional[str] = None


# ── Xodimga biriktirilgan fayllar (buyruqlar) ──────────────────────────────────
class EmployeeFileIn(BaseModel):
    file_name: str
    file_b64: str
    note: Optional[str] = None

class EmployeeFileOut(BaseModel):
    id: int
    employee_id: int
    file_name: str
    file_b64: str
    note: Optional[str] = None
    uploaded_by_nomi: Optional[str] = None
    created_at: Optional[datetime] = None
    model_config = {"from_attributes": True}


# ── Lokatsiya sozlamalari ────────────────────────────────────────────────────
class LocationSettingOut(BaseModel):
    location_type: WorkLocationEnum
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    radius_meters: int
    model_config = {"from_attributes": True}

class LocationSettingIn(BaseModel):
    latitude: float
    longitude: float
    radius_meters: int = 100


# ── Telegram bot (add_account_bot) ────────────────────────────────────────────
class TelegramLinkTokenOut(BaseModel):
    token: str
    expires_in: int   # sekundlarda

class BotLinkIn(BaseModel):
    token: str                       # /employees/me/telegram-link-token orqali olingan bir martalik token
    verified_phone: str              # Telegram kontaktidan olingan haqiqiy raqam
    new_password: str
    photo_base64: Optional[str] = None  # Telegramda yuborilgan selfi — profil rasmi sifatida saqlanadi
    telegram_id: int
    telegram_username: Optional[str] = None

class BotLinkOut(BaseModel):
    ok: bool
    full_name: Optional[str] = None
    phone: Optional[str] = None
    detail: Optional[str] = None

class BotResetIn(BaseModel):
    telegram_id: int
    new_password: str

class BotResetOut(BaseModel):
    ok: bool
    phone: Optional[str] = None
    detail: Optional[str] = None


class BotAbsentEmployeeOut(BaseModel):
    telegram_id: int
    full_name: str

class BotAttendanceReminderOut(BaseModel):
    date: str
    count: int
    group_text: str
    names: List[str] = []   # rasm-eslatma uchun: barcha yo'q xodimlarning F.I.Sh. (telegram_id bor-yo'qligidan qat'i nazar)
    personal: List[BotAbsentEmployeeOut]


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


# ── Attendance Note (kechikish / kelmaslik izohi) ──────────────────────────────
class AttendanceNoteIn(BaseModel):
    note_type: Literal["kechikish", "kelmaslik", "obyektda", "ruxsat"]
    date_from: str
    date_to: str
    expected_time: Optional[str] = None       # "kechikish" uchun taxminiy kelish vaqti, masalan "10:30"
    object_time_from: Optional[str] = None    # "obyektda" uchun vaqt oralig'i, masalan "09:00"
    object_time_to: Optional[str] = None
    object_latitude: Optional[float] = None   # "obyektda" uchun joriy joylashuv (ixtiyoriy)
    object_longitude: Optional[float] = None
    text: Optional[str] = None

class AttendanceNoteOut(BaseModel):
    id: int
    employee_id: int
    employee_nomi: Optional[str] = None
    position: Optional[str] = None
    department_nomi: Optional[str] = None
    note_type: str
    text: Optional[str] = None
    date_from: str
    date_to: str
    expected_time: Optional[str] = None
    object_time_from: Optional[str] = None
    object_time_to: Optional[str] = None
    object_latitude: Optional[float] = None
    object_longitude: Optional[float] = None
    created_at: datetime
    review_status: str = "kutilmoqda"
    reviewed_by_nomi: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    model_config = {"from_attributes": True}

class AttendanceNoteReviewIn(BaseModel):
    status: Literal["sababli", "sababsiz"]


# ── Parolni Telegram orqali tiklash ────────────────────────────────────────────
class PasswordResetRequestOut(BaseModel):
    sent: bool
    expires_in_seconds: int

class PasswordResetVerifyIn(BaseModel):
    code: str

class PasswordResetConfirmIn(BaseModel):
    code: str
    new_password: str


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


# ── Ijro hujjatlari ───────────────────────────────────────────────────────────
class IjroDocIn(BaseModel):
    tur:                      IjroDocTur         = IjroDocTur.kiruvchi
    manba:                    IjroDocManba
    hujjat_raqami:            Optional[str]      = None
    hujjat_sanasi:            Optional[str]      = None
    sarlavha:                 Optional[str]      = None
    mazmun:                   Optional[str]      = None
    qoshimcha_malumot:        Optional[str]      = None
    masul_orinbosar_id:       Optional[int]      = None
    masul_bolimlar:           Optional[str]      = None   # JSON "[1,3]"
    masul_bolimlar_xodimlar:  Optional[str]      = None   # JSON {"1": 12, "3": 45} — bo'lim_id -> boshlang'ich ijrochi xodim_id
    ijrochi_turi:             Literal["asosiy", "qoshimcha"] = "asosiy"
    ijro_muddati:             Optional[datetime] = None
    davriyligi:               IjroDocDavriyligi  = IjroDocDavriyligi.bir_martalik
    kelishuvchi_tashkilotlar: Optional[str]      = None
    fayl_name:                Optional[str]      = None
    fayl_b64:                 Optional[str]      = None

class IjroDocOut(BaseModel):
    id:                       int
    tur:                      IjroDocTur
    manba:                    IjroDocManba
    hujjat_raqami:            Optional[str]      = None
    hujjat_sanasi:            Optional[str]      = None
    sarlavha:                 Optional[str]      = None
    mazmun:                   Optional[str]      = None
    qoshimcha_malumot:        Optional[str]      = None
    masul_orinbosar_id:       Optional[int]      = None
    masul_orinbosar_nomi:     Optional[str]      = None
    masul_bolimlar:           Optional[str]      = None
    masul_bolimlar_nomi:      Optional[str]      = None   # "Bo'lim A, Bo'lim B"
    masul_bolimlar_info:      Optional[str]      = None   # JSON: [{id,name,holati}]
    masul_bolim_boshliqlari_nomi: Optional[str]  = None   # rad etilmagan bo'lim(lar) boshlig'i F.I.Sh.
    ijrochi_turi:             str                = "asosiy"
    ijro_muddati:             Optional[datetime] = None
    davriyligi:               IjroDocDavriyligi
    kelishuvchi_tashkilotlar: Optional[str]      = None
    fayl_name:                Optional[str]      = None
    fayl_b64:                 Optional[str]      = None
    holati:                   IjroDocHolati
    qayta_sabab:              Optional[str]      = None
    created_by:               Optional[int]      = None
    created_at:               Optional[datetime] = None
    model_config = {"from_attributes": True}

class IjroDocListOut(BaseModel):
    """Ro'yxat (list) uchun yengil variant — fayl_b64 (og'ir base64 blob) chiqarilmaydi,
    faqat bitta hujjat ochilganda (/{doc_id} yoki /{doc_id}/tracking) to'liq keladi."""
    id:                       int
    tur:                      IjroDocTur
    manba:                    IjroDocManba
    hujjat_raqami:            Optional[str]      = None
    hujjat_sanasi:            Optional[str]      = None
    sarlavha:                 Optional[str]      = None
    mazmun:                   Optional[str]      = None
    qoshimcha_malumot:        Optional[str]      = None
    masul_orinbosar_id:       Optional[int]      = None
    masul_orinbosar_nomi:     Optional[str]      = None
    masul_bolimlar:           Optional[str]      = None
    masul_bolimlar_nomi:      Optional[str]      = None
    masul_bolimlar_info:      Optional[str]      = None
    masul_bolim_boshliqlari_nomi: Optional[str]  = None
    ijrochi_turi:             str                = "asosiy"
    ijro_muddati:             Optional[datetime] = None
    davriyligi:               IjroDocDavriyligi
    kelishuvchi_tashkilotlar: Optional[str]      = None
    fayl_name:                Optional[str]      = None
    holati:                   IjroDocHolati
    qayta_sabab:              Optional[str]      = None
    created_by:               Optional[int]      = None
    created_at:               Optional[datetime] = None
    model_config = {"from_attributes": True}

class IjroDocStatusIn(BaseModel):
    holati:      IjroDocHolati
    qayta_sabab: Optional[str] = None

class IjroDocBolimAssignLogOut(BaseModel):
    id:               int
    xodim_id:         int
    xodim_nomi:       Optional[str] = None
    assigned_by:      Optional[int] = None
    assigned_by_nomi: Optional[str] = None
    assigned_at:      Optional[datetime] = None
    model_config = {"from_attributes": True}

class IjroDocBolimOut(BaseModel):
    id:            int
    doc_id:        Optional[int]   = None
    bolim_id:      int
    bolim_nomi:    Optional[str]   = None
    holati:        IjroDocBolimHolati
    izoh:          Optional[str]   = None
    assigned_at:   Optional[datetime] = None
    qaror_at:      Optional[datetime] = None
    qaror_by_nomi: Optional[str]   = None
    xodim_id:         Optional[int] = None
    xodim_nomi:       Optional[str] = None
    xodim_assigned_at: Optional[datetime] = None
    assign_log:    List[IjroDocBolimAssignLogOut] = []
    # Topshiriqni yakunlash (bajarildi deb belgilash) — izoh + fayllar
    yakunlash_izohi:    Optional[str] = None
    yakunlash_fayllar:  List["YakunlashFayl"] = []
    yakunlangan_at:     Optional[datetime] = None
    yakunlagan_by_nomi: Optional[str] = None
    # doc preview fields (for list display)
    doc_sarlavha:      Optional[str] = None
    doc_mazmun:        Optional[str] = None
    doc_qoshimcha_malumot: Optional[str] = None
    doc_manba:         Optional[str] = None
    doc_hujjat_raqami: Optional[str] = None
    doc_ijro_muddati:  Optional[datetime] = None
    model_config = {"from_attributes": True}

class IjroDocBolimQaror(BaseModel):
    holati: IjroDocBolimHolati
    izoh:   Optional[str] = None

class YakunlashFayl(BaseModel):
    name: str
    b64:  str

class IjroDocBolimYakunlashIn(BaseModel):
    izoh:    Optional[str] = None
    fayllar: List[YakunlashFayl] = []

class IjroReviewIn(BaseModel):
    qaror: Literal["yechish", "rad_etish"]
    izoh:  Optional[str] = None

class AssignXodimIn(BaseModel):
    xodim_id: int

class IjroDocTracking(BaseModel):
    """Direktor uchun hujjat to'liq holati."""
    doc:      "IjroDocOut"
    bolimlar: List[IjroDocBolimOut]

class BolimAddIn(BaseModel):
    bolim_id: int

class IjroDocUpdate(BaseModel):
    tur:                      Optional[IjroDocTur]         = None
    manba:                    Optional[IjroDocManba]        = None
    hujjat_raqami:            Optional[str]                = None
    hujjat_sanasi:            Optional[str]                = None
    sarlavha:                 Optional[str]                = None
    mazmun:                   Optional[str]                = None
    qoshimcha_malumot:        Optional[str]                = None
    masul_orinbosar_id:       Optional[int]                = None
    masul_bolimlar:           Optional[str]                = None
    ijrochi_turi:             Optional[Literal["asosiy", "qoshimcha"]] = None
    ijro_muddati:             Optional[datetime]           = None
    davriyligi:               Optional[IjroDocDavriyligi]  = None
    kelishuvchi_tashkilotlar: Optional[str]                = None
    fayl_name:                Optional[str]                = None
    fayl_b64:                 Optional[str]                = None
