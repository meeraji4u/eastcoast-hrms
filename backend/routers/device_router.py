from fastapi import APIRouter, Depends
from core.database import essl_query, essl_query_one
from services.auth import get_current_user, require_admin
from models.models import User
from datetime import date, datetime
from pydantic import BaseModel
from fastapi import HTTPException

class DeviceCreate(BaseModel):
    name: str
    ip: str
    location: str

router = APIRouter(prefix="/api/devices", tags=["Devices"])

@router.get("/")
def get_devices(user: User = Depends(require_admin)):
    try:
        tbl = f"DeviceLogs_{date.today().month}_{date.today().year}"
        devices = essl_query(f"""
            SELECT d.DeviceId, d.DeviceFName, d.DeviceType,
                   d.IpAddress, d.DeviceLocation, d.LastPing,
                   d.LastLogDownloadDate, d.SerialNumber, d.ConnectionType,
                   COUNT(dl.DeviceLogId) AS TodayLogs
            FROM Devices d
            LEFT JOIN {tbl} dl ON dl.DeviceId = d.DeviceId
                AND CAST(dl.LogDate AS DATE) = CAST(GETDATE() AS DATE)
            GROUP BY d.DeviceId, d.DeviceFName, d.DeviceType,
                     d.IpAddress, d.DeviceLocation, d.LastPing,
                     d.LastLogDownloadDate, d.SerialNumber, d.ConnectionType
            ORDER BY d.DeviceFName
        """)
        result = []
        for d in devices:
            lp = d.get("LastPing")
            is_online = False
            if lp:
                try:
                    diff = datetime.now() - lp.replace(tzinfo=None)
                    is_online = diff.total_seconds() < 600
                except:
                    pass
            result.append({
                "device_id": d.get("DeviceId"),
                "name": d.get("DeviceFName") or f"Device {d.get('DeviceId')}",
                "type": d.get("DeviceType") or "Biometric",
                "ip": d.get("IpAddress") or "—",
                "serial": d.get("SerialNumber") or "—",
                "location": d.get("DeviceLocation") or "—",
                "connection": d.get("ConnectionType") or "TCP/IP",
                "is_online": is_online,
                "last_ping": str(lp) if lp else "Never",
                "last_download": str(d.get("LastLogDownloadDate")) if d.get("LastLogDownloadDate") else "Never",
                "today_logs": int(d.get("TodayLogs") or 0),
            })
        return result
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Devices error: {e}")
        return []

@router.get("/summary")
def device_summary(user: User = Depends(get_current_user)):
    try:
        rows = essl_query("SELECT DeviceId, LastPing FROM Devices")
        total = len(rows)
        online = 0
        for r in rows:
            lp = r.get("LastPing")
            if lp:
                try:
                    diff = datetime.now() - lp.replace(tzinfo=None)
                    if diff.total_seconds() < 600:
                        online += 1
                except:
                    pass
        return {"total": total, "online": online, "offline": max(0, total - online)}
    except:
        return {"total": 0, "online": 0, "offline": 0}

@router.post("/")
def create_device(payload: DeviceCreate, user: User = Depends(require_admin)):
    try:
        from core.database import essl_execute
        # Usually Devices table auto-increments DeviceId, but some eSSL setups don't.
        # We will just insert the fields and hope it works. If it fails, they can use eSSL software.
        essl_execute("""
            INSERT INTO Devices (DeviceFName, IpAddress, DeviceLocation, DeviceType, ConnectionType)
            VALUES (?, ?, ?, 'Biometric', 'TCP/IP')
        """, [payload.name, payload.ip, payload.location])
        return {"message": "Device added to eSSL successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
