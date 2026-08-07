import math
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from .. import models, schemas
from ..database import get_db
from ..deps import get_current_employee, require_superadmin

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


def _to_out(rec: models.Attendance) -> schemas.AttendanceOut:
    """ORM yozuvni AttendanceOut'ga aylantiradi — kechikish va mahalliy vaqt bilan."""
    # check_in DB'da UTC+5 saqlangan (naive). Mahalliy vaqt sifatida o'qiymiz.
    ci = rec.check_in
    if ci.tzinfo is not None:
        ci_local = ci.astimezone(TZ_UZ)
    else:
        ci_local = ci  # allaqachon UTC+5 (naive)

    work_start = ci_local.replace(hour=WORK_START_HOUR, minute=WORK_START_MIN, second=0, microsecond=0)
    diff = (ci_local - work_start).total_seconds() / 60.0
    late = max(0, int(round(diff)))   # 09:00 dan oldin kelsa 0

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
    return [_to_out(r) for r in recs]


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
    rec = (
        db.query(models.Attendance)
        .filter(models.Attendance.date == date)
        .order_by(models.Attendance.check_in.asc())
        .first()
    )
    if not rec or not rec.employee:
        return {"photo_base64": None}
    return {"photo_base64": rec.employee.photo_base64}


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
    avtomatik kunlik) funksiyalari uchun umumiy."""
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
    # qamrab oladigan) — 09:00 eslatmasida (guruh va shaxsiy) qayta so'ralmasin.
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
    if n.reviewer:
        out.reviewed_by_nomi = n.reviewer.full_name
    return out


@router.post("/notes", response_model=schemas.AttendanceNoteOut)
def create_note(
    data:    schemas.AttendanceNoteIn,
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

    note = models.AttendanceNote(
        employee_id=current.id,
        note_type=data.note_type,
        text=data.text,
        date_from=data.date_from,
        date_to=data.date_to,
        expected_time=data.expected_time,
        object_time_from=data.object_time_from,
        object_time_to=data.object_time_to,
        object_latitude=data.object_latitude,
        object_longitude=data.object_longitude,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return _note_out(note)


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
    db:      Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    """Bo'lim boshlig'i — o'z bo'limidagi oddiy xodimlarning izohlarini,
    kadr roli — barcha (jumladan bo'lim boshliqlaridan kelgan) izohlarni ko'radi."""
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
        q = db.query(models.AttendanceNote)
    else:
        raise HTTPException(status_code=403, detail="Ruxsat yo'q")

    notes = q.order_by(models.AttendanceNote.created_at.desc()).limit(200).all()
    return [_note_out(n) for n in notes]


@router.post("/notes/{note_id}/review", response_model=schemas.AttendanceNoteOut)
def review_note(
    note_id: int,
    data:    schemas.AttendanceNoteReviewIn,
    db:      Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    """Kadr roli izohni ko'rib chiqadi: 'sababli' (tasdiqlangan) yoki
    'sababsiz' (rad etilgan) deb belgilaydi."""
    if current.role != models.RoleEnum.kadr:
        raise HTTPException(status_code=403, detail="Ruxsat yo'q")
    note = db.query(models.AttendanceNote).filter(models.AttendanceNote.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Topilmadi")

    note.review_status = data.status
    note.reviewed_by = current.id
    note.reviewed_at = datetime.utcnow()
    db.commit()
    db.refresh(note)
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
        "work_location": current.work_location,
    }
