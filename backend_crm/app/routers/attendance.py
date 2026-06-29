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
    dist = haversine_m(payload.latitude, payload.longitude, OFFICE_LAT, OFFICE_LNG)
    if dist > RADIUS_M:
        raise HTTPException(
            status_code=400,
            detail=f"Siz ofis hududida emassiz. Binogacha {int(dist)} metr "
                   f"(ruxsat: {int(RADIUS_M)} m ichida).",
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


@router.get("/admin/day", response_model=List[schemas.AdminDavomatRow])
def admin_day(
    date: str = None,
    db: Session = Depends(get_db),
    _: models.Employee = Depends(require_superadmin),
):
    """Superadmin: berilgan sanada barcha xodimlarning davomat holati."""
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


@router.get("/office")
def office_info():
    """Frontend uchun ofis koordinatasi va radius."""
    return {
        "latitude": OFFICE_LAT,
        "longitude": OFFICE_LNG,
        "radius_m": RADIUS_M,
        "work_start": f"{WORK_START_HOUR:02d}:{WORK_START_MIN:02d}",
    }
