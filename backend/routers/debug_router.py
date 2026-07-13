from fastapi import APIRouter
from core.database import essl_query

router = APIRouter(tags=["Debug"])

@router.get("/api/debug/db")
def debug_db():
    try:
        tables = essl_query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES")
        depts_raw = essl_query("SELECT TOP 5 * FROM Departments") if any(t.get('TABLE_NAME') == 'Departments' for t in tables) else "No Departments table"
        shifts_raw = essl_query("SELECT TOP 5 * FROM Shifts") if any(t.get('TABLE_NAME') == 'Shifts' for t in tables) else "No Shifts table"
        
        dept_query = "FAILED"
        try:
            r = essl_query("SELECT DepartmentId AS id, DepartmentFName AS name FROM Departments ORDER BY DepartmentFName")
            dept_query = [{"id": row.get("id"), "name": row.get("name")} for row in r]
        except Exception as e:
            dept_query = f"ERROR: {str(e)}"
            
        shift_query = "FAILED"
        try:
            r = essl_query("SELECT ShiftId, ShiftFName, ShiftSName, BeginTime, EndTime, ShiftDuration, GraceTime, ShiftType FROM Shifts ORDER BY ShiftFName")
            shift_query = [dict(row) for row in r]
        except Exception as e:
            shift_query = f"ERROR: {str(e)}"

        return {
            "tables": [t.get('TABLE_NAME') for t in tables],
            "depts_raw": depts_raw,
            "shifts_raw": shifts_raw,
            "dept_query": dept_query,
            "shift_query": shift_query
        }
    except Exception as e:
        return {"error": str(e)}

@router.get("/api/debug/test_depts")
def test_depts():
    try:
        r = essl_query("SELECT DepartmentId AS id, DepartmentFName AS name FROM Departments ORDER BY DepartmentFName")
        return [{"id": row.get("id"), "name": row.get("name")} for row in r]
    except Exception as e:
        return {"error": str(e)}

@router.get("/api/debug/test_shifts")
def test_shifts():
    try:
        r = essl_query("SELECT ShiftId, ShiftFName, ShiftSName, BeginTime, EndTime, ShiftDuration, GraceTime, ShiftType FROM Shifts ORDER BY ShiftFName")
        return [dict(row) for row in r]
    except Exception as e:
        return {"error": str(e)}
