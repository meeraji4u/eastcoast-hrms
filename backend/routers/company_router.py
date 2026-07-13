from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from core.database import get_pg_db, essl_query
from services.auth import get_current_user
from models.models import Company, Department, User

router = APIRouter(tags=["Company"])

@router.get("/api/companies")
def get_companies(db: Session = Depends(get_pg_db), user: User = Depends(get_current_user)):
    rows = db.query(Company).order_by(Company.name).all()
    return [{"id": r.id, "name": r.name, "code": r.code} for r in rows]

@router.get("/api/departments")
def get_departments(db: Session = Depends(get_pg_db), user: User = Depends(get_current_user)):
    # First try eSSL departments
    try:
        rows = essl_query("""
            SELECT DepartmentId AS id, DepartmentFName AS name
            FROM Departments ORDER BY DepartmentFName
        """)
        return [{"id": r.get("id", r.get("DepartmentId")), "name": r.get("name", r.get("DepartmentFName"))} for r in rows]
    except Exception as ex:
        import logging
        logging.getLogger(__name__).warning(f"eSSL depts: {ex}")
        error_msg = str(ex)

    # Fallback to HRMS departments
    res = []
    try:
        res = [{"id": r.id, "name": r.name} for r in db.query(Department).all()]
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"HRMS depts fallback error: {e}")
        
    if not res and 'error_msg' in locals():
        res.append({"id": "err", "name": f"ERROR: {error_msg}"})
    return res
