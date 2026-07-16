from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import date, datetime
from typing import Optional
from core.database import get_pg_db
from services.auth import get_current_user
from services.attendance import (
    get_monthly_summary, get_admin_dashboard_stats, get_team_attendance
)
from models.models import User, RoleEnum

router = APIRouter(prefix="/api/attendance", tags=["Attendance"])

@router.get("/my")
def my_attendance(year: int = Query(None), month: int = Query(None),
                  db: Session = Depends(get_pg_db), user: User = Depends(get_current_user)):
    now = datetime.now()
    y = year or now.year
    m = month or now.month
    try:
        return get_monthly_summary(user.emp_code, y, m)
    except Exception as e:
        return {"emp_code": user.emp_code, "year": y, "month": m,
                "present": 0, "absent": 0, "weekly_off": 0,
                "total_duration": "00:00", "avg_hrs_per_day": "00:00",
                "total_days": 30, "daily": [], "error": str(e)}

@router.get("/employee/{emp_code}")
def employee_attendance(emp_code: str, year: int = Query(None), month: int = Query(None),
                        db: Session = Depends(get_pg_db), user: User = Depends(get_current_user)):
    now = datetime.now()
    y = year or now.year
    m = month or now.month
    try:
        return get_monthly_summary(emp_code, y, m)
    except Exception as e:
        return {"emp_code": emp_code, "year": y, "month": m,
                "present": 0, "absent": 0, "weekly_off": 0,
                "total_duration": "00:00", "avg_hrs_per_day": "00:00",
                "total_days": 30, "daily": [], "error": str(e)}

@router.get("/dashboard")
def dashboard_stats(user: User = Depends(get_current_user)):
    from datetime import timedelta
    today = date.today()
    two_weeks_ago = today - timedelta(days=14)
    dept_name = None
    if user.role == RoleEnum.dept_head and user.department:
        dept_name = user.department.name
    try:
        return get_admin_dashboard_stats(two_weeks_ago, today, dept=dept_name)
    except Exception as e:
        return {"total_employees": 0, "present_today": 0, "absent_today": 0,
                "on_leave": 0, "dept_stats": [], "trend": [], "error": str(e)}

@router.get("/team")
def team_attendance(att_date: str = Query(None), user: User = Depends(get_current_user)):
    d = date.fromisoformat(att_date) if att_date else date.today()
    try:
        return get_team_attendance([], d)
    except Exception as e:
        return []

from fastapi import WebSocket, WebSocketDisconnect
from typing import List
import json
import asyncio
from core.database import essl_query

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                pass

manager = ConnectionManager()

@router.websocket("/ws/punches")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        last_id = 0
        while True:
            # Poll eSSL DeviceLogs for new punches
            try:
                # We would ideally keep track of last processed DeviceLogId
                rows = essl_query(f"SELECT TOP 5 DeviceLogId, EmployeeCode, LogDate FROM DeviceLogs WHERE DeviceLogId > {last_id} ORDER BY DeviceLogId DESC")
                if rows:
                    last_id = max([r["DeviceLogId"] for r in rows])
                    await manager.broadcast(json.dumps({"type": "NEW_PUNCH", "data": [dict(r) for r in rows]}))
            except Exception as e:
                pass
            await asyncio.sleep(5)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
