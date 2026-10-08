import math
from calendar import monthrange
from datetime import date as date_cls, datetime, timezone, timedelta
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from .. import models, schemas
from ..database import get_db
from ..deps import get_current_employee, require_superadmin
from .. import note_flow

router = APIRouter(prefix="/attendance", tags=["Attendance"])

# ── Ofis joylashuvi (TMSITI / Energetika Vazirligi binosi) ───────────────────
OFFICE_LAT = 41.30449854813873
OFFICE_LNG = 69.48008896088034
RADIUS_M   = 600.0          # ruxsat etilgan radius (metr) — server'ga qo'yilganda 100 ga qaytariladi

# O'zbekiston vaqti (UTC+5) — sana va soatni to'g'ri ko'rsatish uchun
TZ_UZ = timezone(timedelta(hours=5))

# Ish boshlanish vaqti (mahalliy, UTC+5)
WORK_START_HOUR = 9
WORK_START_MIN  = 0

# Kechikish uchun imtiyozli vaqt (daqiqa) — sanaga qarab. Imtiyoz ichida kelgan
# xodim kechikkan hisoblanmaydi, undan keyin — imtiyoz tugagan paytdan sanaladi.
#   28.09.2026 gacha: 10 daqiqa (09:10 gacha — kechikmagan; 09:12 da kelsa — 2 daq)
#   29.09.2026 dan:    1 daqiqa (09:01 gacha — kechikmagan; 09:05 da kelsa — 4 daq)
# O'tgan kunlar eski qoida bo'yicha qoladi (qayta hisoblanmaydi).
_LATE_GRACE_HISTORY = [
    (date_cls(2026, 9, 29), 1),
]
_LATE_GRACE_DEFAULT = 10


def late_grace_for(day: "date_cls | None" = None) -> int:
    day = day or datetime.now(TZ_UZ).date()
    grace = _LATE_GRACE_DEFAULT
    for since, g in _LATE_GRACE_HISTORY:
        if day >= since:
            grace = g
    return grace


def late_from_minutes(minutes_after_start: int, day: "date_cls | None" = None) -> int:
    """Ish boshlanishidan keyin o'tgan daqiqalar -> kechikish (shu kungi imtiyozni ayirib)."""
    return max(0, minutes_after_start - late_grace_for(day))


def late_minutes_for(ci_local: datetime) -> int:
    """Mahalliy (UTC+5) kelish vaqti -> kechikish daqiqalari (09:00 + shu kungi imtiyoz)."""
    work_start = ci_local.replace(hour=WORK_START_HOUR, minute=WORK_START_MIN, second=0, microsecond=0)
    return late_from_minutes(int(round((ci_local - work_start).total_seconds() / 60.0)), ci_local.date())


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Ikki nuqta orasidagi masofa (metrda)."""
    R = 6371000.0  # Yer radiusi (m)
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _location_for(db: Session, employee: models.Employee) -> tuple[float, float, float]:
    """Xodimning ish joyiga (vazirlik/labaratoriya) tayinlangan koordinata va radiusni qaytaradi.
    Sozlanmagan bo'lsa (lat/lng None) — standart ofis koordinatasiga tushadi."""
    setting = (
        db.query(models.LocationSetting)
        .filter(models.LocationSetting.location_type == employee.work_location)
        .first()
    )
    if setting and setting.latitude is not None and setting.longitude is not None:
        return setting.latitude, setting.longitude, float(setting.radius_meters)
    return OFFICE_LAT, OFFICE_LNG, RADIUS_M


LOCATION_NAMES = {"vazirlik": "Vazirlik", "labaratoriya": "Labaratoriya"}


def work_locations(db: Session) -> list[tuple[str, float, float, float]]:
    """Barcha belgilangan ish joylari: [(nomi, lat, lng, radius_m), ...].
    Hech biri sozlanmagan bo'lsa — standart ofis koordinatasi."""
    out = []
    for s in db.query(models.LocationSetting).all():
        if s.latitude is not None and s.longitude is not None:
            key = s.location_type.value if hasattr(s.location_type, "value") else str(s.location_type)
            out.append((LOCATION_NAMES.get(key, key), s.latitude, s.longitude, float(s.radius_meters)))
    return out or [("Ofis", OFFICE_LAT, OFFICE_LNG, RADIUS_M)]


def nearest_work_location(db: Session, lat: float, lng: float) -> tuple[str, float, float, bool]:
    """Eng yaqin belgilangan joy: (nomi, masofa_m, radius_m, hudud_ichidami).
    Biror joyning radiusi ichida bo'lsa — o'sha joy qaytadi."""
    best = None
    for name, plat, plng, radius in work_locations(db):
        d = haversine_m(lat, lng, plat, plng)
        cand = (name, d, radius, d <= radius)
        if best is None or (cand[3], -d) > (best[3], -best[1]):
            best = cand
    return best


# Kadr tasdiqlagan (yoki keyin zamdirektor ham tasdiqlagan) ariza — shu kungi
# kechikish "sababli" hisoblanadi. 2-bosqichda rad etilsa "sababsiz" bo'ladi.
APPROVED_NOTE_STATUSES = ("kadr_tasdiqladi", "sababli")


def excused_days(db: Session, emp_ids: list[int], date_from: str, date_to: str) -> set[tuple[int, str]]:
    """Tasdiqlangan arizalar qamrab olgan (employee_id, "YYYY-MM-DD") juftliklari."""
    if not emp_ids:
        return set()
    notes = (
        db.query(models.AttendanceNote)
        .filter(
            models.AttendanceNote.employee_id.in_(emp_ids),
            models.AttendanceNote.review_status.in_(APPROVED_NOTE_STATUSES),
            models.AttendanceNote.date_from <= date_to,
            models.AttendanceNote.date_to >= date_from,
        )
        .all()
    )
    result: set[tuple[int, str]] = set()
    for n in notes:
        d = datetime.strptime(max(n.date_from, date_from), "%Y-%m-%d").date()
        end = datetime.strptime(min(n.date_to, date_to), "%Y-%m-%d").date()
        while d <= end:
            result.add((n.employee_id, d.isoformat()))
            d += timedelta(days=1)
    return result


def _to_out(rec: models.Attendance, excused: bool = False) -> schemas.AttendanceOut:
    """ORM yozuvni AttendanceOut'ga aylantiradi — kechikish va mahalliy vaqt bilan."""
    # check_in DB'da UTC+5 saqlangan (naive). Mahalliy vaqt sifatida o'qiymiz.
    ci = rec.check_in
    if ci.tzinfo is not None:
        ci_local = ci.astimezone(TZ_UZ)
    else:
        ci_local = ci  # allaqachon UTC+5 (naive)

    late = late_minutes_for(ci_local)   # imtiyoz ichida kelsa 0

    return schemas.AttendanceOut(
        id=rec.id,
        employee_id=rec.employee_id,
        date=rec.date,
        check_in=rec.check_in,
        latitude=rec.latitude,
        longitude=rec.longitude,
        distance_m=rec.distance_m,
        late_minutes=late,
        check_in_local=ci_local.strftime("%H:%M"),
        late_excused=excused and late > 0,
    )


@router.post("/check-in", response_model=schemas.AttendanceOut)
def check_in(
    payload: schemas.CheckInIn,
    db: Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    """Xodim ishga kelganini belgilaydi (GPS bilan, kuniga bir marta)."""
    loc_lat, loc_lng, loc_radius = _location_for(db, current)
    dist = haversine_m(payload.latitude, payload.longitude, loc_lat, loc_lng)
    if dist > loc_radius:
        raise HTTPException(
            status_code=400,
            detail=f"Siz ish joyingiz hududida emassiz. Binogacha {int(dist)} metr "
                   f"(ruxsat: {int(loc_radius)} m ichida).",
        )

    # UTC+5 mahalliy vaqt, lekin DB ustuni naive bo'lgani uchun tzinfo'ni olib tashlaymiz
    # (aks holda SQLAlchemy UTC'ga konvert qilib saqlaydi)
    now = datetime.now(TZ_UZ).replace(tzinfo=None)
    today = now.strftime("%Y-%m-%d")

    existing = (
        db.query(models.Attendance)
        .filter(
            models.Attendance.employee_id == current.id,
            models.Attendance.date == today,
        )
        .first()
    )
    # TEST REJIMI: bugun belgilangan bo'lsa, yangilab qayta yozadi.
    # (Server'ga qo'yilganda — kuniga bir marta cheklov qaytariladi.)
    if existing:
        existing.check_in = now
        existing.latitude = payload.latitude
        existing.longitude = payload.longitude
        existing.distance_m = round(dist, 1)
        db.commit()
        db.refresh(existing)
        return _to_out(existing)

    rec = models.Attendance(
        employee_id=current.id,
        date=today,
        check_in=now,
        latitude=payload.latitude,
        longitude=payload.longitude,
        distance_m=round(dist, 1),
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return _to_out(rec)


@router.get("/my-year-stats")
def my_year_stats(
    year: int,
    db: Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    """KPI sahifasi "Umumiy statistika": yil boshidan bugungacha ish kunlari,
    ishga kelgan, kechikkan (sababsiz) va kelmagan kunlar. Bayram va dam olish
    kunlari, ta'til/bolnichniy/safar kunlari ish kuni hisoblanmaydi."""
    from .holidays import holiday_map
    from ..status_periods import status_code_map
    today = datetime.now(TZ_UZ).date()
    start, end = date_cls(year, 1, 1), min(date_cls(year, 12, 31), today)
    # Tizim ishga tushgandan (birinchi davomat yozuvi) oldingi kunlar hisoblanmaydi
    from sqlalchemy import func
    first = db.query(func.min(models.Attendance.date)).scalar()
    if first:
        start = max(start, date_cls.fromisoformat(first))
    out = {"year": year, "ish_kunlari": 0, "kelgan": 0, "kechikkan": 0, "kelmagan": 0}
    if end < start:
        return out
    s, e = start.isoformat(), end.isoformat()
    hol = holiday_map(db, s, e)
    codes = status_code_map(db, [current], s, e)
    excused = excused_days(db, [current.id], s, e)
    atts = {a.date: a for a in db.query(models.Attendance).filter(
        models.Attendance.employee_id == current.id, models.Attendance.date >= s, models.Attendance.date <= e).all()}
    d = start
    while d <= end:
        iso = d.isoformat()
        if d.weekday() < 5 and iso not in hol and (current.id, iso) not in codes:
            out["ish_kunlari"] += 1
            att = atts.get(iso)
            if att is not None:
                out["kelgan"] += 1
                ci = att.check_in.astimezone(TZ_UZ) if att.check_in.tzinfo is not None else att.check_in
                if late_minutes_for(ci) > 0 and (current.id, iso) not in excused:
                    out["kechikkan"] += 1
            elif (current.id, iso) not in excused and iso != today.isoformat():
                out["kelmagan"] += 1
        d += timedelta(days=1)
    return out


@router.get("/my-month", response_model=List[schemas.AttendanceOut])
def my_month(
    year: int,
    month: int,
    db: Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    """Joriy foydalanuvchining bir oylik davomat kunlari (kalendar uchun)."""
    prefix = f"{year:04d}-{month:02d}-"
    recs = (
        db.query(models.Attendance)
        .filter(
            models.Attendance.employee_id == current.id,
            models.Attendance.date.like(prefix + "%"),
        )
        .order_by(models.Attendance.date)
        .all()
    )
    days_in_month = monthrange(year, month)[1]
    excused = excused_days(db, [current.id], f"{prefix}01", f"{prefix}{days_in_month:02d}")
    return [_to_out(r, (current.id, r.date) in excused) for r in recs]


@router.get("/today", response_model=schemas.AttendanceOut | None)
def today_status(
    db: Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    """Bugun belgilangan-belgilanmaganini tekshiradi."""
    today = datetime.now(TZ_UZ).strftime("%Y-%m-%d")
    rec = (
        db.query(models.Attendance)
        .filter(
            models.Attendance.employee_id == current.id,
            models.Attendance.date == today,
        )
        .first()
    )
    return _to_out(rec) if rec else None


@router.get("/today-list", response_model=List[schemas.AdminDavomatRow])
def today_arrived_list(
    date: str = None,
    db: Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    """Berilgan sanada ishga kelgan xodimlar ro'yxati — eng erta kelgandan
    boshlab tartiblangan (birinchisi — 'kun xodimi'). Har qanday xodim
    ko'ra oladi — mobil ilovadagi 'Kelganlar' bo'limi uchun."""
    if not date:
        date = datetime.now(TZ_UZ).strftime("%Y-%m-%d")

    recs = (
        db.query(models.Attendance)
        .filter(models.Attendance.date == date)
        .order_by(models.Attendance.check_in.asc())
        .all()
    )
    rows = []
    for rec in recs:
        emp = rec.employee
        if not emp or not emp.is_active:
            continue
        out = _to_out(rec)
        rows.append(schemas.AdminDavomatRow(
            employee_id=emp.id,
            full_name=emp.full_name,
            position=emp.position,
            department=emp.department.name if emp.department else None,
            check_in_local=out.check_in_local,
            late_minutes=out.late_minutes,
            distance_m=rec.distance_m,
            arrived=True,
        ))
    return rows


@router.get("/day-employee-photo")
def day_employee_photo(
    date: str = None,
    db: Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    """Berilgan sanada eng erta ishga kelgan xodimning (ya'ni 'Kun xodimi')
    rasmi — mobil ilovadagi 'Kelganlar' bo'limi uchun. Boshqa xodimning
    rasmini so'rab bo'lmaydi — server o'zi eng ertagi kelganni aniqlaydi."""
    if not date:
        date = datetime.now(TZ_UZ).strftime("%Y-%m-%d")
    # /today-list bilan bir xil tanlov: faqat faol xodimlar, aks holda
    # ro'yxatdagi birinchi xodim bilan rasm mos kelmay qoladi.
    recs = (
        db.query(models.Attendance)
        .filter(models.Attendance.date == date)
        .order_by(models.Attendance.check_in.asc())
        .all()
    )
    for rec in recs:
        emp = rec.employee
        if emp and emp.is_active:
            return {"employee_id": emp.id, "photo_base64": emp.photo_base64}
    return {"employee_id": None, "photo_base64": None}


_DAVOMAT_ADMIN_ROLES = {
    models.RoleEnum.superadmin,
    models.RoleEnum.direktor,
    models.RoleEnum.zamdirektor,
}

@router.get("/admin/day", response_model=List[schemas.AdminDavomatRow])
def admin_day(
    date: str = None,
    db: Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    """Superadmin / Direktor: berilgan sanada barcha xodimlarning davomat holati."""
    if current.role not in _DAVOMAT_ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Ruxsat yo'q")
    from typing import Optional as Opt
    if not date:
        date = datetime.now(TZ_UZ).strftime("%Y-%m-%d")

    employees = (
        db.query(models.Employee)
        .filter(models.Employee.is_active.is_(True))
        .order_by(models.Employee.full_name)
        .all()
    )

    recs: dict[int, models.Attendance] = {
        r.employee_id: r
        for r in db.query(models.Attendance)
        .filter(models.Attendance.date == date)
        .all()
    }

    rows = []
    for emp in employees:
        rec = recs.get(emp.id)
        dept_name = emp.department.name if emp.department else None
        if rec:
            out = _to_out(rec)
            rows.append(schemas.AdminDavomatRow(
                employee_id=emp.id,
                full_name=emp.full_name,
                position=emp.position,
                department=dept_name,
                check_in_local=out.check_in_local,
                late_minutes=out.late_minutes,
                distance_m=rec.distance_m,
                arrived=True,
            ))
        else:
            rows.append(schemas.AdminDavomatRow(
                employee_id=emp.id,
                full_name=emp.full_name,
                position=emp.position,
                department=dept_name,
                check_in_local=None,
                late_minutes=None,
                distance_m=None,
                arrived=False,
            ))
    return rows


def get_absent_employees(db: Session, date: str) -> List[models.Employee]:
    """Berilgan sanada 'Ishga keldim' bosmagan, faol (rahbariyat/direktor/
    zamdirektordan tashqari) xodimlar ro'yxati — telegram eslatma (qo'lda va
    avtomatik kunlik) funksiyalari uchun umumiy. Bayram kuni — bo'sh ro'yxat
    (bot eslatma yubormaydi)."""
    from .holidays import is_holiday
    from .employees import revert_expired_statuses
    if is_holiday(db, date):
        return []
    # Bugun boshlangan/tugagan ta'til va h.k. — eslatmadan oldin holatlarni yangilaymiz
    revert_expired_statuses(db)
    employees = (
        db.query(models.Employee)
        .join(models.Department, models.Employee.department_id == models.Department.id, isouter=True)
        .filter(
            models.Employee.is_active.is_(True),
            models.Employee.status == models.EmployeeStatusEnum.faol,
            models.Employee.role.notin_([models.RoleEnum.direktor, models.RoleEnum.zamdirektor]),
            (models.Department.dept_type != models.DeptTypeEnum.rahbariyat) | (models.Employee.department_id.is_(None)),
        )
        .order_by(models.Employee.full_name)
        .all()
    )
    arrived_ids = {
        r.employee_id
        for r in db.query(models.Attendance.employee_id)
        .filter(models.Attendance.date == date)
        .all()
    }
    # Ariza topshirganlar (kelmayman/kech qolaman/obyektga chiqdim — shu sanani
    # qamrab oladigan) — 09:01 eslatmasida (guruh va shaxsiy) qayta so'ralmasin.
    noted_ids = {
        r.employee_id
        for r in db.query(models.AttendanceNote.employee_id)
        .filter(models.AttendanceNote.date_from <= date, models.AttendanceNote.date_to >= date)
        .all()
    }
    return [e for e in employees if e.id not in arrived_ids and e.id not in noted_ids]


def build_pending_message_text(absent: List[models.Employee], date: str) -> str:
    if not absent:
        return ""
    lines = [f"\U0001F4CC {date} — hali ‘Ishga keldim’ tugmasini bosmaganlar:", ""]
    lines += [f"{i}) {e.full_name}" for i, e in enumerate(absent, 1)]
    lines += ["", "Iltimos, saytga kirib ‘Ishga keldim’ tugmasini bosing."]
    return "\n".join(lines)


@router.get("/pending-message", response_model=schemas.PendingMessageOut)
def get_attendance_pending_message(
    date: str = None,
    db: Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    """Berilgan sanada (yoki bugun) 'Ishga keldim' bosmagan xodimlar ro'yxatidan
    Telegram guruhiga yuboriladigan xabar matnini tayyorlaydi."""
    if current.role not in _DAVOMAT_ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Ruxsat yo'q")
    if not date:
        date = datetime.now(TZ_UZ).strftime("%Y-%m-%d")

    absent = get_absent_employees(db, date)
    return schemas.PendingMessageOut(text=build_pending_message_text(absent, date), count=len(absent))


_BOLIM_HEAD_ROLES = {models.RoleEnum.bolim_boshligi, models.RoleEnum.boshqarma_boshligi}


def _note_out(n: models.AttendanceNote) -> schemas.AttendanceNoteOut:
    out = schemas.AttendanceNoteOut.model_validate(n)
    if n.employee:
        out.employee_nomi = n.employee.full_name
        out.position = n.employee.position
        out.department_nomi = n.employee.department.name if n.employee.department else None
    if n.bolim_reviewer:
        out.bolim_by_nomi = n.bolim_reviewer.full_name
    if n.reviewer:
        out.reviewed_by_nomi = n.reviewer.full_name
    if n.zamdirektor_reviewer:
        out.zamdirektor_by_nomi = n.zamdirektor_reviewer.full_name
    return out


NOTE_FILE_MAX = 5 * 1024 * 1024
NOTE_FILE_EXT = (".pdf", ".jpg", ".jpeg", ".png", ".heic", ".webp", ".doc", ".docx", ".xls", ".xlsx", ".txt")


def _note_file(data: schemas.AttendanceNoteIn) -> tuple:
    """Ariza fayli: (nomi, turi, base64) yoki (None, None, None). 5 MB chegarasi."""
    import base64, binascii, mimetypes
    if not data.file_data:
        return None, None, None
    name = (data.file_name or "fayl").strip().replace("/", "_").replace("\\", "_").replace('"', "'")[:200]
    if not name.lower().endswith(NOTE_FILE_EXT):
        raise HTTPException(status_code=400, detail="Fayl turi: PDF, rasm (JPG/PNG), Word, Excel yoki TXT bo'lishi kerak")
    raw = data.file_data.split(",", 1)[1] if data.file_data.startswith("data:") else data.file_data
    try:
        size = len(base64.b64decode(raw, validate=True))
    except (binascii.Error, ValueError):
        raise HTTPException(status_code=400, detail="Fayl buzilgan")
    if size > NOTE_FILE_MAX:
        raise HTTPException(status_code=400, detail="Fayl hajmi 5 MB dan oshmasligi kerak")
    ftype = mimetypes.guess_type(name)[0] or "application/octet-stream"
    return name, ftype, raw


@router.get("/notes/{note_id}/file")
def note_file(note_id: int, db: Session = Depends(get_db), current: models.Employee = Depends(get_current_employee)):
    """Ariza fayli — muallif, ko'rib chiquvchilar (bo'lim boshlig'i, kadr, rahbariyat) uchun."""
    import base64
    from fastapi.responses import Response
    from urllib.parse import quote
    n = db.get(models.AttendanceNote, note_id)
    if not n or not n.file_b64:
        raise HTTPException(status_code=404, detail="Fayl topilmadi")
    R = models.RoleEnum
    allowed = (current.id == n.employee_id
               or current.role in {R.superadmin, R.direktor, R.zamdirektor, R.kadr}
               or (current.role in {R.bolim_boshligi, R.boshqarma_boshligi} and n.employee
                   and n.employee.department_id == current.department_id))
    if not allowed:
        raise HTTPException(status_code=403, detail="Ruxsat yo'q")
    return Response(base64.b64decode(n.file_b64), media_type=n.file_type or "application/octet-stream",
                    headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(n.file_name or 'fayl')}"})


@router.post("/notes", response_model=schemas.AttendanceNoteOut)
def create_note(
    data:    schemas.AttendanceNoteIn,
    background: BackgroundTasks,
    db:      Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    """Kechikish/kelmaslik haqida ariza yozish — bitta kun yoki sanalar oralig'i
    uchun (masalan, bir necha kun oldindan). Oddiy xodim yozsa — bo'lim boshlig'i
    va kadr roliga; bo'lim boshlig'i yozsa — kadr roliga ko'rinadi. Har yuborilishda
    yangi ariza sifatida saqlanadi."""
    if data.date_to < data.date_from:
        raise HTTPException(status_code=400, detail="Tugash sanasi boshlanish sanasidan oldin bo'lishi mumkin emas")
    if data.object_time_from and data.object_time_to and data.object_time_to < data.object_time_from:
        raise HTTPException(status_code=400, detail="Tugash vaqti boshlanish vaqtidan oldin bo'lishi mumkin emas")

    fname, ftype, fb64 = _note_file(data)
    note = models.AttendanceNote(
        employee_id=current.id,
        file_name=fname, file_type=ftype, file_b64=fb64,
        note_type=data.note_type,
        text=data.text,
        date_from=data.date_from,
        date_to=data.date_to,
        expected_time=data.expected_time,
        object_time_from=data.object_time_from,
        object_time_to=data.object_time_to,
        object_latitude=data.object_latitude,
        object_longitude=data.object_longitude,
        review_status=note_flow.initial_status(db, current),
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    # Ko'rib chiquvchilarga Telegram'da tugmali xabar (javobni kechiktirmaslik uchun fonda)
    background.add_task(note_flow.after_create, note.id)
    return _with_pending(db, note)


_STAGE_LABEL = {"bolim_kutilmoqda": "Bo'lim boshlig'i", "kutilmoqda": "Kadrlar bo'limi", "kadr_tasdiqladi": "Zamdirektor"}


def _with_pending(db: Session, n: models.AttendanceNote) -> schemas.AttendanceNoteOut:
    """Ariza muallifi uchun: hozir kimda (qaysi bosqich va kim ko'rib chiqadi)."""
    out = _note_out(n)
    if n.review_status in _STAGE_LABEL:
        out.pending_stage = _STAGE_LABEL[n.review_status]
        names = [e.full_name for e in note_flow.stage_reviewers(db, n)]
        out.pending_with = ", ".join(names) if names else None
    return out


@router.get("/notes/my-list", response_model=List[schemas.AttendanceNoteOut])
def my_notes(
    db:      Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    """"Mening arizalarim" — o'zi yozgan barcha davomat arizalari, eng yangisi birinchi,
    har biri hozir kimda ekanligi bilan."""
    notes = (
        db.query(models.AttendanceNote)
        .filter(models.AttendanceNote.employee_id == current.id)
        .order_by(models.AttendanceNote.created_at.desc())
        .limit(300)
        .all()
    )
    return [_with_pending(db, n) for n in notes]


@router.get("/notes/mine", response_model=schemas.AttendanceNoteOut | None)
def my_active_note(
    db:      Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    """Joriy foydalanuvchining bugungi kunni qamrab oladigan (faol) arizasi, bo'lsa."""
    today = datetime.now(TZ_UZ).strftime("%Y-%m-%d")
    note = (
        db.query(models.AttendanceNote)
        .filter(
            models.AttendanceNote.employee_id == current.id,
            models.AttendanceNote.date_from <= today,
            models.AttendanceNote.date_to >= today,
        )
        .order_by(models.AttendanceNote.created_at.desc())
        .first()
    )
    return _note_out(note) if note else None


@router.get("/notes", response_model=List[schemas.AttendanceNoteOut])
def inbox_notes(
    background: BackgroundTasks,
    db:      Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    """Bo'lim boshlig'i — o'z bo'limidagi oddiy xodimlarning izohlarini;
    kadr — bo'lim boshlig'i tasdiqlaganlaridan boshlab; direktor/zamdirektor —
    kadr tasdiqlaganlaridan boshlab (navbati kelmagan ariza ko'rinmaydi);
    superadmin — barchasini ko'radi."""
    moved = note_flow.reroute_to_heads(db)
    if moved:
        background.add_task(note_flow.after_reroute, moved)
    if current.role in _BOLIM_HEAD_ROLES:
        if not current.department_id:
            return []
        q = (
            db.query(models.AttendanceNote)
            .join(models.Employee, models.AttendanceNote.employee_id == models.Employee.id)
            .filter(
                models.Employee.department_id == current.department_id,
                models.Employee.id != current.id,
                models.Employee.role.notin_(_BOLIM_HEAD_ROLES),
            )
        )
    elif current.role == models.RoleEnum.kadr:
        q = db.query(models.AttendanceNote).filter(models.AttendanceNote.review_status != "bolim_kutilmoqda")
    elif current.role in (models.RoleEnum.direktor, models.RoleEnum.zamdirektor):
        q = db.query(models.AttendanceNote).filter(
            models.AttendanceNote.review_status.notin_(["bolim_kutilmoqda", "kutilmoqda"]))
    elif current.role == models.RoleEnum.superadmin:
        q = db.query(models.AttendanceNote)
    else:
        raise HTTPException(status_code=403, detail="Ruxsat yo'q")

    notes = q.order_by(models.AttendanceNote.created_at.desc()).limit(200).all()
    return [_note_out(n) for n in notes]


@router.post("/notes/{note_id}/review", response_model=schemas.AttendanceNoteOut)
def review_note(
    note_id: int,
    data:    schemas.AttendanceNoteReviewIn,
    background: BackgroundTasks,
    db:      Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    """Bosqichma-bosqich tasdiqlash (note_flow.py):
    bolim_kutilmoqda — bo'lim boshlig'i; kutilmoqda — kadr;
    kadr_tasdiqladi — zamdirektor/direktor/superadmin.
    Rad etish istalgan bosqichda darhol "sababsiz" (yakuniy) bo'ladi.
    Telegram'dagi tugmali xabarlar ham shunga mos yangilanadi."""
    note = db.query(models.AttendanceNote).filter(models.AttendanceNote.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Topilmadi")
    approve = data.status == "sababli"
    try:
        prev = note_flow.apply_review(db, note, current, approve)
    except note_flow.ReviewError as e:
        raise HTTPException(status_code=400 if note.review_status not in note_flow.PENDING else 403, detail=str(e))
    background.add_task(note_flow.after_review, note.id, prev, current.id, approve, "sayt")
    return _note_out(note)


@router.get("/office")
def office_info(
    db: Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    """Frontend uchun joriy xodimning ish joyiga (vazirlik/labaratoriya) mos koordinata va radius."""
    loc_lat, loc_lng, loc_radius = _location_for(db, current)
    return {
        "latitude": loc_lat,
        "longitude": loc_lng,
        "radius_m": loc_radius,
        "work_start": f"{WORK_START_HOUR:02d}:{WORK_START_MIN:02d}",
        "late_grace_min": late_grace_for(),
        "work_location": current.work_location,
    }
