from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Optional
from core.database import get_pg_db
from models.models import User, OTP, OTPPurposeEnum, RoleEnum
from services.auth import hash_password, verify_password, create_token, get_current_user
from services.email_service import generate_otp, send_email, otp_email_template

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

OTP_EXPIRY_MINUTES = 30
MAX_OTP_ATTEMPTS = 5

class LoginIn(BaseModel):
    emp_code: str
    password: str

class RequestOTPIn(BaseModel):
    emp_code: str
    purpose: str

class VerifyOTPIn(BaseModel):
    emp_code: str
    otp: str
    purpose: str
    new_password: str

class ChangePasswordIn(BaseModel):
    old_password: str
    new_password: str

class DirectActivateIn(BaseModel):
    emp_code: str
    new_password: str
    confirm_password: str

def _mask_email(email: str) -> str:
    if not email or "@" not in email:
        return "***"
    name, domain = email.split("@", 1)
    masked = name[0] + "*" * max(1, len(name) - 2) + (name[-1] if len(name) > 1 else "")
    return f"{masked}@{domain}"

def _mask_phone(phone: str) -> str:
    if not phone or len(phone) < 4:
        return "***"
    return "*" * (len(phone) - 4) + phone[-4:]

def _create_and_send_otp(db: Session, user: User, purpose: str, background_tasks: BackgroundTasks):
    otp_code = generate_otp(6)
    otp_row = OTP(
        emp_code=user.emp_code, email=user.email or "",
        otp_code=otp_code, purpose=OTPPurposeEnum(purpose),
        expires_at=datetime.utcnow() + timedelta(minutes=OTP_EXPIRY_MINUTES),
    )
    db.add(otp_row)
    db.commit()
    subject = "EastCoast HRMS — Account Activation OTP" if purpose == "activate" else "EastCoast HRMS — Password Reset OTP"
    html = otp_email_template(user.name, otp_code, purpose)
    if user.email:
        background_tasks.add_task(send_email, user.email, subject, html)
    return otp_row

# ── Login ──────────────────────────────────────────────────────────
@router.post("/login")
def login(payload: LoginIn, db: Session = Depends(get_pg_db)):
    user = db.query(User).filter(User.emp_code == payload.emp_code).first()
    if not user:
        raise HTTPException(401, "Invalid employee code or password")
    if not user.is_activated:
        raise HTTPException(403, "Account not activated. Please activate your account first.")
    if not user.is_active:
        raise HTTPException(403, "Account is deactivated. Contact HR.")
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(401, "Invalid employee code or password")
    token = create_token({"sub": user.emp_code, "role": user.role.value})
    return {
        "access_token": token, "token_type": "bearer",
        "must_change_password": user.must_change_password,
        "user": {
            "emp_code": user.emp_code, "name": user.name,
            "email": user.email, "role": user.role.value,
            "dept_id": user.dept_id,
            "dept": user.department.name if user.department else None,
            "designation": user.designation,
        }
    }

# ── Check activation method ─────────────────────────────────────────
@router.get("/activation-method/{emp_code}")
def get_activation_method(emp_code: str, db: Session = Depends(get_pg_db)):
    """Returns what activation method is available for this employee."""
    user = db.query(User).filter(User.emp_code == emp_code).first()
    if not user:
        raise HTTPException(404, "Employee code not found. Contact HR.")
    if user.is_activated:
        raise HTTPException(400, "Account already activated. Use login or forgot password.")
    has_email = bool(user.email and "@" in user.email)
    return {
        "emp_code": emp_code,
        "name": user.name,
        "has_email": has_email,
        "email_hint": _mask_email(user.email) if has_email else None,
        "can_direct_activate": not has_email,
    }

# ── OTP-based activation (for employees with email) ────────────────
@router.post("/activate/request-otp")
def request_activation_otp(payload: RequestOTPIn, background_tasks: BackgroundTasks,
                            db: Session = Depends(get_pg_db)):
    user = db.query(User).filter(User.emp_code == payload.emp_code).first()
    if not user:
        raise HTTPException(404, "Employee code not found. Contact HR.")
    if user.is_activated:
        raise HTTPException(400, "Account already activated.")
    if not user.email:
        raise HTTPException(400, "No email registered. Use direct activation or contact HR.")
    _create_and_send_otp(db, user, "activate", background_tasks)
    return {
        "message": "OTP sent to your registered email",
        "email_hint": _mask_email(user.email),
        "expires_in_minutes": OTP_EXPIRY_MINUTES,
    }

@router.post("/activate/verify")
def verify_activation(payload: VerifyOTPIn, db: Session = Depends(get_pg_db)):
    return _verify_otp_and_set_password(db, payload, "activate", activate=True)

# ── Direct activation (for employees without email) ────────────────
@router.post("/activate/direct")
def direct_activate(payload: DirectActivateIn, db: Session = Depends(get_pg_db)):
    """Employees without email can activate directly with emp code + new password."""
    user = db.query(User).filter(User.emp_code == payload.emp_code).first()
    if not user:
        raise HTTPException(404, "Employee code not found. Contact HR.")
    if user.is_activated:
        raise HTTPException(400, "Account already activated. Use login.")
    if user.email:
        raise HTTPException(400, "Please use OTP activation with your registered email.")
    if len(payload.new_password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    if payload.new_password != payload.confirm_password:
        raise HTTPException(400, "Passwords do not match")
    user.password_hash = hash_password(payload.new_password)
    user.is_activated = True
    user.must_change_password = False
    db.commit()
    token = create_token({"sub": user.emp_code, "role": user.role.value})
    return {
        "message": "Account activated successfully",
        "access_token": token, "token_type": "bearer",
        "user": {"emp_code": user.emp_code, "name": user.name, "role": user.role.value}
    }

# ── Forgot password ─────────────────────────────────────────────────
@router.post("/forgot-password/request-otp")
def request_reset_otp(payload: RequestOTPIn, background_tasks: BackgroundTasks,
                       db: Session = Depends(get_pg_db)):
    user = db.query(User).filter(User.emp_code == payload.emp_code).first()
    if not user:
        raise HTTPException(404, "Employee code not found.")
    if not user.email:
        raise HTTPException(400, "No email registered. Contact HR to reset password.")
    _create_and_send_otp(db, user, "reset", background_tasks)
    return {
        "message": "OTP sent to your registered email",
        "email_hint": _mask_email(user.email),
        "expires_in_minutes": OTP_EXPIRY_MINUTES,
    }

@router.post("/forgot-password/verify")
def verify_reset(payload: VerifyOTPIn, db: Session = Depends(get_pg_db)):
    return _verify_otp_and_set_password(db, payload, "reset", activate=False)

# ── Resend OTP ───────────────────────────────────────────────────────
@router.post("/resend-otp")
def resend_otp(payload: RequestOTPIn, background_tasks: BackgroundTasks,
                db: Session = Depends(get_pg_db)):
    user = db.query(User).filter(User.emp_code == payload.emp_code).first()
    if not user:
        raise HTTPException(404, "Employee code not found.")
    recent = db.query(OTP).filter(
        OTP.emp_code == payload.emp_code,
        OTP.purpose == OTPPurposeEnum(payload.purpose),
        OTP.created_at > datetime.utcnow() - timedelta(seconds=45),
    ).first()
    if recent:
        raise HTTPException(429, "Please wait before requesting another OTP.")
    _create_and_send_otp(db, user, payload.purpose, background_tasks)
    return {"message": "OTP resent", "email_hint": _mask_email(user.email or "")}

# ── Change password (logged in) ──────────────────────────────────────
@router.post("/change-password")
def change_password(payload: ChangePasswordIn, db: Session = Depends(get_pg_db),
                     user: User = Depends(get_current_user)):
    if not verify_password(payload.old_password, user.password_hash):
        raise HTTPException(400, "Current password is incorrect")
    if len(payload.new_password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    user.password_hash = hash_password(payload.new_password)
    user.must_change_password = False
    db.commit()
    return {"message": "Password changed successfully"}

@router.get("/me")
def get_me(user: User = Depends(get_current_user)):
    return {
        "emp_code": user.emp_code, "name": user.name,
        "email": user.email, "role": user.role.value,
        "designation": user.designation,
        "must_change_password": user.must_change_password,
    }

# ── Shared OTP verification ──────────────────────────────────────────
def _verify_otp_and_set_password(db: Session, payload: VerifyOTPIn,
                                  expected_purpose: str, activate: bool):
    user = db.query(User).filter(User.emp_code == payload.emp_code).first()
    if not user:
        raise HTTPException(404, "Employee code not found")
    otp_row = (db.query(OTP)
        .filter(OTP.emp_code == payload.emp_code,
                OTP.purpose == OTPPurposeEnum(expected_purpose),
                OTP.is_used == False)
        .order_by(OTP.created_at.desc()).first())
    if not otp_row:
        raise HTTPException(400, "No active OTP found. Please request a new one.")
    if otp_row.expires_at < datetime.utcnow():
        raise HTTPException(400, "OTP expired. Please request a new one.")
    if otp_row.attempts >= MAX_OTP_ATTEMPTS:
        raise HTTPException(429, "Too many attempts. Please request a new OTP.")
    if otp_row.otp_code != payload.otp:
        otp_row.attempts += 1
        db.commit()
        raise HTTPException(400, f"Incorrect OTP. {MAX_OTP_ATTEMPTS - otp_row.attempts} attempts left.")
    if len(payload.new_password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    otp_row.is_used = True
    user.password_hash = hash_password(payload.new_password)
    user.must_change_password = False
    if activate:
        user.is_activated = True
    db.commit()
    token = create_token({"sub": user.emp_code, "role": user.role.value})
    return {
        "message": "Account activated successfully" if activate else "Password reset successfully",
        "access_token": token, "token_type": "bearer",
        "user": {"emp_code": user.emp_code, "name": user.name, "role": user.role.value}
    }
