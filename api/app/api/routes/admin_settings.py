from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy.orm import Session

from app.core.auth import require_platform_admin
from app.db.session import get_db
from app.models import Profile

router = APIRouter(prefix="/admin/settings", tags=["Platform Admin Settings"])


class AdminProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    full_name: str = Field(min_length=2, max_length=255)

    @field_validator("full_name", mode="before")
    @classmethod
    def clean_name(cls, value):
        return " ".join(value.split()) if isinstance(value, str) else value


def _profile_payload(profile: Profile) -> dict:
    return {
        "full_name": profile.full_name or "",
        "email": profile.email or "",
        "role": "SUPER_ADMIN",
    }


@router.get("")
def get_admin_settings(
    response: Response,
    admin: Profile = Depends(require_platform_admin),
):
    response.headers["Cache-Control"] = "no-store"
    return _profile_payload(admin)


@router.patch("/profile")
def update_admin_profile(
    payload: AdminProfileUpdate,
    response: Response,
    admin: Profile = Depends(require_platform_admin),
    db: Session = Depends(get_db),
):
    try:
        admin.full_name = payload.full_name
        db.commit()
        db.refresh(admin)
    except Exception:
        db.rollback()
        raise
    response.headers["Cache-Control"] = "no-store"
    return _profile_payload(admin)