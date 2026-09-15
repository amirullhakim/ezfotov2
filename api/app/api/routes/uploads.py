import re
import uuid
from pathlib import Path

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.session import get_db
from app.schemas.upload import (
    CreateUploadRequest,
    CreateUploadResponse,
)
from app.services.r2_storage import (
    create_presigned_upload_url,
)
from app.services.service_access import (
    require_workspace_service,
)
from app.services.workspace_access import (
    get_user_workspace,
)


router = APIRouter(
    prefix="/uploads",
    tags=["Uploads"],
)


ALLOWED_CONTENT_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


ALLOWED_PURPOSES = {
    "website-hero",
    "website-about",
    "portfolio",
    "logo",
}


def clean_filename(filename: str) -> str:
    stem = Path(filename).stem.lower()

    stem = re.sub(
        r"[^a-z0-9]+",
        "-",
        stem,
    ).strip("-")

    return stem[:60] or "image"


@router.post(
    "/presign",
    response_model=CreateUploadResponse,
)
def create_upload_url(
    payload: CreateUploadRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    workspace, _ = get_user_workspace(
        current_user["id"],
        db,
    )

    # Website media uploads require WEBSITE service.
    require_workspace_service(
        workspace.id,
        "WEBSITE",
        db,
    )

    if payload.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only JPEG, PNG and WebP images are supported.",
        )

    if payload.purpose not in ALLOWED_PURPOSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid upload purpose.",
        )

    extension = ALLOWED_CONTENT_TYPES[
        payload.content_type
    ]

    filename = clean_filename(
        payload.filename
    )

    unique_id = uuid.uuid4().hex

    object_key = (
        f"workspaces/"
        f"{workspace.id}/"
        f"website/"
        f"{payload.purpose}/"
        f"{unique_id}-{filename}"
        f"{extension}"
    )

    result = create_presigned_upload_url(
        object_key=object_key,
        content_type=payload.content_type,
    )

    if not result["public_url"]:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="R2 public URL is not configured.",
        )

    return result