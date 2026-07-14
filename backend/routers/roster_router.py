from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import Column, Integer, String, DateTime, Date, ForeignKey, Text
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, timedelta
from core.database import get_pg_db, Base, pg_engine, essl_query
from services.auth import get_current_user, require_admin_or_head
from models.models import User, RoleEnum

class DutyRoster(Base):
    __tablename__ = "duty_rosters"
    id = Column(Integer, primary_key=True)
    emp_code = Column(String(20), nullable=False, index=True)
    emp_name = Column(String(100))
    dept_name = Column(String(100))
    shift_code = Column(String(20))
    shift_name = Column(String(100))
    roster_date = Column(Date, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"))
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

Base.metadata.create_all(bind=pg_engine)

router = APIRouter(prefix="/api/roster", tags=["Duty Roster"])

class RosterEntryIn(BaseModel):
    emp_code: str
    shift_code: str
    shift_name: str
    roster_date: str
    notes: Optional[str] = ""

class BulkRosterIn(BaseModel):
    dept_name: Optional[str] = None
    shift_code: str
    shift_name: str
    from_date: str
    to_date: str
    notes: Optional[str] = ""
    emp_codes: Optional[List[str]] = []

@router.post("/assign")
def assign_roster(payload: RosterEntryIn, db: Session = Depends(get_pg_db),
                   user: User = Depends(require_admin_or_head)):
    # Get employee info from eSSL
    emp_name, dept_name = "", ""
    try:
        rows = essl_query("""
            SELECT e.EmployeeName, d.DepartmentFName
            FROM Employees e LEFT JOIN Departments d ON d.DepartmentId=e.DepartmentId
            WHERE e.EmployeeCode=?
        """, [payload.emp_code])
        if rows:
            emp_name = rows[0].get("EmployeeName", "")
            dept_name = rows[0].get("DepartmentFName", "")
    except: pass

    # Remove existing roster for that date
    existing = db.query(DutyRoster).filter(
        DutyRoster.emp_code == payload.emp_code,
        DutyRoster.roster_date == date.fromisoformat(payload.roster_date)
    ).first()
    if existing:
        existing.shift_code = payload.shift_code
        existing.shift_name = payload.shift_name
        existing.notes = payload.notes
    else:
        entry = DutyRoster(
            emp_code=payload.emp_code, emp_name=emp_name, dept_name=dept_name,
            shift_code=payload.shift_code, shift_name=payload.shift_name,
            roster_date=date.fromisoformat(payload.roster_date),
            notes=payload.notes, created_by=user.id
        )
        db.add(entry)
    db.commit()
    return {"message": "Roster assigned"}

@router.post("/bulk-assign")
def bulk_assign(payload: BulkRosterIn, db: Session = Depends(get_pg_db),
                 user: User = Depends(require_admin_or_head)):
    try:
        employees = []
        if payload.dept_name:
            # Get all employees in department from eSSL
            employees = essl_query("""
                SELECT e.EmployeeCode, e.EmployeeName, d.DepartmentFName
                FROM Employees e
                LEFT JOIN Departments d ON d.DepartmentId=e.DepartmentId
                WHERE d.DepartmentFName=? AND e.RecordStatus=1
            """, [payload.dept_name])
        elif payload.emp_codes and len(payload.emp_codes) > 0:
            # Fetch specific employees by code
            codes_placeholder = ",".join(["?"] * len(payload.emp_codes))
            employees = essl_query(f"""
                SELECT e.EmployeeCode, e.EmployeeName, d.DepartmentFName
                FROM Employees e
                LEFT JOIN Departments d ON d.DepartmentId=e.DepartmentId
                WHERE e.EmployeeCode IN ({codes_placeholder}) AND e.RecordStatus=1
            """, payload.emp_codes)
        else:
            raise HTTPException(400, "Must provide either dept_name or emp_codes")
        
        # Filter if emp_codes provided and we fetched by department
        if payload.dept_name and payload.emp_codes and len(payload.emp_codes) > 0:
            employees = [e for e in employees if str(e["EmployeeCode"]) in payload.emp_codes]
            
    except Exception as e:
        raise HTTPException(400, f"Could not fetch employees from eSSL: {e}")

    from_date = date.fromisoformat(payload.from_date)
    to_date = date.fromisoformat(payload.to_date)
    count = 0
    current = from_date
    while current <= to_date:
        for emp in employees:
            existing = db.query(DutyRoster).filter(
                DutyRoster.emp_code == emp["EmployeeCode"],
                DutyRoster.roster_date == current
            ).first()
            if existing:
                existing.shift_code = payload.shift_code
                existing.shift_name = payload.shift_name
            else:
                db.add(DutyRoster(
                    emp_code=emp["EmployeeCode"],
                    emp_name=emp["EmployeeName"],
                    dept_name=emp["DepartmentFName"],
                    shift_code=payload.shift_code,
                    shift_name=payload.shift_name,
                    roster_date=current,
                    notes=payload.notes,
                    created_by=user.id
                ))
            count += 1
        current += timedelta(days=1)
    db.commit()
    return {"message": f"Bulk roster assigned for {len(employees)} employees × {(to_date-from_date).days+1} days", "count": count}

@router.get("/")
def get_roster(from_date: str = None, to_date: str = None, dept: str = None,
               emp_code: str = None, db: Session = Depends(get_pg_db),
               user: User = Depends(get_current_user)):
    q = db.query(DutyRoster)
    if from_date: q = q.filter(DutyRoster.roster_date >= date.fromisoformat(from_date))
    if to_date: q = q.filter(DutyRoster.roster_date <= date.fromisoformat(to_date))
    if dept: q = q.filter(DutyRoster.dept_name == dept)
    if emp_code: q = q.filter(DutyRoster.emp_code == emp_code)
    entries = q.order_by(DutyRoster.roster_date, DutyRoster.emp_name).limit(500).all()
    return [{
        "id": e.id, "emp_code": e.emp_code, "emp_name": e.emp_name,
        "dept_name": e.dept_name, "shift_code": e.shift_code,
        "shift_name": e.shift_name, "roster_date": str(e.roster_date),
        "notes": e.notes,
    } for e in entries]

class BulkDeleteIn(BaseModel):
    ids: list[int]

@router.post("/bulk-delete")
def bulk_delete_roster(payload: BulkDeleteIn, db: Session = Depends(get_pg_db), admin: User = Depends(require_admin)):
    db.query(DutyRoster).filter(DutyRoster.id.in_(payload.ids)).delete(synchronize_session=False)
    db.commit()
    return {"message": f"Deleted {len(payload.ids)} roster entries"}

@router.delete("/{roster_id}")
def delete_roster(roster_id: int, db: Session = Depends(get_pg_db),
                   user: User = Depends(require_admin_or_head)):
    entry = db.query(DutyRoster).filter(DutyRoster.id == roster_id).first()
    if not entry: raise HTTPException(404, "Not found")
    db.delete(entry); db.commit()
    return {"message": "Deleted"}
