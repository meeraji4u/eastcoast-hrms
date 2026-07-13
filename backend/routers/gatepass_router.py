from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import Column, Integer, String, DateTime, Date, Boolean, Text, ForeignKey, Enum
from sqlalchemy.orm import Session, relationship
from sqlalchemy.sql import func
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date
import secrets, json
from core.database import get_pg_db, Base, pg_engine
from services.auth import get_current_user, require_admin_or_head
from models.models import User, RoleEnum
import enum

class GPStatusEnum(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    used = "used"
    expired = "expired"

class GatePass(Base):
    __tablename__ = "gate_passes"
    id = Column(Integer, primary_key=True)
    emp_id = Column(Integer, ForeignKey("users.id"))
    reason = Column(Text, nullable=False)
    pass_date = Column(Date, nullable=False)
    out_time = Column(String(5))
    expected_return = Column(String(5))
    pass_type = Column(String(20), default="personal")  # personal, official, medical
    status = Column(String(20), default="pending")
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    qr_token = Column(String(100), unique=True, nullable=True)
    qr_used_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

Base.metadata.create_all(bind=pg_engine)

router = APIRouter(prefix="/api/gatepass", tags=["Gate Pass"])

class GPApply(BaseModel):
    reason: str
    pass_date: str
    out_time: str
    expected_return: str
    pass_type: str = "personal"

class GPAction(BaseModel):
    remarks: Optional[str] = ""

class GPReject(BaseModel):
    reason: str

def _gp_dict(gp, db):
    emp = db.query(User).filter(User.id == gp.emp_id).first()
    approver = db.query(User).filter(User.id == gp.approved_by).first() if gp.approved_by else None
    return {
        "id": gp.id,
        "emp_code": emp.emp_code if emp else "",
        "emp_name": emp.name if emp else "",
        "reason": gp.reason,
        "pass_date": str(gp.pass_date),
        "out_time": gp.out_time,
        "expected_return": gp.expected_return,
        "pass_type": gp.pass_type,
        "status": gp.status,
        "approved_by_name": approver.name if approver else None,
        "approved_at": str(gp.approved_at) if gp.approved_at else None,
        "rejection_reason": gp.rejection_reason,
        "qr_token": gp.qr_token if gp.status == "approved" else None,
        "created_at": str(gp.created_at) if gp.created_at else "",
    }

@router.post("/apply")
def apply_gatepass(payload: GPApply, db: Session = Depends(get_pg_db),
                    user: User = Depends(get_current_user)):
    gp = GatePass(
        emp_id=user.id, reason=payload.reason,
        pass_date=date.fromisoformat(payload.pass_date),
        out_time=payload.out_time, expected_return=payload.expected_return,
        pass_type=payload.pass_type, status="pending"
    )
    db.add(gp); db.commit()
    return {"message": "Gate pass applied", "id": gp.id}

@router.get("/my")
def my_gatepasses(db: Session = Depends(get_pg_db), user: User = Depends(get_current_user)):
    gps = db.query(GatePass).filter(GatePass.emp_id == user.id).order_by(GatePass.created_at.desc()).all()
    return [_gp_dict(g, db) for g in gps]

@router.get("/pending")
def pending_gatepasses(db: Session = Depends(get_pg_db), user: User = Depends(require_admin_or_head)):
    gps = db.query(GatePass).filter(GatePass.status == "pending").order_by(GatePass.created_at.desc()).all()
    return [_gp_dict(g, db) for g in gps]

@router.get("/all")
def all_gatepasses(db: Session = Depends(get_pg_db), user: User = Depends(require_admin_or_head)):
    gps = db.query(GatePass).order_by(GatePass.created_at.desc()).limit(200).all()
    return [_gp_dict(g, db) for g in gps]

@router.post("/{gp_id}/approve")
def approve_gatepass(gp_id: int, payload: GPAction, db: Session = Depends(get_pg_db),
                      user: User = Depends(require_admin_or_head)):
    gp = db.query(GatePass).filter(GatePass.id == gp_id).first()
    if not gp: raise HTTPException(404, "Gate pass not found")
    if gp.status != "pending": raise HTTPException(400, "Already processed")
    gp.status = "approved"
    gp.approved_by = user.id
    gp.approved_at = datetime.utcnow()
    gp.qr_token = secrets.token_urlsafe(32)
    db.commit()
    return {"message": "Gate pass approved", "qr_token": gp.qr_token}

@router.post("/{gp_id}/reject")
def reject_gatepass(gp_id: int, payload: GPReject, db: Session = Depends(get_pg_db),
                     user: User = Depends(require_admin_or_head)):
    gp = db.query(GatePass).filter(GatePass.id == gp_id).first()
    if not gp: raise HTTPException(404, "Gate pass not found")
    if gp.status != "pending": raise HTTPException(400, "Already processed")
    gp.status = "rejected"
    gp.approved_by = user.id
    gp.approved_at = datetime.utcnow()
    gp.rejection_reason = payload.reason
    db.commit()
    return {"message": "Gate pass rejected"}

@router.get("/verify/{token}")
def verify_qr(token: str, db: Session = Depends(get_pg_db)):
    gp = db.query(GatePass).filter(GatePass.qr_token == token).first()
    if not gp: raise HTTPException(404, "Invalid QR code")
    emp = db.query(User).filter(User.id == gp.emp_id).first()
    if gp.status == "used":
        return {"valid": False, "message": "QR already used", "emp_name": emp.name if emp else ""}
    if gp.status != "approved":
        return {"valid": False, "message": f"Gate pass is {gp.status}"}
    gp.status = "used"
    gp.qr_used_at = datetime.utcnow()
    db.commit()
    return {
        "valid": True, "message": "Gate pass verified",
        "emp_name": emp.name if emp else "",
        "emp_code": emp.emp_code if emp else "",
        "pass_date": str(gp.pass_date),
        "out_time": gp.out_time,
        "expected_return": gp.expected_return,
        "reason": gp.reason, "pass_type": gp.pass_type,
    }
