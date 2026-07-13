from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date
from core.database import get_pg_db
from services.auth import get_current_user
from models.models import User, Leave, LeaveType, LeaveStatusEnum, RoleEnum

router = APIRouter(prefix="/api/leave", tags=["Leave"])

class LeaveApply(BaseModel):
    leave_type_id: int
    from_date: str
    to_date: str
    days: float
    reason: Optional[str] = ""

class ApproveIn(BaseModel):
    remarks: Optional[str] = ""

class RejectIn(BaseModel):
    reason: str

def _leave_dict(l, db):
    lt = db.query(LeaveType).filter(LeaveType.id == l.leave_type_id).first()
    emp = db.query(User).filter(User.id == l.emp_id).first()
    return {
        "id": l.id, "emp_id": l.emp_id,
        "emp_code": emp.emp_code if emp else "",
        "employee_name": emp.name if emp else "",
        "leave_type_id": l.leave_type_id,
        "leave_type_name": lt.name if lt else "",
        "from_date": str(l.from_date), "to_date": str(l.to_date),
        "days": l.days, "reason": l.reason,
        "status": l.status.value if l.status else "pending",
        "created_at": str(l.created_at) if l.created_at else "",
    }

@router.get("/types")
def get_types(db: Session = Depends(get_pg_db), user: User = Depends(get_current_user)):
    types = db.query(LeaveType).all()
    if not types:
        # seed default leave types
        defaults = [
            LeaveType(name="Casual Leave", code="CL", max_days_per_year=12, is_paid=True),
            LeaveType(name="Sick Leave", code="SL", max_days_per_year=12, is_paid=True),
            LeaveType(name="Earned Leave", code="EL", max_days_per_year=15, carry_forward=True, is_paid=True),
            LeaveType(name="Loss of Pay", code="LOP", max_days_per_year=30, is_paid=False),
            LeaveType(name="Maternity Leave", code="ML", max_days_per_year=180, is_paid=True),
        ]
        for t in defaults:
            db.add(t)
        db.commit()
        types = db.query(LeaveType).all()
    return [{"id": t.id, "name": t.name, "code": t.code, "max_days": t.max_days_per_year, "is_paid": t.is_paid} for t in types]

class LeaveTypeIn(BaseModel):
    name: str
    code: str
    max_days_per_year: int
    is_paid: bool = True

@router.post("/types")
def add_type(payload: LeaveTypeIn, db: Session = Depends(get_pg_db), admin: User = Depends(get_current_user)):
    if admin.role not in [RoleEnum.hr_admin, RoleEnum.it_admin]:
        raise HTTPException(403, "Not authorized")
    lt = LeaveType(name=payload.name, code=payload.code, max_days_per_year=payload.max_days_per_year, is_paid=payload.is_paid)
    db.add(lt)
    db.commit()
    return {"message": "Leave type added"}

@router.delete("/types/{type_id}")
def delete_type(type_id: int, db: Session = Depends(get_pg_db), admin: User = Depends(get_current_user)):
    if admin.role not in [RoleEnum.hr_admin, RoleEnum.it_admin]:
        raise HTTPException(403, "Not authorized")
    lt = db.query(LeaveType).filter(LeaveType.id == type_id).first()
    if not lt: raise HTTPException(404, "Not found")
    db.delete(lt)
    db.commit()
    return {"message": "Leave type deleted"}

@router.get("/balance")
def get_balance(db: Session = Depends(get_pg_db), user: User = Depends(get_current_user)):
    types = db.query(LeaveType).all()
    year = datetime.now().year
    result = []
    for t in types:
        used = db.query(Leave).filter(
            Leave.emp_id == user.id,
            Leave.leave_type_id == t.id,
            Leave.status == LeaveStatusEnum.approved,
        ).with_entities(Leave.days).all()
        used_days = sum(u.days for u in used) if used else 0
        result.append({
            "leave_type": t.name, "code": t.code,
            "total": t.max_days_per_year,
            "used": used_days,
            "remaining": max(0, t.max_days_per_year - used_days)
        })
    return result

@router.get("/my")
def my_leaves(db: Session = Depends(get_pg_db), user: User = Depends(get_current_user)):
    leaves = db.query(Leave).filter(Leave.emp_id == user.id).order_by(Leave.created_at.desc()).all()
    return [_leave_dict(l, db) for l in leaves]

@router.get("/pending")
def pending_approvals(db: Session = Depends(get_pg_db), user: User = Depends(get_current_user)):
    if user.role not in [RoleEnum.hr_admin, RoleEnum.dept_head]:
        raise HTTPException(403, "Not authorized")
    leaves = db.query(Leave).filter(Leave.status == LeaveStatusEnum.pending).order_by(Leave.created_at.desc()).all()
    return [_leave_dict(l, db) for l in leaves]

@router.post("/apply")
def apply_leave(payload: LeaveApply, db: Session = Depends(get_pg_db), user: User = Depends(get_current_user)):
    leave = Leave(
        emp_id=user.id,
        leave_type_id=payload.leave_type_id,
        from_date=date.fromisoformat(payload.from_date),
        to_date=date.fromisoformat(payload.to_date),
        days=payload.days,
        reason=payload.reason,
        status=LeaveStatusEnum.pending,
    )
    db.add(leave)
    db.commit()
    return {"message": "Leave applied", "id": leave.id}

@router.post("/{leave_id}/approve")
def approve_leave(leave_id: int, payload: ApproveIn, db: Session = Depends(get_pg_db), user: User = Depends(get_current_user)):
    if user.role not in [RoleEnum.hr_admin, RoleEnum.dept_head]:
        raise HTTPException(403, "Not authorized")
    leave = db.query(Leave).filter(Leave.id == leave_id).first()
    if not leave:
        raise HTTPException(404, "Leave not found")
    leave.status = LeaveStatusEnum.approved
    leave.approved_by = user.id
    leave.approved_at = datetime.utcnow()
    db.commit()
    return {"message": "Leave approved"}

@router.post("/{leave_id}/reject")
def reject_leave(leave_id: int, payload: RejectIn, db: Session = Depends(get_pg_db), user: User = Depends(get_current_user)):
    if user.role not in [RoleEnum.hr_admin, RoleEnum.dept_head]:
        raise HTTPException(403, "Not authorized")
    leave = db.query(Leave).filter(Leave.id == leave_id).first()
    if not leave:
        raise HTTPException(404, "Leave not found")
    leave.status = LeaveStatusEnum.rejected
    leave.rejection_reason = payload.reason
    leave.approved_by = user.id
    leave.approved_at = datetime.utcnow()
    db.commit()
    return {"message": "Leave rejected"}

@router.post("/{leave_id}/cancel")
def cancel_leave(leave_id: int, db: Session = Depends(get_pg_db), user: User = Depends(get_current_user)):
    leave = db.query(Leave).filter(Leave.id == leave_id, Leave.emp_id == user.id).first()
    if not leave:
        raise HTTPException(404, "Leave not found")
    if leave.status != LeaveStatusEnum.pending:
        raise HTTPException(400, "Only pending leaves can be cancelled")
    leave.status = LeaveStatusEnum.cancelled
    db.commit()
    return {"message": "Leave cancelled"}
