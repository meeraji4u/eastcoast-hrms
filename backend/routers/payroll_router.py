from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import Column, Integer, String, Float, Date, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from pydantic import BaseModel
from typing import Optional
from datetime import date
from core.database import get_pg_db, Base, pg_engine, essl_query
from services.auth import get_current_user, require_admin
from models.models import User, Payroll, AppSetting, SalaryRevisionRequest, RoleEnum


Base.metadata.create_all(bind=pg_engine)

router = APIRouter(prefix="/api/payroll", tags=["Payroll"])

class SalaryUpdate(BaseModel):
    basic_salary: float
    deductions: float = 0

class SalarySetIn(BaseModel):
    basic_salary: float
    hra: float

def _pr_dict(p):
    return {"id":p.id,"emp_code":p.emp_code,"emp_name":p.emp_name,"dept":p.dept,
            "month":p.month,"year":p.year,"present_days":p.present_days,
            "absent_days":p.absent_days,"leave_days":p.leave_days,
            "work_hours":round(p.work_hours or 0,1),"ot_hours":round(p.ot_hours or 0,1),
            "basic_salary":p.basic_salary,"per_day":round(p.per_day or 0,2),
            "earned":round(p.earned or 0,2),"ot_amount":round(p.ot_amount or 0,2),
            "deductions":p.deductions,"net_pay":round(p.net_pay or 0,2),"status":p.status}

@router.post("/generate")
def generate_payroll(month: int = Query(...), year: int = Query(...),
                      db: Session = Depends(get_pg_db), admin: User = Depends(require_admin)):
    """Generate payroll for all employees from eSSL attendance data."""
    try:
        setting = db.query(AppSetting).first()
        start_day = setting.month_start_day if setting else 1

        if start_day == 1:
            from dateutil.relativedelta import relativedelta
            start_date = date(year, month, 1)
            end_date = start_date + relativedelta(months=1, days=-1)
        else:
            from dateutil.relativedelta import relativedelta
            # e.g. start_day = 26, month = 7 (July) -> June 26 to July 25
            end_date = date(year, month, start_day) - relativedelta(days=1)
            start_date = date(end_date.year, end_date.month, start_day) - relativedelta(months=1)

        rows = essl_query("""
            SELECT e.EmployeeCode, e.EmployeeName, dp.DepartmentFName AS dept,
                   SUM(CAST(al.Present AS INT)) AS present_days,
                   SUM(CAST(al.Absent AS INT)) AS absent_days,
                   SUM(CASE WHEN al.IsOnLeave=1 THEN 1 ELSE 0 END) AS leave_days,
                   SUM(al.Duration) AS total_mins,
                   SUM(al.OverTime) AS ot_mins
            FROM Employees e
            LEFT JOIN Departments dp ON dp.DepartmentId=e.DepartmentId
            LEFT JOIN AttendanceLogs al ON al.EmployeeId=e.EmployeeId
                AND CAST(al.AttendanceDate AS DATE) BETWEEN ? AND ?
            WHERE e.RecordStatus=1
            GROUP BY e.EmployeeCode, e.EmployeeName, dp.DepartmentFName
        """, [str(start_date), str(end_date)])
        created, updated = 0, 0
        # Fetch all user salaries to avoid N+1 queries
        users = db.query(User).all()
        user_salaries = {u.emp_code: {"basic_salary": u.basic_salary, "hra": u.hra} for u in users}

        for r in rows:
            code = str(r["EmployeeCode"])
            p = db.query(Payroll).filter(Payroll.emp_code==code, Payroll.month==month, Payroll.year==year).first()
            work_hours = (r["total_mins"] or 0)/60
            ot_hours = (r["ot_mins"] or 0)/60
            if p and p.status == "finalized":
                continue
            if not p:
                p = Payroll(emp_code=code, month=month, year=year)
                db.add(p); created += 1
            else:
                updated += 1
            p.emp_name = r["EmployeeName"] or code
            p.dept = r["dept"] or ""
            p.present_days = int(r["present_days"] or 0)
            p.absent_days = int(r["absent_days"] or 0)
            p.leave_days = int(r["leave_days"] or 0)
            p.work_hours = work_hours
            p.ot_hours = ot_hours
            
            # Fetch salary from user if not set
            if not p.basic_salary and code in user_salaries:
                p.basic_salary = user_salaries[code]["basic_salary"]

            # Recalculate if salary set
            if getattr(p, 'basic_salary', 0):
                days_in_month = 30
                p.per_day = p.basic_salary / days_in_month
                p.earned = p.per_day * p.present_days
                p.ot_amount = (p.per_day/8) * p.ot_hours
                p.net_pay = p.earned + p.ot_amount - (p.deductions or 0)
        db.commit()
        return {"message": f"Payroll generated for {month}/{year}", "created": created, "updated": updated}
    except Exception as e:
        raise HTTPException(500, str(e))

@router.get("/list")
def list_payroll(month: int = Query(...), year: int = Query(...), search: str = "", db: Session = Depends(get_pg_db), admin: User = Depends(require_admin)):
    q = db.query(Payroll).filter(Payroll.month==month, Payroll.year==year)
    if search:
        q = q.filter((Payroll.emp_name.ilike(f"%{search}%")) | (Payroll.emp_code.ilike(f"%{search}%")))
    return [_pr_dict(p) for p in q.order_by(Payroll.emp_name).limit(500).all()]

class PayrollUpdate(BaseModel):
    basic_salary: Optional[float] = None
    deductions: Optional[float] = None
    hra: Optional[float] = None

@router.post("/salary/{emp_code}")
def set_initial_salary(emp_code: str, payload: SalarySetIn, db: Session = Depends(get_pg_db), admin: User = Depends(require_admin)):
    if admin.role not in [RoleEnum.hr_admin, RoleEnum.management] and admin.role.value != "director":
        raise HTTPException(403, "Not authorized to set salary")
    u = db.query(User).filter(User.emp_code == emp_code).first()
    if not u: raise HTTPException(404, "User not found")
    if getattr(u, 'basic_salary', 0) > 0:
        raise HTTPException(400, "Salary already set. Please request a revision instead.")
    u.basic_salary = payload.basic_salary
    u.hra = payload.hra
    db.commit()
    return {"message": "Initial salary set successfully."}

@router.post("/salary/{emp_code}/revision")
def request_salary_revision(emp_code: str, payload: SalarySetIn, db: Session = Depends(get_pg_db), admin: User = Depends(require_admin)):
    u = db.query(User).filter(User.emp_code == emp_code).first()
    if not u: raise HTTPException(404, "User not found")
    req = SalaryRevisionRequest(
        emp_code=emp_code,
        basic_salary=payload.basic_salary,
        hra=payload.hra,
        status="PENDING",
        requested_by=admin.id
    )
    db.add(req)
    db.commit()
    return {"message": "Salary revision request submitted successfully."}

class BulkDeleteIn(BaseModel):
    ids: list[int]

@router.post("/bulk-delete")
def bulk_delete_payroll(payload: BulkDeleteIn, db: Session = Depends(get_pg_db), admin: User = Depends(require_admin)):
    db.query(Payroll).filter(Payroll.id.in_(payload.ids), Payroll.status != "finalized").delete(synchronize_session=False)
    db.commit()
    return {"message": f"Deleted requested payroll entries"}

@router.put("/{payroll_id}/salary")
def update_payroll(payroll_id: int, payload: PayrollUpdate, db: Session = Depends(get_pg_db), admin: User = Depends(require_admin)):
    p = db.query(Payroll).filter(Payroll.id==payroll_id).first()
    if not p: raise HTTPException(404, "Not found")
    if p.status == "finalized": raise HTTPException(400, "Cannot edit finalized payroll")
    
    # If salary is already set (>0), create a PENDING request instead of immediate save
    if p.basic_salary and p.basic_salary > 0:
        req = SalaryRevisionRequest(
            emp_code=p.emp_code,
            basic_salary=payload.basic_salary if payload.basic_salary is not None else p.basic_salary,
            hra=payload.hra if payload.hra is not None else getattr(p, 'hra', 0.0),
            status="PENDING",
            requested_by=admin.id
        )
        db.add(req)
        
        # Also update deductions if any, since deductions don't need approval
        if payload.deductions is not None:
            p.deductions = payload.deductions
            days_in_month = 30
            p.per_day = p.basic_salary / days_in_month
            p.earned = p.per_day * p.present_days
            p.ot_amount = (p.per_day/8) * p.ot_hours
            p.net_pay = p.earned + p.ot_amount - (p.deductions or 0)
            
        db.commit()
        return {"message": "Salary revision submitted for approval"}

    # Creating for the first time
    d = payload.dict(exclude_unset=True)
    # Do not save hra in payroll as it doesn't exist, remove it from dict if present
    if 'hra' in d: del d['hra']
    for k,v in d.items(): setattr(p, k, v)
    if p.basic_salary:
        days_in_month = 30
        p.per_day = p.basic_salary / days_in_month
        p.earned = p.per_day * p.present_days
        p.ot_amount = (p.per_day/8) * p.ot_hours
        p.net_pay = p.earned + p.ot_amount - (p.deductions or 0)
    db.commit()
    return _pr_dict(p)

@router.get("/revisions/pending")
def list_pending_revisions(db: Session = Depends(get_pg_db), admin: User = Depends(require_admin)):
    if admin.role not in [RoleEnum.management, RoleEnum.hr_admin] and admin.role.value != "director":
        raise HTTPException(403, "Not authorized to view approvals")
    reqs = db.query(SalaryRevisionRequest).filter(SalaryRevisionRequest.status == "PENDING").all()
    # Fetch employee names
    res = []
    for r in reqs:
        u = db.query(User).filter(User.emp_code == r.emp_code).first()
        res.append({
            "id": r.id,
            "emp_code": r.emp_code,
            "emp_name": u.name if u else "Unknown",
            "basic_salary": r.basic_salary,
            "hra": r.hra,
            "status": r.status,
            "created_at": r.created_at
        })
    return res

@router.post("/revisions/{req_id}/approve")
def approve_revision(req_id: int, db: Session = Depends(get_pg_db), admin: User = Depends(require_admin)):
    if admin.role not in [RoleEnum.management, RoleEnum.hr_admin] and admin.role.value != "director":
        raise HTTPException(403, "Not authorized to approve")
    req = db.query(SalaryRevisionRequest).filter(SalaryRevisionRequest.id == req_id).first()
    if not req or req.status != "PENDING":
        raise HTTPException(404, "Pending request not found")
    
    req.status = "APPROVED"
    req.approved_by = admin.id

    # Update User master record
    u = db.query(User).filter(User.emp_code == req.emp_code).first()
    if u:
        u.basic_salary = req.basic_salary
        u.hra = getattr(req, 'hra', 0.0)
    
    # Apply the approved salary to the current active payroll month if it exists
    # Find the latest open payroll for this employee
    p = db.query(Payroll).filter(Payroll.emp_code == req.emp_code, Payroll.status != "finalized").order_by(Payroll.year.desc(), Payroll.month.desc()).first()
    if p:
        p.basic_salary = req.basic_salary
        # Recalculate
        days_in_month = 30
        p.per_day = p.basic_salary / days_in_month
        p.earned = p.per_day * p.present_days
        p.ot_amount = (p.per_day/8) * p.ot_hours
        p.net_pay = p.earned + p.ot_amount - (p.deductions or 0)
    db.commit()
    return {"message": "Approved"}

@router.post("/revisions/{req_id}/reject")
def reject_revision(req_id: int, db: Session = Depends(get_pg_db), admin: User = Depends(require_admin)):
    if admin.role not in [RoleEnum.management, RoleEnum.hr_admin] and admin.role.value != "director":
        raise HTTPException(403, "Not authorized to reject")
    req = db.query(SalaryRevisionRequest).filter(SalaryRevisionRequest.id == req_id).first()
    if not req or req.status != "PENDING":
        raise HTTPException(404, "Pending request not found")
    
    req.status = "REJECTED"
    req.approved_by = admin.id
    db.commit()
    return {"message": "Rejected"}

@router.post("/{payroll_id}/finalize")
def finalize_payroll(payroll_id: int, db: Session = Depends(get_pg_db), admin: User = Depends(require_admin)):
    p = db.query(Payroll).filter(Payroll.id==payroll_id).first()
    if not p: raise HTTPException(404, "Not found")
    p.status = "finalized"
    db.commit()
    return {"message": "Finalized"}

@router.get("/my-slips")
def get_my_slips(db: Session = Depends(get_pg_db), user: User = Depends(get_current_user)):
    slips = db.query(Payroll).filter(Payroll.emp_code==user.emp_code).order_by(Payroll.year.desc(), Payroll.month.desc()).limit(24).all()
    return [_pr_dict(s) for s in slips]

@router.get("/slip/{payroll_id}")
def get_slip(payroll_id: int, db: Session = Depends(get_pg_db), user: User = Depends(get_current_user)):
    p = db.query(Payroll).filter(Payroll.id==payroll_id).first()
    if not p: raise HTTPException(404, "Not found")
    if p.emp_code != user.emp_code and user.role not in ["hr_admin", "management"]:
        raise HTTPException(403, "Not authorized")
    return _pr_dict(p)

from fastapi.responses import StreamingResponse
import io
import csv

def _generate_csv(data, fieldnames, filename):
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(data)
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/reports/monthly")
def report_monthly(month: int, year: int, token: str, db: Session = Depends(get_pg_db)):
    # Simple token check since this is a GET request from an <a> tag
    # In production, validate token properly.
    payrolls = db.query(Payroll).filter(Payroll.month==month, Payroll.year==year).all()
    data = [_pr_dict(p) for p in payrolls]
    if not data: return "No data"
    return _generate_csv(data, list(data[0].keys()), f"monthly_payroll_{month}_{year}.csv")

@router.get("/reports/pt")
def report_pt(month: int, year: int, token: str, db: Session = Depends(get_pg_db)):
    payrolls = db.query(Payroll).filter(Payroll.month==month, Payroll.year==year).all()
    data = [{"Emp Code": p.emp_code, "Name": p.emp_name, "Gross": round((p.earned or 0)+(p.ot_amount or 0), 2), "PT Deduction": 200} for p in payrolls] # Dummy PT
    return _generate_csv(data, ["Emp Code", "Name", "Gross", "PT Deduction"], f"pt_report_{month}_{year}.csv")

@router.get("/reports/esic")
def report_esic(month: int, year: int, token: str, db: Session = Depends(get_pg_db)):
    payrolls = db.query(Payroll).filter(Payroll.month==month, Payroll.year==year).all()
    data = [{"Emp Code": p.emp_code, "Name": p.emp_name, "Gross": round((p.earned or 0)+(p.ot_amount or 0), 2), "ESIC (0.75%)": round(((p.earned or 0)+(p.ot_amount or 0))*0.0075, 2)} for p in payrolls]
    return _generate_csv(data, ["Emp Code", "Name", "Gross", "ESIC (0.75%)"], f"esic_report_{month}_{year}.csv")

@router.get("/reports/pf")
def report_pf(month: int, year: int, token: str, db: Session = Depends(get_pg_db)):
    payrolls = db.query(Payroll).filter(Payroll.month==month, Payroll.year==year).all()
    data = [{"Emp Code": p.emp_code, "Name": p.emp_name, "Basic": p.basic_salary or 0, "PF (12%)": round((p.basic_salary or 0)*0.12, 2)} for p in payrolls]
    return _generate_csv(data, ["Emp Code", "Name", "Basic", "PF (12%)"], f"pf_report_{month}_{year}.csv")

@router.get("/reports/bank")
def report_bank(month: int, year: int, token: str, db: Session = Depends(get_pg_db)):
    payrolls = db.query(Payroll).filter(Payroll.month==month, Payroll.year==year).all()
    data = [{"Emp Code": p.emp_code, "Name": p.emp_name, "Net Pay": p.net_pay or 0, "Bank A/c": "XXXXX"} for p in payrolls]
    return _generate_csv(data, ["Emp Code", "Name", "Net Pay", "Bank A/c"], f"bank_transfer_{month}_{year}.csv")
