from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.database import Base, pg_engine
from routers import (auth_router, admin_router, attendance_router,
                     leave_router, payroll_router, company_router,
                     shift_router, device_router, gatepass_router,
                     roster_router, report_router, settings_router,
                     debug_router)
import threading, time, logging

logger = logging.getLogger(__name__)
app = FastAPI(title="EastCoast HRMS API", version="4.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])

def nightly_sync():
    while True:
        try:
            now = time.localtime()
            if now.tm_hour == 2 and now.tm_min == 0:
                from core.database import PgSession, essl_query
                from models.models import User, RoleEnum
                from services.auth import hash_password
                db = PgSession()
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
                logger.info(f"Nightly sync: {created} new employees added")
                time.sleep(61)
        except Exception as e:
            logger.error(f"Nightly sync error: {e}")
        time.sleep(30)

@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=pg_engine)
    
    # Auto-migration for newly added columns
    from sqlalchemy import text
    try:
        with pg_engine.begin() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN basic_salary FLOAT DEFAULT 0.0;"))
    except Exception: pass
    try:
        with pg_engine.begin() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN hra FLOAT DEFAULT 0.0;"))
    except Exception: pass

    threading.Thread(target=nightly_sync, daemon=True).start()
    logger.info("EastCoast HRMS v4 started. Nightly sync at 02:00.")

app.include_router(auth_router.router)
app.include_router(admin_router.router)
app.include_router(attendance_router.router)
app.include_router(leave_router.router)
app.include_router(payroll_router.router)
app.include_router(company_router.router)
app.include_router(shift_router.router)
app.include_router(device_router.router)
app.include_router(gatepass_router.router)
app.include_router(roster_router.router)
app.include_router(report_router.router)
app.include_router(settings_router.router)
app.include_router(debug_router.router)

@app.get("/api/health")
def health():
    return {"status":"ok","service":"EastCoast HRMS","version":"4.0.0"}
