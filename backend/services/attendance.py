from core.database import essl_query, essl_query_one
from datetime import date, datetime, timedelta
from typing import Optional
import logging, calendar

logger = logging.getLogger(__name__)

def _device_logs_table(year: int, month: int) -> str:
    """eSSL partitions DeviceLogs by month/year into DeviceLogs_M_YYYY tables."""
    return f"DeviceLogs_{month}_{year}"

def get_punch_logs(emp_code: str, from_date: date, to_date: date) -> list:
    """Raw punch logs from eSSL DeviceLogs (partitioned tables)."""
    logs = []
    # Collect all month/year combos in range
    months = set()
    cur = date(from_date.year, from_date.month, 1)
    end = date(to_date.year, to_date.month, 1)
    while cur <= end:
        months.add((cur.year, cur.month))
        if cur.month == 12:
            cur = date(cur.year + 1, 1, 1)
        else:
            cur = date(cur.year, cur.month + 1, 1)

    for year, month in sorted(months):
        tbl = _device_logs_table(year, month)
        try:
            rows = essl_query(f"""
                SELECT DeviceLogId, UserId, LogDate, Direction, WorkCode
                FROM {tbl}
                WHERE UserId = ?
                  AND CAST(LogDate AS DATE) BETWEEN ? AND ?
                ORDER BY LogDate ASC
            """, [emp_code, str(from_date), str(to_date)])
            logs.extend(rows)
        except Exception:
            # Table may not exist for that month
            pass

    # Also try main DeviceLogs table
    try:
        rows = essl_query("""
            SELECT DeviceLogId, UserId, LogDate, Direction, WorkCode
            FROM DeviceLogs
            WHERE UserId = ?
              AND CAST(LogDate AS DATE) BETWEEN ? AND ?
            ORDER BY LogDate ASC
        """, [emp_code, str(from_date), str(to_date)])
        logs.extend(rows)
    except Exception:
        pass

    return logs

def get_attendance_from_logs(emp_code: str, from_date: date, to_date: date) -> list:
    """
    First try AttendanceLogs (already processed by eSSL).
    Fall back to computing from raw DeviceLogs.
    """
    # Try AttendanceLogs first
    try:
        rows = essl_query("""
            SELECT al.AttendanceDate, al.InTime, al.OutTime,
                   al.Duration, al.LateBy, al.EarlyBy,
                   al.Status, al.StatusCode, al.WeeklyOff,
                   al.Holiday, al.IsOnLeave, al.LeaveType,
                   al.OverTime, al.Present, al.Absent,
                   al.PunchRecords
            FROM AttendanceLogs al
            INNER JOIN Employees e ON e.EmployeeId = al.EmployeeId
            WHERE e.EmployeeCode = ?
              AND CAST(al.AttendanceDate AS DATE) BETWEEN ? AND ?
            ORDER BY al.AttendanceDate ASC
        """, [emp_code, str(from_date), str(to_date)])

        if rows:
            result = []
            for r in rows:
                att_date = r['AttendanceDate']
                if isinstance(att_date, str):
                    att_date = datetime.fromisoformat(att_date).date()
                elif hasattr(att_date, 'date'):
                    att_date = att_date.date()

                # Duration in minutes from float
                dur_min = int(r['Duration'] or 0)
                dur_str = f"{dur_min // 60:02d}:{dur_min % 60:02d}"

                # Status
                if r['WeeklyOff']:
                    status = 'WO'
                elif r['Holiday']:
                    status = 'H'
                elif r['IsOnLeave']:
                    status = 'L'
                elif r['Present'] and float(r['Present']) > 0:
                    status = 'P'
                else:
                    status = 'A'

                # Late/Early in minutes
                late_min = int(r['LateBy'] or 0)
                early_min = int(r['EarlyBy'] or 0)

                def safe_dt(dt):
                    if not dt: return "—"
                    s = str(dt)
                    if "1900" in s: return "—"
                    if " " in s:
                        return s.split(".")[0] # Strip milliseconds if any
                    return s

                result.append({
                    "date": str(att_date),
                    "day": att_date.strftime("%a"),
                    "status": status,
                    "first_in": safe_dt(r['InTime']),
                    "last_out": safe_dt(r['OutTime']),
                    "duration": dur_str,
                    "late_by": f"{late_min // 60:02d}:{late_min % 60:02d}",
                    "early_by": f"{early_min // 60:02d}:{early_min % 60:02d}",
                    "ot": f"{int(r['OverTime'] or 0) // 60:02d}:{int(r['OverTime'] or 0) % 60:02d}",
                    "punch_count": len(r['PunchRecords'].split(',')) if r['PunchRecords'] else 0,
                    "punches": r['PunchRecords'] or "",
                })
            return result
    except Exception as e:
        logger.warning(f"AttendanceLogs query failed: {e}, falling back to DeviceLogs")

    # Fallback: compute from raw DeviceLogs
    return _compute_from_device_logs(emp_code, from_date, to_date)

def _compute_from_device_logs(emp_code: str, from_date: date, to_date: date) -> list:
    logs = get_punch_logs(emp_code, from_date, to_date)
    by_day = {}
    for log in logs:
        log_dt = log["LogDate"]
        if isinstance(log_dt, str):
            log_dt = datetime.fromisoformat(log_dt)
        day = log_dt.date()
        by_day.setdefault(day, []).append(log_dt)

    from core.database import PgSession
    from models.models import Shift
    from routers.roster_router import DutyRoster
    
    db = PgSession()
    rosters = db.query(DutyRoster).filter(
        DutyRoster.emp_code == emp_code,
        DutyRoster.roster_date >= from_date,
        DutyRoster.roster_date <= to_date
    ).all()
    roster_map = {r.roster_date: r.shift_code for r in rosters}
    
    shifts = {s.code: s for s in db.query(Shift).all()}
    db.close()

    result = []
    current = from_date
    while current <= to_date:
        punches = sorted(by_day.get(current, []))
        
        # Determine shift for the day
        shift_code = roster_map.get(current)
        shift = shifts.get(shift_code) if shift_code else None
        
        if punches:
            first_in = punches[0]
            last_out = punches[-1]
            dur_min = int((last_out - first_in).total_seconds() / 60)
            
            late_by_min = 0
            if shift and not shift.is_flexible:
                try:
                    sh, sm = map(int, shift.start_time.split(':'))
                    shift_start = datetime(current.year, current.month, current.day, sh, sm)
                    # Add grace period? Let's just say 15 mins for now if we wanted, but let's do strict diff
                    if first_in > shift_start:
                        late_by_min = int((first_in - shift_start).total_seconds() / 60)
                except:
                    pass

            result.append({
                "date": current.isoformat(),
                "day": current.strftime("%a"),
                "status": "P",
                "first_in": first_in.strftime("%Y-%m-%d %H:%M:%S"),
                "last_out": last_out.strftime("%Y-%m-%d %H:%M:%S"),
                "duration": f"{dur_min // 60:02d}:{dur_min % 60:02d}",
                "late_by": f"{late_by_min // 60:02d}:{late_by_min % 60:02d}",
                "early_by": "00:00", "ot": "00:00",
                "punch_count": len(punches),
                "punches": ",".join(p.strftime("%H:%M:%S") for p in punches),
                "shift": shift.name if shift else "—",
            })
        else:
            dow = current.weekday()
            result.append({
                "date": current.isoformat(),
                "day": current.strftime("%a"),
                "status": "WO" if dow == 6 else "A",
                "first_in": "—", "last_out": "—",
                "duration": "00:00", "late_by": "00:00",
                "early_by": "00:00", "ot": "00:00",
                "punch_count": 0, "punches": "",
                "shift": shift.name if shift else "—",
            })
        current += timedelta(days=1)
    return result

def get_monthly_summary(emp_code: str, year: int, month: int) -> dict:
    from core.database import PgSession
    from models.models import AppSetting
    from dateutil.relativedelta import relativedelta
    db = PgSession()
    setting = db.query(AppSetting).first()
    start_day = setting.month_start_day if setting else 1
    db.close()

    if start_day == 1:
        _, days_in_month = calendar.monthrange(year, month)
        from_date = date(year, month, 1)
        to_date = date(year, month, days_in_month)
    else:
        to_date = date(year, month, start_day) - relativedelta(days=1)
        from_date = date(to_date.year, to_date.month, start_day) - relativedelta(months=1)
        days_in_month = (to_date - from_date).days + 1

    daily = get_attendance_from_logs(emp_code, from_date, to_date)

    present = sum(1 for d in daily if d["status"] == "P")
    absent = sum(1 for d in daily if d["status"] == "A")
    woff = sum(1 for d in daily if d["status"] == "WO")
    holiday = sum(1 for d in daily if d["status"] == "H")
    on_leave = sum(1 for d in daily if d["status"] == "L")

    total_min = 0
    for d in daily:
        if d["duration"] and d["duration"] != "00:00":
            try:
                h, m = map(int, d["duration"].split(":"))
                total_min += h * 60 + m
            except Exception:
                pass

    total_hrs = f"{total_min // 60:02d}:{total_min % 60:02d}"
    avg_min = total_min // present if present > 0 else 0
    avg_hrs = f"{avg_min // 60:02d}:{avg_min % 60:02d}"

    return {
        "emp_code": emp_code,
        "year": year,
        "month": month,
        "total_days": days_in_month,
        "present": present,
        "absent": absent,
        "weekly_off": woff,
        "holidays": holiday,
        "on_leave": on_leave,
        "total_duration": total_hrs,
        "avg_hrs_per_day": avg_hrs,
        "daily": daily,
    }

def get_admin_dashboard_stats(from_date: date, to_date: date) -> dict:
    today = date.today()
    today_str = today.strftime('%Y-%m-%d')
    month = today.month
    year = today.year
    tbl = _device_logs_table(year, month)

    try:
        total = essl_query_one("""
            SELECT COUNT(*) AS cnt FROM Employees WHERE Status='Active' OR Status='1' OR RecordStatus=1
        """) or {}
        total_emp = total.get('cnt', 0) or 0
    except Exception:
        total_emp = 0

    try:
        present_row = essl_query_one(f"""
            SELECT COUNT(DISTINCT UserId) AS cnt FROM {tbl}
            WHERE CAST(LogDate AS DATE) = CAST(GETDATE() AS DATE)
        """) or {}
        present_today = present_row.get('cnt', 0) or 0
    except Exception:
        present_today = 0

    try:
        late_row = essl_query_one(f"""
            SELECT COUNT(DISTINCT EmployeeId) AS cnt FROM AttendanceLogs
            WHERE CAST(AttendanceDate AS DATE) = CAST(GETDATE() AS DATE)
              AND LateBy > 0
        """) or {}
        late_today = late_row.get('cnt', 0) or 0
    except Exception:
        late_today = 0

    # Department stats
    dept_stats = []
    try:
        dept_stats = essl_query(f"""
            SELECT d.DepartmentFName AS dept,
                   COUNT(DISTINCT e.EmployeeCode) AS total,
                   COUNT(DISTINCT dl.UserId) AS present
            FROM Departments d
            LEFT JOIN Employees e ON e.DepartmentId = d.DepartmentId
                AND (e.Status='Active' OR e.RecordStatus=1)
            LEFT JOIN {tbl} dl ON dl.UserId = e.EmployeeCode
                AND CAST(dl.LogDate AS DATE) = CAST(GETDATE() AS DATE)
            GROUP BY d.DepartmentFName
            ORDER BY d.DepartmentFName
        """)
    except Exception as e:
        logger.warning(f"Dept stats failed: {e}")

    # Trend
    trend = []
    try:
        cur_month_tbl = _device_logs_table(today.year, today.month)
        trend = essl_query(f"""
            SELECT CAST(LogDate AS DATE) AS att_date,
                   COUNT(DISTINCT UserId) AS present
            FROM {cur_month_tbl}
            WHERE CAST(LogDate AS DATE) BETWEEN ? AND CAST(GETDATE() AS DATE)
            GROUP BY CAST(LogDate AS DATE)
            ORDER BY att_date
        """, [str(from_date)])
    except Exception as e:
        logger.warning(f"Trend query failed: {e}")

    return {
        "total_employees": total_emp,
        "present_today": present_today,
        "absent_today": max(0, total_emp - present_today),
        "late_today": late_today,
        "on_leave": 0,
        "dept_stats": [{"dept": r.get("dept",""), "total": r.get("total",0), "present": r.get("present",0)} for r in dept_stats],
        "trend": [{"date": str(r.get("att_date","")), "present": r.get("present",0)} for r in trend],
    }

def get_team_attendance(dept_codes: list, att_date: date) -> list:
    month = att_date.month
    year = att_date.year
    tbl = _device_logs_table(year, month)
    try:
        return essl_query(f"""
            SELECT e.EmployeeCode, e.EmployeeName AS Name,
                   d.DepartmentName AS Department,
                   MIN(dl.LogDate) AS FirstIn,
                   MAX(dl.LogDate) AS LastOut,
                   COUNT(dl.DeviceLogId) AS PunchCount
            FROM Employees e
            LEFT JOIN Departments d ON d.DepartmentId = e.DepartmentId
            LEFT JOIN {tbl} dl ON dl.UserId = e.EmployeeCode
                AND CAST(dl.LogDate AS DATE) = ?
            WHERE e.RecordStatus = 1 OR e.Status = 'Active'
            GROUP BY e.EmployeeCode, e.EmployeeName, d.DepartmentName
            ORDER BY d.DepartmentName, e.EmployeeName
        """, [str(att_date)])
    except Exception as e:
        logger.error(f"Team attendance failed: {e}")
        return []
