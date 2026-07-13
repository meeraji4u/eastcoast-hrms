from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Optional
import secrets
from core.database import get_pg_db, essl_query
from models.models import User, RoleEnum, Department, Company
from services.auth import hash_password, require_admin
from services.email_service import send_email

router = APIRouter(prefix="/api/admin", tags=["Admin"])

class EmployeeCreateIn(BaseModel):
    emp_code: str
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    role: RoleEnum = RoleEnum.employee
    dept_id: Optional[int] = None
    company_id: Optional[int] = None
    designation: Optional[str] = None

WELCOME_TEMPLATE = """
<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#115e59,#0b3f3b);padding:24px;text-align:center">
    <h2 style="color:#fff;margin:0;font-size:18px">Welcome to EastCoast HRMS</h2>
    <p style="color:#dbeafe;margin:4px 0 0;font-size:12px">East Coast Hospitals Ltd</p>
  </div>
  <div style="padding:28px 24px">
    <p style="font-size:14px;color:#1e293b">Hi {name},</p>
    <p style="font-size:14px;color:#475569;line-height:1.6">Your HRMS account has been created. Your employee code is:</p>
    <div style="background:#f1f5f9;border-radius:8px;padding:14px;text-align:center;margin:16px 0">
      <span style="font-size:22px;font-weight:700;color:#115e59">{emp_code}</span>
    </div>
    <p style="font-size:14px;color:#475569;line-height:1.6">Go to the HRMS portal, click <b>"Activate Account"</b>, enter your employee code and follow the instructions.</p>
  </div>
  <div style="background:#f8fafc;padding:14px 24px;text-align:center">
    <p style="font-size:11px;color:#94a3b8;margin:0">&copy; East Coast Hospitals Ltd, Pondicherry</p>
  </div>
</div>
"""

@router.post("/employees")
def create_employee(payload: EmployeeCreateIn, background_tasks: BackgroundTasks,
                     db: Session = Depends(get_pg_db), admin: User = Depends(require_admin)):
    if admin.role == RoleEnum.hr_admin and payload.role in [RoleEnum.it_admin, RoleEnum.hr_admin]:
        raise HTTPException(403, "HR admin cannot assign IT/HR admin roles")
    if db.query(User).filter(User.emp_code == payload.emp_code).first():
        raise HTTPException(409, "Employee code already exists")
    if payload.email and db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(409, "Email already in use")
    user = User(
        emp_code=payload.emp_code, name=payload.name,
        email=payload.email or None, phone=payload.phone,
        password_hash=hash_password(secrets.token_urlsafe(12)),
        role=payload.role, dept_id=payload.dept_id,
        company_id=payload.company_id, designation=payload.designation,
        is_activated=False, must_change_password=True,
    )
    db.add(user); db.commit(); db.refresh(user)
    if payload.email:
        html = WELCOME_TEMPLATE.format(name=user.name, emp_code=user.emp_code)
        background_tasks.add_task(send_email, payload.email, "Welcome to EastCoast HRMS — Activate Your Account", html)
    return {"message": "Employee created", "emp_code": user.emp_code}

@router.get("/employees")
def list_employees(db: Session = Depends(get_pg_db), admin: User = Depends(require_admin)):
    users = db.query(User).order_by(User.name).all()
    return [{"emp_code": u.emp_code, "name": u.name, "email": u.email,
             "role": u.role.value if u.role else "employee", "is_activated": u.is_activated,
             "is_active": u.is_active, "dept_id": u.dept_id,
             "designation": u.designation} for u in users]

class RoleUpdateIn(BaseModel):
    role: RoleEnum

@router.put("/employees/{emp_code}/role")
def update_employee_role(emp_code: str, payload: RoleUpdateIn, db: Session = Depends(get_pg_db), admin: User = Depends(require_admin)):
    user = db.query(User).filter(User.emp_code == emp_code).first()
    if not user: raise HTTPException(404, "Employee not found")
    
    if admin.role == RoleEnum.hr_admin and payload.role in [RoleEnum.it_admin, RoleEnum.hr_admin]:
        raise HTTPException(403, "HR admin cannot assign IT/HR admin roles")
        
    user.role = payload.role
    db.commit()
    return {"message": "Role updated successfully"}

class PasswordResetIn(BaseModel):
    password: str

@router.put("/employees/{emp_code}/reset-password")
def reset_employee_password(emp_code: str, payload: PasswordResetIn, db: Session = Depends(get_pg_db), admin: User = Depends(require_admin)):
    if admin.role != RoleEnum.it_admin:
        raise HTTPException(403, "Only IT admin can reset passwords")
    user = db.query(User).filter(User.emp_code == emp_code).first()
    if not user: raise HTTPException(404, "Employee not found")
    user.password_hash = hash_password(payload.password)
    user.must_change_password = True
    db.commit()
    return {"message": "Password reset successfully"}

@router.get("/essl-employees")
def list_essl_employees(admin: User = Depends(require_admin)):
    try:
        rows = essl_query("""
            SELECT e.EmployeeCode, e.EmployeeName,
                   d.DepartmentFName AS Department,
                   e.Designation, e.Status, e.ContactNo, e.Email
            FROM Employees e
            LEFT JOIN Departments d ON d.DepartmentId = e.DepartmentId
            WHERE e.RecordStatus = 1
            ORDER BY LEN(e.EmployeeCode), e.EmployeeCode
        """)
        return [{"emp_code": r["EmployeeCode"], "name": r["EmployeeName"],
                 "dept": r["Department"] or "", "designation": r["Designation"] or "",
                 "status": r["Status"] or "Active", "phone": r["ContactNo"] or "",
                 "email": r["Email"] or "", "source": "essl"} for r in rows]
    except Exception as e:
        raise HTTPException(500, str(e))

@router.post("/sync-employees")
def sync_employees(background_tasks: BackgroundTasks, db: Session = Depends(get_pg_db),
                    admin: User = Depends(require_admin)):
    """Sync new employees from eSSL to HRMS. Safe to run anytime."""
    try:
        emps = essl_query("SELECT EmployeeCode, EmployeeName FROM Employees WHERE RecordStatus=1")
        pw = hash_password("Welcome@123")
        created = 0
        for emp in emps:
            code = str(emp["EmployeeCode"])
            if not db.query(User).filter(User.emp_code == code).first():
                db.add(User(emp_code=code, name=emp["EmployeeName"] or code,
                    email=None, password_hash=pw, role=RoleEnum.employee,
                    is_activated=False, must_change_password=True))
                created += 1
        db.commit()
        return {"message": f"Sync complete. {created} new employees added.", "new_employees": created}
    except Exception as e:
        raise HTTPException(500, str(e))

@router.post("/employees/{emp_code}/deactivate")
def deactivate_employee(emp_code: str, db: Session = Depends(get_pg_db), admin: User = Depends(require_admin)):
    user = db.query(User).filter(User.emp_code == emp_code).first()
    if not user: raise HTTPException(404, "Employee not found")
    user.is_active = False; db.commit()
    return {"message": "Employee deactivated"}

@router.post("/employees/{emp_code}/reactivate")
def reactivate_employee(emp_code: str, db: Session = Depends(get_pg_db), admin: User = Depends(require_admin)):
    user = db.query(User).filter(User.emp_code == emp_code).first()
    if not user: raise HTTPException(404, "Employee not found")
    user.is_active = True; db.commit()
    return {"message": "Employee reactivated"}

@router.post("/departments")
def create_department(name: str, db: Session = Depends(get_pg_db), admin: User = Depends(require_admin)):
    if db.query(Department).filter(Department.name == name).first():
        raise HTTPException(409, "Already exists")
    dept = Department(name=name); db.add(dept); db.commit()
    return {"message": "Created", "id": dept.id}

@router.post("/companies")
def create_company(name: str, code: str, db: Session = Depends(get_pg_db), admin: User = Depends(require_admin)):
    co = Company(name=name, code=code); db.add(co); db.commit()
    return {"message": "Created", "id": co.id}
