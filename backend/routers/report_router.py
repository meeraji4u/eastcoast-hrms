from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse, JSONResponse
from datetime import date, datetime, timedelta
from typing import Optional
from services.auth import get_current_user, require_admin_or_head
from core.database import essl_query, essl_query_one
from models.models import User
import io, logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/reports", tags=["Reports"])

def safe_str(v):
    if v is None: return "—"
    if hasattr(v, 'strftime'): return v.strftime("%Y-%m-%d %H:%M")
    s = str(v)
    return "—" if "1900" in s else s

def safe_time(v):
    if not v or "1900" in str(v): return "—"
    s = str(v).strip()
    if " " in s: s = s.split(" ")[1]
    return s[:5]

# ── Daily Attendance Report ───────────────────────────────────────────────
@router.get("/daily-attendance")
def daily_attendance(
    att_date: str = Query(None),
    dept: Optional[str] = None,
    user: User = Depends(require_admin_or_head)
):
    d = att_date or date.today().isoformat()
    tbl = f"DeviceLogs_{datetime.fromisoformat(d).month}_{datetime.fromisoformat(d).year}"
    dept_filter = "AND dp.DepartmentFName = ?" if dept else ""
    params = [d]
    if dept: params.append(dept)
    try:
        rows = essl_query(f"""
            SELECT e.EmployeeCode, e.EmployeeName,
                   dp.DepartmentFName AS dept,
                   MIN(dl.LogDate) AS first_in,
                   MAX(dl.LogDate) AS last_out,
                   COUNT(dl.DeviceLogId) AS punches,
                   CASE WHEN COUNT(dl.DeviceLogId)>0 THEN 'Present' ELSE 'Absent' END AS status
            FROM Employees e
            LEFT JOIN Departments dp ON dp.DepartmentId=e.DepartmentId
            LEFT JOIN {tbl} dl ON dl.UserId=e.EmployeeCode
                AND CAST(dl.LogDate AS DATE)=?
            WHERE e.RecordStatus=1 {dept_filter}
            GROUP BY e.EmployeeCode,e.EmployeeName,dp.DepartmentFName
            ORDER BY dp.DepartmentFName,e.EmployeeName
        """, params)
        return [{"emp_code":r["EmployeeCode"],"name":r["EmployeeName"],
                 "dept":r["dept"]or"","status":r["status"],
                 "first_in":safe_time(r["first_in"]),
                 "last_out":safe_time(r["last_out"]),
                 "punches":r["punches"]or 0} for r in rows]
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail":str(e)})

# ── Attendance Summary ────────────────────────────────────────────────────
@router.get("/attendance-summary")
def attendance_summary(
    from_date: str = Query(None),
    to_date: str = Query(None),
    dept: Optional[str] = None,
    search: Optional[str] = None,
    user: User = Depends(require_admin_or_head)
):
    today = date.today()
    fd = from_date or date(today.year, today.month, 1).isoformat()
    td = to_date or today.isoformat()
    dept_filter = "AND dp.DepartmentFName = ?" if dept else ""
    search_filter = "AND (e.EmployeeName LIKE ? OR e.EmployeeCode LIKE ?)" if search else ""
    params = [fd, td]
    if dept: params.append(dept)
    if search: params += [f"%{search}%", f"%{search}%"]
    try:
        rows = essl_query(f"""
            SELECT e.EmployeeCode, e.EmployeeName,
                   dp.DepartmentFName AS dept,
                   COUNT(DISTINCT CAST(al.AttendanceDate AS DATE)) AS present_days,
                   SUM(CAST(al.Absent AS INT)) AS absent_days,
                   SUM(al.Duration) AS total_mins,
                   SUM(al.OverTime) AS total_ot
            FROM Employees e
            LEFT JOIN Departments dp ON dp.DepartmentId=e.DepartmentId
            LEFT JOIN AttendanceLogs al ON al.EmployeeId=e.EmployeeId
                AND CAST(al.AttendanceDate AS DATE) BETWEEN ? AND ?
                AND al.Present>0
            WHERE e.RecordStatus=1 {dept_filter} {search_filter}
            GROUP BY e.EmployeeCode,e.EmployeeName,dp.DepartmentFName
            ORDER BY dp.DepartmentFName,e.EmployeeName
        """, params)
        result = []
        for r in rows:
            mins = int(r["total_mins"] or 0)
            ot = int(r["total_ot"] or 0)
            result.append({
                "emp_code":r["EmployeeCode"],"name":r["EmployeeName"],
                "dept":r["dept"]or"",
                "present":r["present_days"]or 0,
                "absent":r["absent_days"]or 0,
                "total_hours":f"{mins//60:02d}:{mins%60:02d}",
                "ot_hours":f"{ot//60:02d}:{ot%60:02d}",
            })
        return result
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail":str(e)})

# ── Employee Details ─────────────────────────────────────────────────────
@router.get("/employee-details")
def employee_details(
    search: Optional[str] = None,
    dept: Optional[str] = None,
    status: Optional[str] = None,
    user: User = Depends(require_admin_or_head)
):
    filters = "WHERE e.RecordStatus=1"
    params = []
    if dept: filters += " AND dp.DepartmentFName=?"; params.append(dept)
    if search: filters += " AND (e.EmployeeName LIKE ? OR e.EmployeeCode LIKE ?)"; params += [f"%{search}%",f"%{search}%"]
    if status: filters += " AND e.Status=?"; params.append(status)
    try:
        rows = essl_query(f"""
            SELECT e.EmployeeCode, e.EmployeeName, e.Designation,
                   dp.DepartmentFName AS dept, e.Status,
                   e.ContactNo, e.Email, e.DOJ, e.Gender
            FROM Employees e
            LEFT JOIN Departments dp ON dp.DepartmentId=e.DepartmentId
            {filters}
            ORDER BY dp.DepartmentFName, e.EmployeeName
        """, params)
        return [{"emp_code":r["EmployeeCode"],"name":r["EmployeeName"],
                 "designation":r["Designation"]or"","dept":r["dept"]or"",
                 "status":r["Status"]or"","phone":r["ContactNo"]or"",
                 "email":r["Email"]or"","doj":safe_str(r["DOJ"]).split(" ")[0] if r["DOJ"] else "—",
                 "gender":r["Gender"]or""} for r in rows]
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail":str(e)})

# ── Log Records (Punch Log) ───────────────────────────────────────────────
@router.get("/log-records")
def log_records(
    emp_code: str = Query(...),
    from_date: str = Query(None),
    to_date: str = Query(None),
    user: User = Depends(get_current_user)
):
    today = date.today()
    fd = date.fromisoformat(from_date) if from_date else date(today.year, today.month, 1)
    td = date.fromisoformat(to_date) if to_date else today
    logs = []
    cur = date(fd.year, fd.month, 1)
    end = date(td.year, td.month, 1)
    while cur <= end:
        tbl = f"DeviceLogs_{cur.month}_{cur.year}"
        try:
            rows = essl_query(f"""
                SELECT dl.LogDate, dl.Direction, d.DeviceFName AS device
                FROM {tbl} dl
                LEFT JOIN Devices d ON d.DeviceId=dl.DeviceId
                WHERE dl.UserId=?
                  AND CAST(dl.LogDate AS DATE) BETWEEN ? AND ?
                ORDER BY dl.LogDate
            """, [emp_code, str(fd), str(td)])
            logs.extend(rows)
        except: pass
        cur = date(cur.year+(cur.month//12), cur.month%12+1, 1)
    return [{"log_time":safe_str(r["LogDate"]),"direction":r["Direction"]or"","device":r["device"]or""} for r in logs]

# ── Leave Summary ─────────────────────────────────────────────────────────
@router.get("/leave-summary")
def leave_summary(
    from_date: str = Query(None),
    to_date: str = Query(None),
    dept: Optional[str] = None,
    user: User = Depends(require_admin_or_head)
):
    today = date.today()
    fd = from_date or date(today.year, 1, 1).isoformat()
    td = to_date or today.isoformat()
    dept_filter = "AND dp.DepartmentFName=?" if dept else ""
    params = [fd, td]
    if dept: params.append(dept)
    try:
        rows = essl_query(f"""
            SELECT e.EmployeeCode, e.EmployeeName,
                   dp.DepartmentFName AS dept,
                   al.LeaveType,
                   COUNT(DISTINCT CAST(al.AttendanceDate AS DATE)) AS leave_days
            FROM AttendanceLogs al
            INNER JOIN Employees e ON e.EmployeeId=al.EmployeeId
            LEFT JOIN Departments dp ON dp.DepartmentId=e.DepartmentId
            WHERE al.IsOnLeave=1
              AND CAST(al.AttendanceDate AS DATE) BETWEEN ? AND ?
              AND e.RecordStatus=1 {dept_filter}
            GROUP BY e.EmployeeCode,e.EmployeeName,dp.DepartmentFName,al.LeaveType
            ORDER BY dp.DepartmentFName,e.EmployeeName
        """, params)
        return [{"emp_code":r["EmployeeCode"],"name":r["EmployeeName"],
                 "dept":r["dept"]or"","leave_type":r["LeaveType"]or"",
                 "days":r["leave_days"]or 0} for r in rows]
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail":str(e)})

# ── Leave Entry Report ────────────────────────────────────────────────────
@router.get("/leave-entry")
def leave_entry(
    from_date: str = Query(None),
    to_date: str = Query(None),
    emp_code: Optional[str] = None,
    user: User = Depends(require_admin_or_head)
):
    today = date.today()
    fd = from_date or date(today.year, today.month, 1).isoformat()
    td = to_date or today.isoformat()
    emp_filter = "AND e.EmployeeCode=?" if emp_code else ""
    params = [fd, td]
    if emp_code: params.append(emp_code)
    try:
        rows = essl_query(f"""
            SELECT e.EmployeeCode, e.EmployeeName,
                   dp.DepartmentFName AS dept,
                   al.AttendanceDate, al.LeaveType, al.LeaveRemarks,
                   al.LeaveDuration
            FROM AttendanceLogs al
            INNER JOIN Employees e ON e.EmployeeId=al.EmployeeId
            LEFT JOIN Departments dp ON dp.DepartmentId=e.DepartmentId
            WHERE al.IsOnLeave=1
              AND CAST(al.AttendanceDate AS DATE) BETWEEN ? AND ?
              AND e.RecordStatus=1 {emp_filter}
            ORDER BY al.AttendanceDate,e.EmployeeName
        """, params)
        return [{"emp_code":r["EmployeeCode"],"name":r["EmployeeName"],
                 "dept":r["dept"]or"",
                 "date":safe_str(r["AttendanceDate"]).split(" ")[0],
                 "leave_type":r["LeaveType"]or"",
                 "remarks":r["LeaveRemarks"]or"",
                 "duration":r["LeaveDuration"]or 0} for r in rows]
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail":str(e)})

# ── OutDoor / Gate Pass Report ────────────────────────────────────────────
@router.get("/outdoor-entry")
def outdoor_entry(
    from_date: str = Query(None),
    to_date: str = Query(None),
    dept: Optional[str] = None,
    user: User = Depends(require_admin_or_head)
):
    # Pull from HRMS gate_passes table
    from core.database import get_pg_db, PgSession
    from routers.gatepass_router import GatePass
    db = PgSession()
    try:
        from sqlalchemy import and_
        q = db.query(GatePass)
        if from_date: q = q.filter(GatePass.pass_date >= date.fromisoformat(from_date))
        if to_date: q = q.filter(GatePass.pass_date <= date.fromisoformat(to_date))
        passes = q.order_by(GatePass.pass_date.desc()).limit(500).all()
        from models.models import User as UserModel
        result = []
        for p in passes:
            emp = db.query(UserModel).filter(UserModel.id == p.emp_id).first()
            result.append({
                "emp_code": emp.emp_code if emp else "",
                "name": emp.name if emp else "",
                "date": str(p.pass_date),
                "out_time": p.out_time,
                "expected_return": p.expected_return,
                "pass_type": p.pass_type,
                "reason": p.reason,
                "status": p.status,
            })
        return result
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail":str(e)})
    finally:
        db.close()

# ── Monthly Status Report (Detailed Daily) ──────────────────────────────────
@router.get("/monthly-status")
def get_monthly_status(
    from_date: str = Query(...),
    to_date: str = Query(...),
    emp_code: Optional[str] = None,
    dept: Optional[str] = None,
    user: User = Depends(require_admin_or_head)
):
    from datetime import date
    from services.attendance import get_attendance_from_logs
    try:
        filters = "WHERE e.RecordStatus=1 AND e.Status='Working'"
        params = []
        if emp_code:
            filters += " AND e.EmployeeCode = ?"
            params.append(emp_code)
        if dept:
            filters += " AND dp.DepartmentFName = ?"
            params.append(dept)

        emp_rows = essl_query(f"""
            SELECT e.EmployeeCode, e.EmployeeName, dp.DepartmentFName AS dept, e.Designation
            FROM Employees e
            LEFT JOIN Departments dp ON dp.DepartmentId=e.DepartmentId
            {filters}
            ORDER BY dp.DepartmentFName, e.EmployeeName
        """, params)
        
        if not emp_rows:
            return JSONResponse(status_code=404, content={"detail": "No employees found"})

        fd = date.fromisoformat(from_date)
        td = date.fromisoformat(to_date)
        results = []
        for emp in emp_rows:
            daily = get_attendance_from_logs(emp["EmployeeCode"], fd, td)
            
            present = sum(1 for d in daily if d["status"] == "P")
            absent = sum(1 for d in daily if d["status"] == "A")
            woff = sum(1 for d in daily if d["status"] == "WO")
            holiday = sum(1 for d in daily if d["status"] == "H")
            on_leave = sum(1 for d in daily if d["status"] == "L")
            
            total_min = 0
            late_min = 0
            early_min = 0
            for d in daily:
                if d["duration"] and d["duration"] != "00:00" and d["duration"] != "—":
                    try:
                        h, m = map(int, d["duration"].split(":"))
                        total_min += h * 60 + m
                    except: pass
                if d.get("late_by") and d["late_by"] != "00:00" and d["late_by"] != "—":
                    try:
                        h, m = map(int, d["late_by"].split(":"))
                        late_min += h * 60 + m
                    except: pass
                if d.get("early_by") and d["early_by"] != "00:00" and d["early_by"] != "—":
                    try:
                        h, m = map(int, d["early_by"].split(":"))
                        early_min += h * 60 + m
                    except: pass

            total_hrs = f"{total_min // 60:02d}:{total_min % 60:02d}"
            avg_min = total_min // present if present > 0 else 0
            avg_hrs = f"{avg_min // 60:02d}:{avg_min % 60:02d}"
            late_hrs = f"{late_min // 60:02d}:{late_min % 60:02d}"
            early_hrs = f"{early_min // 60:02d}:{early_min % 60:02d}"

            results.append({
                "emp_code": emp["EmployeeCode"],
                "name": emp["EmployeeName"],
                "dept": emp["dept"] or "",
                "designation": emp["Designation"] or "",
                "present": present,
                "absent": absent,
                "weekly_off": woff,
                "holidays": holiday,
                "on_leave": on_leave,
                "total_duration": total_hrs,
                "late_by_hrs": late_hrs,
                "early_by_hrs": early_hrs,
                "avg_working_hrs": avg_hrs,
                "daily": daily
            })
            
        if emp_code and len(results) == 1:
            return results[0]
        return results
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail":str(e)})

# ── Departments list for filter ───────────────────────────────────────────
@router.get("/departments")
def get_depts(user: User = Depends(get_current_user)):
    try:
        rows = essl_query("SELECT DepartmentFName FROM Departments WHERE RecordStatus=1 ORDER BY DepartmentFName")
        return [r["DepartmentFName"] for r in rows]
    except: return []
