from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..schemas import EmployeeOut, EmployeeCreate, EmployeeUpdate, PhotoIn, SetRoleIn
from ..auth import get_password_hash
from ..deps import get_current_employee, require_superadmin
from .. import models

router = APIRouter(prefix="/employees", tags=["Employees"])


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
        update_data["hashed_password"] = get_password_hash(update_data.pop("password"))

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


@router.delete("/{emp_id}", status_code=204)
def delete_employee(
    emp_id: int,
    db: Session = Depends(get_db),
    _: models.Employee = Depends(require_superadmin),
):
    emp = db.query(models.Employee).filter(models.Employee.id == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")
    db.delete(emp)
    db.commit()
