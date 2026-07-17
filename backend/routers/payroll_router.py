from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import date
from core.database import get_pg_db, pg_engine, essl_query
from services.auth import get_current_user, require_admin
from models.models import Base, User, Payroll, PayrollFormula, AppSetting, SalaryRevisionRequest, RoleEnum

Base.metadata.create_all(bind=pg_engine)

router = APIRouter(prefix="/api/payroll", tags=["Payroll"])


# ── Helper: Serialise a payroll row ─────────────────────────────────
def _pr_dict(p):
    return {
        "id": p.id, "emp_code": p.emp_code, "emp_name": p.emp_name, "dept": p.dept,
        "month": p.month, "year": p.year,
        "present_days": p.present_days, "absent_days": p.absent_days, "leave_days": p.leave_days,
        "work_hours": round(p.work_hours or 0, 1), "ot_hours": round(p.ot_hours or 0, 1),
        "basic_salary": round(p.basic_salary or 0, 2),
        "per_day": round(p.per_day or 0, 2),
        "earned_basic": round(p.earned_basic or 0, 2),
        "hra_amount": round(p.hra_amount or 0, 2),
        "da_amount": round(p.da_amount or 0, 2),
        "ot_amount": round(p.ot_amount or 0, 2),
        "gross": round(p.gross or 0, 2),
        "pf": round(p.pf or 0, 2),
        "esic": round(p.esic or 0, 2),
        "advance": round(p.advance or 0, 2),
        "other_deductions": round(p.other_deductions or 0, 2),
        "deductions": round(p.deductions or 0, 2),
        "net_pay": round(p.net_pay or 0, 2),
        "status": p.status,
        # legacy alias
        "earned": round(p.earned_basic or 0, 2),
    }


def _get_formula(db: Session) -> PayrollFormula:
    """Get or create the default payroll formula settings."""
    f = db.query(PayrollFormula).first()
    if not f:
        f = PayrollFormula()
        db.add(f)
        db.commit()
        db.refresh(f)
    return f


def _calc(p: Payroll, formula: PayrollFormula):
    """Apply the formula to a Payroll row and update all fields in-place."""
    ctc = p.basic_salary or 0
    if ctc <= 0:
        return

    days_in_month = 30
    present = p.present_days or 0
    ot_hrs = p.ot_hours or 0

    # ── Per-day rate (based on full CTC) ──────────────────────────
    p.per_day = ctc / days_in_month

    # ── Attendance ratio ──────────────────────────────────────────
    ratio = present / days_in_month if days_in_month > 0 else 0

    # ── Earnings breakdown ────────────────────────────────────────
    basic_pct  = (formula.basic_pct or 60) / 100
    hra_pct    = (formula.hra_pct   or 20) / 100
    da_pct     = (formula.da_pct    or 20) / 100
    ot_divisor = formula.ot_hours_divisor or 8

    monthly_basic = ctc * basic_pct
    monthly_hra   = ctc * hra_pct
    monthly_da    = ctc * da_pct

    # Earned amounts scale with attendance (LOP applied automatically)
    p.earned_basic = monthly_basic * ratio
    p.hra_amount   = monthly_hra   * ratio
    p.da_amount    = monthly_da    * ratio

    # OT amount = (per_day / shift_hours) * OT hours worked
    per_hour = (p.per_day / ot_divisor) if ot_divisor > 0 else 0
    p.ot_amount = per_hour * ot_hrs

    p.gross = p.earned_basic + p.hra_amount + p.da_amount + p.ot_amount
    p.earned = p.earned_basic  # legacy alias

    # ── Deductions breakdown ──────────────────────────────────────
    pf_pct   = (formula.pf_pct   or 12)   / 100
    esic_pct = (formula.esic_pct or 0.75) / 100

    p.pf   = p.earned_basic * pf_pct
    p.esic = p.earned_basic * esic_pct
    # advance & other_deductions are manual — don't touch them here

    p.deductions = p.pf + p.esic + (p.advance or 0) + (p.other_deductions or 0)
    p.net_pay    = p.gross - p.deductions


# ── Payroll Formula Settings ────────────────────────────────────────
class FormulaIn(BaseModel):
    basic_pct: float = 60.0
    hra_pct:   float = 20.0
    da_pct:    float = 20.0
    pf_pct:    float = 12.0
    esic_pct:  float = 0.75
    ot_hours_divisor: float = 8.0


@router.get("/formula")
def get_formula(db: Session = Depends(get_pg_db), _=Depends(require_admin)):
    f = _get_formula(db)
    return {
        "basic_pct": f.basic_pct, "hra_pct": f.hra_pct, "da_pct": f.da_pct,
        "pf_pct": f.pf_pct, "esic_pct": f.esic_pct,
        "ot_hours_divisor": f.ot_hours_divisor,
    }


@router.post("/formula")
def save_formula(payload: FormulaIn, db: Session = Depends(get_pg_db), _=Depends(require_admin)):
    # Validate: basic + hra + da should equal 100%
    total = payload.basic_pct + payload.hra_pct + payload.da_pct
    if abs(total - 100.0) > 0.01:
        raise HTTPException(400, f"Basic + HRA + DA must equal 100%. Currently: {total}%")
    f = _get_formula(db)
    f.basic_pct = payload.basic_pct
    f.hra_pct   = payload.hra_pct
    f.da_pct    = payload.da_pct
    f.pf_pct    = payload.pf_pct
    f.esic_pct  = payload.esic_pct
    f.ot_hours_divisor = payload.ot_hours_divisor
    db.commit()
    return {"message": "Payroll formula saved successfully."}


# ── Generate Payroll ────────────────────────────────────────────────
@router.post("/generate")
def generate_payroll(month: int = Query(...), year: int = Query(...),
                     db: Session = Depends(get_pg_db), admin: User = Depends(require_admin)):
    try:
        setting = db.query(AppSetting).first()
        start_day = setting.month_start_day if setting else 1
        formula = _get_formula(db)

        from dateutil.relativedelta import relativedelta
        if start_day == 1:
            start_date = date(year, month, 1)
            end_date = start_date + relativedelta(months=1, days=-1)
        else:
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

        user_salaries = {u.emp_code: u.basic_salary for u in db.query(User).all()}
        created, updated = 0, 0

        for r in rows:
            code = str(r["EmployeeCode"])
            p = db.query(Payroll).filter(Payroll.emp_code == code, Payroll.month == month, Payroll.year == year).first()
            if p and p.status == "finalized":
                continue
            if not p:
                p = Payroll(emp_code=code, month=month, year=year)
                db.add(p); created += 1
            else:
                updated += 1

            p.emp_name     = r["EmployeeName"] or code
            p.dept         = r["dept"] or ""
            p.present_days = int(r["present_days"] or 0)
            p.absent_days  = int(r["absent_days"] or 0)
            p.leave_days   = int(r["leave_days"] or 0)
            p.work_hours   = (r["total_mins"] or 0) / 60
            p.ot_hours     = (r["ot_mins"] or 0) / 60

            if not p.basic_salary and code in user_salaries:
                p.basic_salary = user_salaries[code] or 0

            _calc(p, formula)

        db.commit()
        return {"message": f"Payroll generated for {month}/{year}", "created": created, "updated": updated}
    except Exception as e:
        raise HTTPException(500, str(e))


# ── List Payroll ────────────────────────────────────────────────────
@router.get("/list")
def list_payroll(month: int = Query(...), year: int = Query(...), search: str = "",
                 db: Session = Depends(get_pg_db), admin: User = Depends(require_admin)):
    q = db.query(Payroll).filter(Payroll.month == month, Payroll.year == year)
    if search:
        q = q.filter((Payroll.emp_name.ilike(f"%{search}%")) | (Payroll.emp_code.ilike(f"%{search}%")))
    return [_pr_dict(p) for p in q.order_by(Payroll.emp_name).limit(500).all()]


# ── Edit a single payroll record (mandatory) ────────────────────────
class PayrollEditIn(BaseModel):
    basic_salary:     Optional[float] = None
    advance:          Optional[float] = None
    other_deductions: Optional[float] = None
    present_days:     Optional[int]   = None


@router.put("/{payroll_id}")
def edit_payroll(payroll_id: int, payload: PayrollEditIn,
                 db: Session = Depends(get_pg_db), admin: User = Depends(require_admin)):
    p = db.query(Payroll).filter(Payroll.id == payroll_id).first()
    if not p:
        raise HTTPException(404, "Payroll record not found")
    if p.status == "finalized":
        raise HTTPException(400, "Cannot edit a finalized payroll. Unfinalize first.")

    formula = _get_formula(db)

    # Apply any manual overrides the HR entered
    if payload.basic_salary   is not None: p.basic_salary     = payload.basic_salary
    if payload.advance        is not None: p.advance          = payload.advance
    if payload.other_deductions is not None: p.other_deductions = payload.other_deductions
    if payload.present_days   is not None: p.present_days     = payload.present_days

    # Recalculate everything using the stored formula
    _calc(p, formula)
    db.commit()
    return _pr_dict(p)


# ── Salary set (first-time) ─────────────────────────────────────────
class SalarySetIn(BaseModel):
    basic_salary: float
    hra: float = 0.0  # kept for backward compat, ignored now (formula-driven)


@router.post("/salary/{emp_code}")
def set_initial_salary(emp_code: str, payload: SalarySetIn,
                       db: Session = Depends(get_pg_db), admin: User = Depends(require_admin)):
    u = db.query(User).filter(User.emp_code == emp_code).first()
    if not u:
        raise HTTPException(404, "User not found")
    u.basic_salary = payload.basic_salary
    db.commit()
    return {"message": "Salary set successfully."}


# ── Salary revision ─────────────────────────────────────────────────
@router.post("/salary/{emp_code}/revision")
def request_salary_revision(emp_code: str, payload: SalarySetIn,
                             db: Session = Depends(get_pg_db), admin: User = Depends(require_admin)):
    u = db.query(User).filter(User.emp_code == emp_code).first()
    if not u:
        raise HTTPException(404, "User not found")
    req = SalaryRevisionRequest(
        emp_code=emp_code, basic_salary=payload.basic_salary, hra=0.0,
        status="PENDING", requested_by=admin.id
    )
    db.add(req)
    db.commit()
    return {"message": "Salary revision request submitted."}


# ── Finalize / Unfinalize ───────────────────────────────────────────
@router.post("/{payroll_id}/finalize")
def finalize_payroll(payroll_id: int, db: Session = Depends(get_pg_db), _=Depends(require_admin)):
    p = db.query(Payroll).filter(Payroll.id == payroll_id).first()
    if not p:
        raise HTTPException(404, "Not found")
    p.status = "finalized"
    db.commit()
    return {"message": "Finalized"}


@router.post("/{payroll_id}/unfinalize")
def unfinalize_payroll(payroll_id: int, db: Session = Depends(get_pg_db), _=Depends(require_admin)):
    p = db.query(Payroll).filter(Payroll.id == payroll_id).first()
    if not p:
        raise HTTPException(404, "Not found")
    p.status = "draft"
    db.commit()
    return {"message": "Unfinalized"}


# ── Bulk Delete ─────────────────────────────────────────────────────
class BulkDeleteIn(BaseModel):
    ids: list[int]


@router.post("/bulk-delete")
def bulk_delete_payroll(payload: BulkDeleteIn, db: Session = Depends(get_pg_db), _=Depends(require_admin)):
    db.query(Payroll).filter(Payroll.id.in_(payload.ids), Payroll.status != "finalized").delete(synchronize_session=False)
    db.commit()
    return {"message": "Deleted requested payroll entries"}


# ── Employee: my payslips ───────────────────────────────────────────
@router.get("/my-slips")
def get_my_slips(db: Session = Depends(get_pg_db), user: User = Depends(get_current_user)):
    slips = db.query(Payroll).filter(Payroll.emp_code == user.emp_code).order_by(Payroll.year.desc(), Payroll.month.desc()).limit(24).all()
    return [_pr_dict(s) for s in slips]


@router.get("/slip/{payroll_id}")
def get_slip(payroll_id: int, db: Session = Depends(get_pg_db), user: User = Depends(get_current_user)):
    p = db.query(Payroll).filter(Payroll.id == payroll_id).first()
    if not p:
        raise HTTPException(404, "Not found")
    if p.emp_code != user.emp_code and user.role not in ["hr_admin", "management", "it_admin"]:
        raise HTTPException(403, "Not authorized")
    return _pr_dict(p)


# ── Pending Revisions ───────────────────────────────────────────────
@router.get("/revisions/pending")
def list_pending_revisions(db: Session = Depends(get_pg_db), admin: User = Depends(require_admin)):
    reqs = db.query(SalaryRevisionRequest).filter(SalaryRevisionRequest.status == "PENDING").all()
    res = []
    for r in reqs:
        u = db.query(User).filter(User.emp_code == r.emp_code).first()
        res.append({"id": r.id, "emp_code": r.emp_code, "emp_name": u.name if u else "Unknown",
                    "basic_salary": r.basic_salary, "hra": r.hra, "status": r.status, "created_at": r.created_at})
    return res


@router.post("/revisions/{req_id}/approve")
def approve_revision(req_id: int, db: Session = Depends(get_pg_db), admin: User = Depends(require_admin)):
    req = db.query(SalaryRevisionRequest).filter(SalaryRevisionRequest.id == req_id).first()
    if not req or req.status != "PENDING":
        raise HTTPException(404, "Pending request not found")
    req.status = "APPROVED"; req.approved_by = admin.id
    u = db.query(User).filter(User.emp_code == req.emp_code).first()
    if u:
        u.basic_salary = req.basic_salary
    db.commit()
    return {"message": "Approved"}


@router.post("/revisions/{req_id}/reject")
def reject_revision(req_id: int, db: Session = Depends(get_pg_db), admin: User = Depends(require_admin)):
    req = db.query(SalaryRevisionRequest).filter(SalaryRevisionRequest.id == req_id).first()
    if not req or req.status != "PENDING":
        raise HTTPException(404, "Pending request not found")
    req.status = "REJECTED"; req.approved_by = admin.id
    db.commit()
    return {"message": "Rejected"}


# ── CSV Reports ─────────────────────────────────────────────────────
from fastapi.responses import StreamingResponse
import io, csv


def _generate_csv(data, fieldnames, filename):
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(data)
    output.seek(0)
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": f"attachment; filename={filename}"})


@router.get("/reports/monthly")
def report_monthly(month: int, year: int, token: str, db: Session = Depends(get_pg_db)):
    payrolls = db.query(Payroll).filter(Payroll.month == month, Payroll.year == year).all()
    data = [{"Emp Code": p.emp_code, "Name": p.emp_name, "Dept": p.dept, "Present": p.present_days,
             "Basic": round(p.earned_basic or 0, 2), "HRA": round(p.hra_amount or 0, 2),
             "DA": round(p.da_amount or 0, 2), "OT": round(p.ot_amount or 0, 2),
             "Gross": round(p.gross or 0, 2), "PF": round(p.pf or 0, 2), "ESIC": round(p.esic or 0, 2),
             "Advance": round(p.advance or 0, 2), "Other Ded": round(p.other_deductions or 0, 2),
             "Net Pay": round(p.net_pay or 0, 2), "Status": p.status} for p in payrolls]
    if not data:
        return "No data"
    return _generate_csv(data, list(data[0].keys()), f"monthly_payroll_{month}_{year}.csv")


@router.get("/reports/pf")
def report_pf(month: int, year: int, token: str, db: Session = Depends(get_pg_db)):
    payrolls = db.query(Payroll).filter(Payroll.month == month, Payroll.year == year).all()
    data = [{"Emp Code": p.emp_code, "Name": p.emp_name, "Basic Earned": round(p.earned_basic or 0, 2),
             "PF (Employee 12%)": round(p.pf or 0, 2),
             "PF (Employer 12%)": round(p.pf or 0, 2)} for p in payrolls]
    return _generate_csv(data, ["Emp Code", "Name", "Basic Earned", "PF (Employee 12%)", "PF (Employer 12%)"],
                         f"pf_report_{month}_{year}.csv")


@router.get("/reports/esic")
def report_esic(month: int, year: int, token: str, db: Session = Depends(get_pg_db)):
    payrolls = db.query(Payroll).filter(Payroll.month == month, Payroll.year == year).all()
    data = [{"Emp Code": p.emp_code, "Name": p.emp_name, "Gross": round(p.gross or 0, 2),
             "ESIC Employee (0.75%)": round(p.esic or 0, 2),
             "ESIC Employer (3.25%)": round((p.earned_basic or 0) * 0.0325, 2)} for p in payrolls]
    return _generate_csv(data, ["Emp Code", "Name", "Gross", "ESIC Employee (0.75%)", "ESIC Employer (3.25%)"],
                         f"esic_report_{month}_{year}.csv")


@router.get("/reports/pt")
def report_pt(month: int, year: int, token: str, db: Session = Depends(get_pg_db)):
    payrolls = db.query(Payroll).filter(Payroll.month == month, Payroll.year == year).all()
    data = [{"Emp Code": p.emp_code, "Name": p.emp_name, "Gross": round(p.gross or 0, 2),
             "PT Deduction": 200} for p in payrolls]
    return _generate_csv(data, ["Emp Code", "Name", "Gross", "PT Deduction"], f"pt_report_{month}_{year}.csv")


@router.get("/reports/bank")
def report_bank(month: int, year: int, token: str, db: Session = Depends(get_pg_db)):
    payrolls = db.query(Payroll).filter(Payroll.month == month, Payroll.year == year).all()
    data = [{"Emp Code": p.emp_code, "Name": p.emp_name, "Net Pay": round(p.net_pay or 0, 2),
             "Bank A/c": "XXXXX"} for p in payrolls]
    return _generate_csv(data, ["Emp Code", "Name", "Net Pay", "Bank A/c"], f"bank_transfer_{month}_{year}.csv")
