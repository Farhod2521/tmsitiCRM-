import secrets
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List
from ..database import get_db
from ..schemas import (
    EmployeeOut, EmployeeCreate, EmployeeUpdate, PhotoIn, SetRoleIn, SetStatusIn,
    EmployeePasswordOut, TelegramLinkTokenOut,
    PasswordResetRequestOut, PasswordResetVerifyIn, PasswordResetConfirmIn,
)
from ..auth import get_password_hash, encrypt_password, decrypt_password
from ..deps import get_current_employee, require_superadmin
from ..telegram import send_telegram_message_to
from .. import models

router = APIRouter(prefix="/employees", tags=["Employees"])

TELEGRAM_LINK_TOKEN_TTL = timedelta(minutes=10)
PASSWORD_RESET_TTL = timedelta(minutes=3)


@router.get("/", response_model=List[EmployeeOut])
def list_employees(
    db: Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    # Superadmin / Direktor / Zamdirektor / Kadr / Ijro — barchani ko'radi
    if current.role in {models.RoleEnum.superadmin, models.RoleEnum.direktor, models.RoleEnum.zamdirektor,
                        models.RoleEnum.kadr, models.RoleEnum.ijro}:
        return db.query(models.Employee).order_by(models.Employee.id).all()

    # Bo'lim/boshqarma boshlig'i — faqat o'z bo'limini
    if current.role in {models.RoleEnum.bolim_boshligi, models.RoleEnum.boshqarma_boshligi}:
        if current.department_id is None:
            return []
        return (
            db.query(models.Employee)
            .filter(models.Employee.department_id == current.department_id)
            .order_by(models.Employee.id)
            .all()
        )

    # Oddiy xodim — faqat o'zini
    return [current]


@router.post("/", response_model=EmployeeOut, status_code=201)
def create_employee(
    data: EmployeeCreate,
    db: Session = Depends(get_db),
    _: models.Employee = Depends(require_superadmin),
):
    if db.query(models.Employee).filter(models.Employee.phone == data.phone).first():
        raise HTTPException(status_code=400, detail="Bu telefon raqam allaqachon ro'yxatda bor")

    emp = models.Employee(
        full_name=data.full_name,
        position=data.position,
        department_id=data.department_id,
        work_rate=data.work_rate,
        phone=data.phone,
        hashed_password=get_password_hash(data.password),
        enc_password=encrypt_password(data.password),
        role=data.role,
    )
    db.add(emp)
    db.commit()
    db.refresh(emp)
    return emp


@router.get("/me", response_model=EmployeeOut)
def get_me(current: models.Employee = Depends(get_current_employee)):
    return current


@router.get("/me/photo")
def get_my_photo(current: models.Employee = Depends(get_current_employee)):
    """Xodimning profil rasmini qaytaradi (yuz tanish uchun)."""
    return {"photo_base64": current.photo_base64}


@router.patch("/me/photo")
def update_my_photo(
    data: PhotoIn,
    db: Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    """Xodimning profil rasmini yangilaydi."""
    current.photo_base64 = data.photo_base64
    db.commit()
    return {"ok": True}


@router.post("/me/telegram-link-token", response_model=TelegramLinkTokenOut)
def create_telegram_link_token(
    db: Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    """CRM profilidagi "Telegram" tugmasi bosilganda chaqiriladi — bir martalik,
    tez muddati tugaydigan token yaratadi. Bot shu token orqali xodimni aniqlaydi
    (telefon raqami deep-linkda ochiq yuborilmaydi)."""
    token = secrets.token_urlsafe(24)  # faqat [A-Za-z0-9_-] — Telegram start-param uchun xavfsiz
    db.add(models.TelegramLinkToken(
        token=token,
        employee_id=current.id,
        expires_at=datetime.utcnow() + TELEGRAM_LINK_TOKEN_TTL,
    ))
    db.commit()
    return TelegramLinkTokenOut(token=token, expires_in=int(TELEGRAM_LINK_TOKEN_TTL.total_seconds()))


@router.post("/me/password-reset/request", response_model=PasswordResetRequestOut)
def request_password_reset(
    db:      Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    """Profildan parolni o'zgartirish: Telegramga 5 xonali tasdiqlash kodi
    yuboriladi (3 daqiqa amal qiladi)."""
    if not current.telegram_id:
        raise HTTPException(status_code=400, detail="Avval Telegram orqali hisobingizni bog'lang")

    code = f"{secrets.randbelow(100000):05d}"
    db.add(models.PasswordResetCode(
        employee_id=current.id,
        code=code,
        expires_at=datetime.utcnow() + PASSWORD_RESET_TTL,
    ))
    db.commit()

    text = (
        f"\U0001F510 Parolni o'zgartirish kodi: {code}\n\n"
        f"Kod 3 daqiqa amal qiladi. Agar bu so'rovni siz yubormagan bo'lsangiz, "
        f"xabarni e'tiborsiz qoldiring."
    )
    ok = send_telegram_message_to(current.telegram_id, text)
    if not ok:
        raise HTTPException(status_code=502, detail="Telegramga xabar yuborib bo'lmadi")
    return PasswordResetRequestOut(sent=True, expires_in_seconds=int(PASSWORD_RESET_TTL.total_seconds()))


def _get_valid_reset_code(db: Session, employee_id: int, code: str) -> models.PasswordResetCode:
    reset = (
        db.query(models.PasswordResetCode)
        .filter(models.PasswordResetCode.employee_id == employee_id)
        .order_by(models.PasswordResetCode.created_at.desc())
        .first()
    )
    if not reset or reset.used_at is not None:
        raise HTTPException(status_code=400, detail="Kod topilmadi. Qaytadan so'rang.")
    if reset.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Kod muddati tugagan. Qaytadan so'rang.")
    if reset.code != code:
        raise HTTPException(status_code=400, detail="Kod noto'g'ri")
    return reset


@router.post("/me/password-reset/verify")
def verify_password_reset(
    data:    PasswordResetVerifyIn,
    db:      Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    """Kodni tekshiradi (hali sarflamaydi) — muvaffaqiyatli bo'lsa, forma
    yangi parol kiritish bosqichiga o'tadi."""
    _get_valid_reset_code(db, current.id, data.code)
    return {"ok": True}


@router.post("/me/password-reset/confirm")
def confirm_password_reset(
    data:    PasswordResetConfirmIn,
    db:      Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    """Kodni yana bir bor tekshirib, yangi parolni o'rnatadi va Telegram orqali
    tasdiqlash xabarini yuboradi."""
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Parol kamida 6 belgidan iborat bo'lishi kerak")
    reset = _get_valid_reset_code(db, current.id, data.code)

    current.hashed_password = get_password_hash(data.new_password)
    current.enc_password = encrypt_password(data.new_password)
    reset.used_at = datetime.utcnow()
    db.commit()

    text = (
        f"✅ Parolingiz muvaffaqiyatli yangilandi.\n\n"
        f"Login: {current.phone}\n"
        f"Yangi parol: {data.new_password}"
    )
    send_telegram_message_to(current.telegram_id, text)
    return {"ok": True}


@router.get("/passwords", response_model=List[EmployeePasswordOut])
def list_passwords(
    db: Session = Depends(get_db),
    _: models.Employee = Depends(require_superadmin),
):
    """Xodimlarning joriy (qaytarib olingan) parollari — faqat superadmin uchun.
    Faqat migratsiyadan keyin yaratilgan/paroli o'zgartirilgan xodimlarda mavjud bo'ladi."""
    emps = db.query(models.Employee).all()
    return [
        EmployeePasswordOut(id=e.id, password=decrypt_password(e.enc_password) if e.enc_password else None)
        for e in emps
    ]


@router.get("/{emp_id}", response_model=EmployeeOut)
def get_employee(
    emp_id: int,
    db: Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    emp = db.query(models.Employee).filter(models.Employee.id == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")

    if current.role == models.RoleEnum.superadmin:
        return emp
    if current.role in {models.RoleEnum.bolim_boshligi, models.RoleEnum.boshqarma_boshligi}:
        if emp.department_id != current.department_id:
            raise HTTPException(status_code=403, detail="Ruxsat yo'q")
        return emp
    if current.id != emp_id:
        raise HTTPException(status_code=403, detail="Ruxsat yo'q")
    return emp


@router.put("/{emp_id}", response_model=EmployeeOut)
def update_employee(
    emp_id: int,
    data: EmployeeUpdate,
    db: Session = Depends(get_db),
    current: models.Employee = Depends(get_current_employee),
):
    emp = db.query(models.Employee).filter(models.Employee.id == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")

    # Faqat superadmin boshqani o'zgartira oladi
    if current.role != models.RoleEnum.superadmin and current.id != emp_id:
        raise HTTPException(status_code=403, detail="Ruxsat yo'q")

    update_data = data.model_dump(exclude_unset=True)
    if "password" in update_data:
        plain = update_data.pop("password")
        update_data["hashed_password"] = get_password_hash(plain)
        update_data["enc_password"] = encrypt_password(plain)

    for key, value in update_data.items():
        setattr(emp, key, value)

    db.commit()
    db.refresh(emp)
    return emp


@router.patch("/{emp_id}/set-role", response_model=EmployeeOut)
def set_employee_role(
    emp_id: int,
    data: SetRoleIn,
    db: Session = Depends(get_db),
    _: models.Employee = Depends(require_superadmin),
):
    """Xodimga rol belgilash (superadmin)."""
    emp = db.query(models.Employee).filter(models.Employee.id == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")
    emp.role = data.role
    db.commit()
    db.refresh(emp)
    return emp


@router.patch("/{emp_id}/set-status", response_model=EmployeeOut)
def set_employee_status(
    emp_id: int,
    data: SetStatusIn,
    db: Session = Depends(get_db),
    _: models.Employee = Depends(require_superadmin),
):
    """Xodim holatini belgilash: faol / otpuska / dekret (superadmin).
    Otpuska va dekretda is_active=False bo'ladi — ball berishda chiqmaydi,
    lekin Bo'limlar sahifasida xodim sifatida (status bilan) ko'rinishda qoladi."""
    emp = db.query(models.Employee).filter(models.Employee.id == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")
    emp.status = data.status
    emp.is_active = (data.status == models.EmployeeStatusEnum.faol)
    db.commit()
    db.refresh(emp)
    return emp


@router.delete("/{emp_id}", status_code=204)
def delete_employee(
    emp_id: int,
    db: Session = Depends(get_db),
    _: models.Employee = Depends(require_superadmin),
):
    emp = db.query(models.Employee).filter(models.Employee.id == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")

    # Xodimga tegishli yozuvlarni tozalash (FK cheklovi sabab o'chirish
    # muvaffaqiyatsiz bo'lmasligi uchun). Xodim mualliflik qilgan (lekin
    # boshqa birovga tegishli) yozuvlarda esa faqat muallif ko'rsatkichi
    # bo'shatiladi — begona ma'lumot o'chirilmaydi.
    db.query(models.TabelRecord).filter(models.TabelRecord.employee_id == emp_id).delete()
    db.query(models.TabelRecord).filter(models.TabelRecord.created_by == emp_id).update({"created_by": None})
    db.query(models.Attendance).filter(models.Attendance.employee_id == emp_id).delete()
    db.query(models.Score).filter(models.Score.employee_id == emp_id).delete()
    db.query(models.Score).filter(models.Score.created_by == emp_id).update({"created_by": None})
    db.query(models.IjroDocument).filter(models.IjroDocument.masul_orinbosar_id == emp_id).update({"masul_orinbosar_id": None})
    db.query(models.IjroDocument).filter(models.IjroDocument.created_by == emp_id).update({"created_by": None})
    db.query(models.IjroDocBolim).filter(models.IjroDocBolim.qaror_by == emp_id).update({"qaror_by": None})
    db.query(models.IjroDocBolim).filter(models.IjroDocBolim.xodim_id == emp_id).update({"xodim_id": None, "xodim_assigned_at": None})
    db.query(models.IjroDocBolim).filter(models.IjroDocBolim.yakunlagan_by == emp_id).update({"yakunlagan_by": None})
    db.query(models.IjroDocBolimAssignLog).filter(models.IjroDocBolimAssignLog.xodim_id == emp_id).delete()
    db.query(models.IjroDocBolimAssignLog).filter(models.IjroDocBolimAssignLog.assigned_by == emp_id).update({"assigned_by": None})
    db.query(models.WeeklyReport).filter(models.WeeklyReport.employee_id == emp_id).delete()
    db.query(models.WeeklyReport).filter(models.WeeklyReport.confirmed_by == emp_id).update({"confirmed_by": None})
    db.query(models.TelegramLinkToken).filter(models.TelegramLinkToken.employee_id == emp_id).delete()
    db.query(models.AttendanceNote).filter(models.AttendanceNote.employee_id == emp_id).delete()
    db.query(models.AttendanceNote).filter(models.AttendanceNote.reviewed_by == emp_id).update({"reviewed_by": None})
    db.query(models.PasswordResetCode).filter(models.PasswordResetCode.employee_id == emp_id).delete()

    db.delete(emp)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        print(f"[delete_employee] IntegrityError for emp_id={emp_id}: {exc}")
        raise HTTPException(status_code=400, detail="Xodimni o'chirib bo'lmadi — unga bog'liq ma'lumotlar mavjud")
