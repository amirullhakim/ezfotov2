import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.session import get_db
from app.models import Profile


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


@router.get("/me")
def get_me(
    response: Response,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    response.headers["Cache-Control"] = "private, no-store"

    try:
        user_id = uuid.UUID(current_user["id"])
    except (KeyError, ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authenticated user.",
        )

    profile = db.get(Profile, user_id)

    if profile is not None and not profile.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive.",
        )

    return {
        "id": current_user.get("id"),
        "email": current_user.get("email"),
        "user_metadata": current_user.get("user_metadata", {}),
        "is_platform_admin": bool(
            profile is not None and profile.is_platform_admin
        ),
    }