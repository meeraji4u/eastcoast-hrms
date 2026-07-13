from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    # App
    APP_NAME: str = "EastCoast HRMS"
    SECRET_KEY: str = "eastcoast-hrms-secret-change-in-production-2024"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8 hours

    # eSSL MS SQL Server
    ESSL_SERVER: str = "192.168.1.23"
    ESSL_PORT: int = 1433
    ESSL_DATABASE: str = "iclock"
    ESSL_USERNAME: str = "sa"
    ESSL_PASSWORD: str = "your_sa_password"

    # PostgreSQL (app data)
    POSTGRES_URL: str = "postgresql://hrms:hrms123@postgres:5432/hrmsdb"

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"

    class Config:
        env_file = ".env"
        extra = "ignore"

@lru_cache()
def get_settings():
    return Settings()

settings = get_settings()
