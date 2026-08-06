from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..auth import verify_password, create_access_token
from ..schemas import LoginRequest, LoginResponse, EmployeeOut
from ..deps import get_current_employee
from .. import models
from .employees import revert_expired_statuses

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/login", response_model=LoginResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    revert_expired_statuses(db)

    emp = db.query(models.Employee).filter(models.Employee.phone == data.phone).first()
    if not emp or not verify_password(data.password, emp.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Telefon raqam yoki parol noto'g'ri",
        )
    # is_active — faqat "ball berish/statistikada hisoblanadi" belgisi (mehnat ta'tili,
    # bolnichniy va h.k. paytida false bo'ladi) — tizimga kirishni bloklamaydi.

    token = create_access_token({"sub": emp.phone})
    return LoginResponse(
        access_token=token,
        id=emp.id,
        full_name=emp.full_name,
        role=emp.role,
        department_id=emp.department_id,
        phone=emp.phone,
    )


@router.get("/me", response_model=EmployeeOut)
def me(current: models.Employee = Depends(get_current_employee)):
    return current
