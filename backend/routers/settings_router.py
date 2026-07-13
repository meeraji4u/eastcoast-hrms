from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from core.database import get_pg_db
from models.models import AppSetting, User, RoleEnum
from services.auth import require_admin

router = APIRouter(prefix="/api/settings", tags=["Settings"])

class SettingsUpdate(BaseModel):
    month_start_day: int

@router.get("/")
def get_settings(db: Session = Depends(get_pg_db)):
    setting = db.query(AppSetting).first()
    if not setting:
        setting = AppSetting(month_start_day=1)
        db.add(setting)
        db.commit()
    return {"month_start_day": setting.month_start_day}

@router.put("/")
def update_settings(payload: SettingsUpdate, db: Session = Depends(get_pg_db), admin: User = Depends(require_admin)):
    setting = db.query(AppSetting).first()
    if not setting:
        setting = AppSetting(month_start_day=payload.month_start_day)
        db.add(setting)
    else:
        setting.month_start_day = payload.month_start_day
    db.commit()
    return {"message": "Settings updated successfully", "month_start_day": setting.month_start_day}
