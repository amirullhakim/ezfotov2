from fastapi import APIRouter, Response, status
from sqlalchemy import text

from app.core.config import settings
from app.db.session import engine


router = APIRouter(
    prefix="/health",
    tags=["Health"],
)


@router.get("")
def health_check(response: Response):
    response.headers["Cache-Control"] = "no-store"

    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))

        database_status = "connected"

    except Exception:
        database_status = "error"
        response.status_code = (
            status.HTTP_503_SERVICE_UNAVAILABLE
        )

    return {
        "ok": database_status == "connected",
        "service": settings.app_name,
        "version": settings.app_version,
        "environment": settings.app_environment,
        "database": database_status,
    }