from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..schemas import LocationSettingOut, LocationSettingIn
from ..deps import require_superadmin
from .. import models

router = APIRouter(prefix="/locations", tags=["Locations"])


@router.get("/", response_model=List[LocationSettingOut])
def list_locations(
    db: Session = Depends(get_db),
    _: models.Employee = Depends(require_superadmin),
):
    existing = {row.location_type for row in db.query(models.LocationSetting).all()}
    for lt in models.WorkLocationEnum:
        if lt not in existing:
            db.add(models.LocationSetting(location_type=lt, radius_meters=100))
    db.commit()
    return db.query(models.LocationSetting).order_by(models.LocationSetting.location_type).all()


@router.put("/{location_type}", response_model=LocationSettingOut)
def update_location(
    location_type: models.WorkLocationEnum,
    data: LocationSettingIn,
    db: Session = Depends(get_db),
    _: models.Employee = Depends(require_superadmin),
):
    row = db.query(models.LocationSetting).filter(models.LocationSetting.location_type == location_type).first()
    if not row:
        row = models.LocationSetting(location_type=location_type)
        db.add(row)
    row.latitude = data.latitude
    row.longitude = data.longitude
    row.radius_meters = data.radius_meters
    db.commit()
    db.refresh(row)
    return row
