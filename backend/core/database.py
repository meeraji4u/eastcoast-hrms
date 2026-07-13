import os

# Must be set before pyodbc is imported - fixes TLS for older SQL Server
_cnf = "/app/openssl_permissive.cnf"
if os.path.exists(_cnf):
    os.environ["OPENSSL_CONF"] = _cnf

import pyodbc
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from core.config import settings
import logging

logger = logging.getLogger(__name__)

pg_engine = create_engine(settings.POSTGRES_URL, pool_pre_ping=True, pool_size=10)
PgSession = sessionmaker(autocommit=False, autoflush=False, bind=pg_engine)

class Base(DeclarativeBase):
    pass

def get_pg_db():
    db = PgSession()
    try:
        yield db
    finally:
        db.close()

def get_essl_conn():
    conn_str = (
        "DRIVER={ODBC Driver 17 for SQL Server};"
        f"SERVER={settings.ESSL_SERVER},{settings.ESSL_PORT};"
        f"DATABASE={settings.ESSL_DATABASE};"
        f"UID={settings.ESSL_USERNAME};"
        f"PWD={settings.ESSL_PASSWORD};"
        "Encrypt=no;"
        "TrustServerCertificate=yes;"
    )
    try:
        return pyodbc.connect(conn_str, timeout=10)
    except Exception as e:
        logger.error(f"eSSL DB connection failed: {e}")
        raise

def essl_query(sql, params=None):
    conn = get_essl_conn()
    cursor = conn.cursor()
    try:
        cursor.execute(sql, params or [])
        columns = [col[0] for col in cursor.description]
        return [dict(zip(columns, row)) for row in cursor.fetchall()]
    finally:
        cursor.close()
        conn.close()

def essl_query_one(sql, params=None):
    rows = essl_query(sql, params)
    return rows[0] if rows else None
