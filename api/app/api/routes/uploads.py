import re
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.session import get_db
from app.models import MediaAsset
from app.schemas.upload import (
    CompleteUploadRequest,
    CreateUploadRequest,
    CreateUploadResponse,
    MediaAssetResponse,
)
from app.services.r2_storage import (
    create_presigned_upload_url,
    delete_r2_object,
    get_object_metadata,
)
from app.services.service_access import require_workspace_service
from app.services.workspace_access import get_user_workspace


router = APIRouter(
    prefix="/uploads",
    tags=["Uploads"],
)


MAX_FILE_SIZE = 15 * 1024 * 1024


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


def asset_response(
    asset: MediaAsset,
) -> MediaAssetResponse:
    return MediaAssetResponse(
        id=str(asset.id),
        object_key=asset.object_key,
        public_url=asset.public_url,
        filename=asset.original_filename,
        content_type=asset.content_type,
        size_bytes=asset.size_bytes,
        purpose=asset.purpose,
    )


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

    if payload.file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image must be smaller than 15 MB.",
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

    return create_presigned_upload_url(
        object_key=object_key,
        content_type=payload.content_type,
    )


@router.post(
    "/complete",
    response_model=MediaAssetResponse,
    status_code=status.HTTP_201_CREATED,
)
def complete_upload(
    payload: CompleteUploadRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    workspace, _ = get_user_workspace(
        current_user["id"],
        db,
    )

    require_workspace_service(
        workspace.id,
        "WEBSITE",
        db,
    )

    if payload.purpose not in ALLOWED_PURPOSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid upload purpose.",
        )

    if payload.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported image type.",
        )

    expected_prefix = (
        f"workspaces/"
        f"{workspace.id}/"
        f"website/"
        f"{payload.purpose}/"
    )

    if not payload.object_key.startswith(
        expected_prefix
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid media object.",
        )

    existing_asset = db.scalar(
        select(MediaAsset).where(
            MediaAsset.object_key
            == payload.object_key
        )
    )

    if existing_asset:
        if (
            existing_asset.workspace_id
            != workspace.id
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Media asset does not belong to this workspace.",
            )

        return asset_response(
            existing_asset
        )

    try:
        metadata = get_object_metadata(
            payload.object_key
        )

    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Uploaded object could not be verified."
            ),
        ) from exc

    actual_size = int(
        metadata.get(
            "ContentLength",
            0,
        )
    )

    actual_content_type = (
        metadata.get(
            "ContentType"
        )
        or payload.content_type
    )

    if actual_size <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    if actual_size > MAX_FILE_SIZE:
        try:
            delete_r2_object(
                payload.object_key
            )
        finally:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded image exceeds the 15 MB limit.",
            )

    if (
        actual_content_type
        not in ALLOWED_CONTENT_TYPES
    ):
        try:
            delete_r2_object(
                payload.object_key
            )
        finally:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file type is not supported.",
            )

    public_base = (
        payload.object_key
    )

    from app.core.config import settings

    if not settings.r2_public_url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="R2 public URL is not configured.",
        )

    public_url = (
        f"{settings.r2_public_url.rstrip('/')}/"
        f"{public_base}"
    )

    asset = MediaAsset(
        workspace_id=workspace.id,
        object_key=payload.object_key,
        public_url=public_url,
        original_filename=payload.filename,
        content_type=actual_content_type,
        size_bytes=actual_size,
        purpose=payload.purpose,
        status="ACTIVE",
    )

    db.add(asset)
    db.commit()
    db.refresh(asset)

    return asset_response(asset)


@router.delete(
    "/assets/{asset_id}",
)
def delete_media_asset(
    asset_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    workspace, _ = get_user_workspace(
        current_user["id"],
        db,
    )

    try:
        parsed_asset_id = uuid.UUID(
            asset_id
        )

    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid media asset ID.",
        )

    asset = db.scalar(
        select(MediaAsset).where(
            MediaAsset.id
            == parsed_asset_id,
            MediaAsset.workspace_id
            == workspace.id,
        )
    )

    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Media asset not found.",
        )

    if asset.status == "DELETED":
        return {
            "ok": True,
        }

    try:
        delete_r2_object(
            asset.object_key
        )

    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to delete object from storage.",
        ) from exc

    asset.status = "DELETED"
    asset.deleted_at = datetime.now(
        timezone.utc
    )

    db.commit()

    return {
        "ok": True,
    }


@router.get(
    "/usage",
)
def get_storage_usage(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    workspace, _ = get_user_workspace(
        current_user["id"],
        db,
    )

    total_bytes = db.scalar(
        select(
            func.coalesce(
                func.sum(
                    MediaAsset.size_bytes
                ),
                0,
            )
        ).where(
            MediaAsset.workspace_id
            == workspace.id,
            MediaAsset.status
            == "ACTIVE",
        )
    )

    total_files = db.scalar(
        select(
            func.count(
                MediaAsset.id
            )
        ).where(
            MediaAsset.workspace_id
            == workspace.id,
            MediaAsset.status
            == "ACTIVE",
        )
    )

    total_bytes = int(
        total_bytes or 0
    )

    return {
        "workspace_id": str(
            workspace.id
        ),
        "files": int(
            total_files or 0
        ),
        "bytes": total_bytes,
        "megabytes": round(
            total_bytes
            / 1024
            / 1024,
            2,
        ),
        "gigabytes": round(
            total_bytes
            / 1024
            / 1024
            / 1024,
            3,
        ),
    }