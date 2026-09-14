from fastapi import APIRouter
from sqlalchemy import text

from app.core.config import settings
from app.db.session import engine


router = APIRouter(
    prefix="/health",
    tags=["Health"],
)


@router.get("")
def health_check():
    database_status = "disconnected"

    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))

        database_status = "connected"

    except Exception:
        database_status = "error"

    return {
        "ok": database_status == "connected",
        "service": settings.app_name,
        "version": settings.app_version,
        "environment": settings.app_environment,
        "database": database_status,
    }