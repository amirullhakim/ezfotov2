import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models import MediaAsset
from app.services.r2_storage import delete_r2_object


def get_workspace_media_asset(
    db: Session,
    asset_id: uuid.UUID | None,
    workspace_id: uuid.UUID,
) -> MediaAsset | None:
    if asset_id is None:
        return None

    asset = db.get(
        MediaAsset,
        asset_id,
    )

    if not asset:
        return None

    if asset.workspace_id != workspace_id:
        return None

    if asset.status != "ACTIVE":
        return None

    return asset


def delete_media_asset(
    db: Session,
    asset: MediaAsset,
) -> None:
    if asset.status == "DELETED":
        return

    delete_r2_object(
        asset.object_key
    )

    asset.status = "DELETED"

    asset.deleted_at = datetime.now(
        timezone.utc
    )