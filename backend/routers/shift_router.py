from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import date
from core.database import get_pg_db, essl_query
from services.auth import get_current_user, require_admin_or_head
from models.models import User, Shift, ShiftAssignment, RoleEnum

router = APIRouter(prefix="/api/shifts", tags=["Shifts"])

class ShiftIn(BaseModel):
    name: str
    code: str
    start_time: str
    end_time: str
    grace_late: int = 15
    grace_early: int = 15
    working_hours: float = 8.0
    is_night: bool = False

class AssignIn(BaseModel):
    emp_code: str
    shift_id: int
    from_date: str
    to_date: Optional[str] = None

def safe_int(v, default=0):
    try:
        return int(float(str(v).strip())) if str(v).strip() else default
    except:
        return default

def safe_float(v, default=8.0):
    try:
        return round(float(str(v).strip()) / 60, 1) if str(v).strip() else default
    except:
        return default

def fmt_time(v):
    if not v: return "00:00"
    s = str(v).strip()
    if ' ' in s: s = s.split(' ')[1]
    return s[:5] if len(s) >= 5 else s

@router.get("/")
def get_shifts(db: Session = Depends(get_pg_db), user: User = Depends(get_current_user)):
    result = []
    try:
        rows = essl_query("""
            SELECT ShiftId, ShiftFName, ShiftSName, BeginTime, EndTime,
                   ShiftDuration, GraceTime, ShiftType
            FROM Shifts ORDER BY ShiftFName
        """)
        for s in rows:
            result.append({
                "id": f"essl_{s.get('ShiftId')}",
                "name": s.get("ShiftFName") or "",
                "code": s.get("ShiftSName") or s.get("ShiftFName", "")[:10],
                "start_time": fmt_time(s.get("BeginTime")),
                "end_time": fmt_time(s.get("EndTime")),
                "working_hours": safe_float(s.get("ShiftDuration"), 8.0),
                "grace_late": safe_int(s.get("GraceTime"), 15),
                "grace_early": safe_int(s.get("GraceTime"), 15),
                "is_night": s.get("ShiftType") == "N",
                "source": "essl"
            })
    except Exception as ex:
        import logging
        logging.getLogger(__name__).warning(f"eSSL shifts: {ex}")
        result.append({
            "id": "error", "name": f"ERROR: {str(ex)}", "code": "ERR",
            "start_time": "00:00", "end_time": "00:00",
            "working_hours": 0, "grace_late": 0, "grace_early": 0, "is_night": False, "source": "hrms"
        })

    try:
        for s in db.query(Shift).order_by(Shift.name).all():
            result.append({
                "id": s.id, "name": s.name, "code": s.code,
                "start_time": s.start_time, "end_time": s.end_time,
                "working_hours": s.working_hours, "grace_late": s.grace_late,
                "grace_early": s.grace_early, "is_night": s.is_night, "source": "hrms"
            })
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"HRMS shifts fallback error: {e}")
        
    return result

@router.post("/")
def create_shift(payload: ShiftIn, db: Session = Depends(get_pg_db),
                  user: User = Depends(require_admin_or_head)):
    if db.query(Shift).filter(Shift.code == payload.code).first():
        raise HTTPException(409, "Shift code already exists")
    shift = Shift(**payload.dict())
    db.add(shift); db.commit(); db.refresh(shift)
    return {"message": "Shift created", "id": shift.id}

@router.put("/{shift_id}")
def update_shift(shift_id: int, payload: ShiftIn, db: Session = Depends(get_pg_db),
                  user: User = Depends(require_admin_or_head)):
    shift = db.query(Shift).filter(Shift.id == shift_id).first()
    if not shift: raise HTTPException(404, "Shift not found")
    for k, v in payload.dict().items(): setattr(shift, k, v)
    db.commit()
    return {"message": "Shift updated"}

class BulkDeleteIn(BaseModel):
    ids: list[int]

@router.post("/bulk-delete")
def bulk_delete_shifts(payload: BulkDeleteIn, db: Session = Depends(get_pg_db), admin: User = Depends(require_admin)):
    db.query(Shift).filter(Shift.id.in_(payload.ids)).delete(synchronize_session=False)
    db.commit()
    return {"message": f"Deleted {len(payload.ids)} shifts"}

@router.delete("/{shift_id}")
def delete_shift(shift_id: int, db: Session = Depends(get_pg_db),
                  user: User = Depends(require_admin_or_head)):
    shift = db.query(Shift).filter(Shift.id == shift_id).first()
    if not shift: raise HTTPException(404, "Shift not found")
    db.delete(shift); db.commit()
    return {"message": "Shift deleted"}

@router.post("/assign")
def assign_shift(payload: AssignIn, db: Session = Depends(get_pg_db),
                  user: User = Depends(require_admin_or_head)):
    emp = db.query(User).filter(User.emp_code == payload.emp_code).first()
    if not emp: raise HTTPException(404, "Employee not found in HRMS")
    a = ShiftAssignment(
        emp_id=emp.id, shift_id=payload.shift_id,
        from_date=date.fromisoformat(payload.from_date),
        to_date=date.fromisoformat(payload.to_date) if payload.to_date else None,
        created_by=user.id
    )
    db.add(a); db.commit()
    return {"message": "Shift assigned"}

@router.get("/assignments")
def get_assignments(db: Session = Depends(get_pg_db), user: User = Depends(get_current_user)):
    result = []
    for a in db.query(ShiftAssignment).order_by(ShiftAssignment.from_date.desc()).limit(100).all():
        emp = db.query(User).filter(User.id == a.emp_id).first()
        shift = db.query(Shift).filter(Shift.id == a.shift_id).first()
        result.append({
            "id": a.id,
            "emp_code": emp.emp_code if emp else "",
            "emp_name": emp.name if emp else "",
            "shift_name": shift.name if shift else "",
            "shift_code": shift.code if shift else "",
            "from_date": str(a.from_date),
            "to_date": str(a.to_date) if a.to_date else None,
        })
    return result
