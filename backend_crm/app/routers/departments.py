from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..schemas import DepartmentOut, DepartmentCreate
from ..deps import get_current_employee, require_superadmin
from .. import models

router = APIRouter(prefix="/departments", tags=["Departments"])


@router.get("/", response_model=List[DepartmentOut])
def list_departments(
    db: Session = Depends(get_db),
    _: models.Employee = Depends(get_current_employee),
):
    return db.query(models.Department).order_by(models.Department.id).all()


@router.post("/", response_model=DepartmentOut, status_code=201)
def create_department(
    data: DepartmentCreate,
    db: Session = Depends(get_db),
    _: models.Employee = Depends(require_superadmin),
):
    dept = models.Department(**data.model_dump())
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return dept


@router.get("/{dept_id}", response_model=DepartmentOut)
def get_department(
    dept_id: int,
    db: Session = Depends(get_db),
    _: models.Employee = Depends(get_current_employee),
):
    dept = db.query(models.Department).filter(models.Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Bo'lim topilmadi")
    return dept


@router.put("/{dept_id}", response_model=DepartmentOut)
def update_department(
    dept_id: int,
    data: DepartmentCreate,
    db: Session = Depends(get_db),
    _: models.Employee = Depends(require_superadmin),
):
    dept = db.query(models.Department).filter(models.Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Bo'lim topilmadi")
    for k, v in data.model_dump().items():
        setattr(dept, k, v)
    db.commit()
    db.refresh(dept)
    return dept


@router.delete("/{dept_id}", status_code=204)
def delete_department(
    dept_id: int,
    db: Session = Depends(get_db),
    _: models.Employee = Depends(require_superadmin),
):
    dept = db.query(models.Department).filter(models.Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Bo'lim topilmadi")
    db.delete(dept)
    db.commit()
