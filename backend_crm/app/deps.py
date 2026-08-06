import os
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from .database import get_db
from .auth import decode_token
from . import models

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_employee(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> models.Employee:
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token yaroqsiz yoki muddati o'tgan",
        headers={"WWW-Authenticate": "Bearer"},
    )
    phone = decode_token(token)
    if not phone:
        raise exc
    # is_active — faqat "ball berish/statistikada hisoblanadi" belgisi (mehnat ta'tili,
    # bolnichniy va h.k. paytida false bo'ladi), tizimga kirish huquqiga ta'sir qilmaydi.
    emp = db.query(models.Employee).filter(models.Employee.phone == phone).first()
    if not emp:
        raise exc
    return emp


def require_superadmin(
    current: models.Employee = Depends(get_current_employee),
) -> models.Employee:
    if current.role != models.RoleEnum.superadmin:
        raise HTTPException(status_code=403, detail="Faqat superadmin uchun")
    return current


def require_manager(
    current: models.Employee = Depends(get_current_employee),
) -> models.Employee:
    allowed = {
        models.RoleEnum.superadmin,
        models.RoleEnum.bolim_boshligi,
        models.RoleEnum.boshqarma_boshligi,
    }
    if current.role not in allowed:
        raise HTTPException(status_code=403, detail="Ruxsat yo'q")
    return current


def require_bot_secret(x_bot_secret: str = Header(...)) -> None:
    """Faqat add_account_bot ichki xizmati chaqira oladigan endpointlar uchun."""
    expected = os.getenv("BOT_INTERNAL_SECRET")
    if not expected or x_bot_secret != expected:
        raise HTTPException(status_code=403, detail="Ruxsat yo'q")
