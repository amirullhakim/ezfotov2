import logging
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import EventPhoto, GalleryPhoto, PhotoUploadReservation, Workspace
from app.services.private_storage import PrivateStorageError, delete_private_object
from app.services.subscription_access import require_paid_workspace_service


logger = logging.getLogger(__name__)
UPLOAD_URL_SECONDS = 900
# Allow completion for another 15 minutes after the PUT URL expires.
RESERVATION_SECONDS = 1800
CONTENT_SERVICES = {"CLIENT_GALLERY", "EVENT_SALES"}


def lock_storage_workspace(workspace_id, db: Session, *, require_active: bool = True) -> None:
    """Serialize reservations/completions with plan activation until commit.

    Call before making photo/reservation mutations. Caller verifies membership
    separately; background cleanup may also run for an inactive workspace.
    """
    workspace = db.scalar(select(Workspace).where(
        Workspace.id == workspace_id,
    ).with_for_update().execution_options(populate_existing=True))
    if workspace is None or (require_active and workspace.status != "ACTIVE"):
        raise HTTPException(403, "This workspace is not active.")
    # Requests may have loaded old entitlement values before waiting for this
    # lock. Read current service/subscription values after acquiring it.
    db.expire_all()


def get_storage_usage(workspace_id, service_code: str, db: Session) -> dict:
    """Count original photo bytes, including photos in trashed galleries.

    Generated previews and website media are outside these photo allowances.
    Expired PENDING reservations still count until object cleanup succeeds.
    """
    if service_code not in CONTENT_SERVICES:
        raise HTTPException(400, "Invalid storage service.")
    model = GalleryPhoto if service_code == "CLIENT_GALLERY" else EventPhoto
    used = int(db.scalar(select(func.coalesce(func.sum(model.size_bytes), 0)).where(
        model.workspace_id == workspace_id,
        model.status != "DELETED",
    )) or 0)
    reserved = int(db.scalar(select(func.coalesce(func.sum(PhotoUploadReservation.reserved_bytes), 0)).where(
        PhotoUploadReservation.workspace_id == workspace_id,
        PhotoUploadReservation.service_code == service_code,
        PhotoUploadReservation.status == "PENDING",
    )) or 0)
    return {"used_bytes": used, "reserved_bytes": reserved, "allocated_bytes": used + reserved}


def require_storage_capacity(workspace_id, service_code: str, db: Session, *, additional_bytes: int = 0):
    """Caller holds workspace lock for every write that uses this check."""
    if additional_bytes < 0:
        raise HTTPException(400, "Invalid upload size.")
    subscription = require_paid_workspace_service(workspace_id, service_code, db)
    usage = get_storage_usage(workspace_id, service_code, db)
    limit = subscription.storage_limit_bytes
    if limit is not None and usage["allocated_bytes"] + additional_bytes > limit:
        remaining = max(0, limit - usage["allocated_bytes"])
        raise HTTPException(
            409,
            f"Your {subscription.plan_name_snapshot} storage limit is {limit / 1_000_000_000:g} GB. "
            f"Only {remaining / 1_000_000:g} MB is available. Permanently delete unused photos or choose a larger plan in Billing.",
        )
    return subscription


def cleanup_expired_upload_reservations(workspace_id, db: Session, *, limit: int = 100) -> dict:
    """Caller holds workspace lock. Commit returned changes after cleanup.

    Do not release a reservation when R2 deletion fails. Expiry is longer than
    the PUT URL lifetime, so cleanup does not delete an ordinary active upload.
    """
    rows = db.scalars(select(PhotoUploadReservation).where(
        PhotoUploadReservation.workspace_id == workspace_id,
        PhotoUploadReservation.status == "PENDING",
        PhotoUploadReservation.expires_at <= datetime.now(timezone.utc),
    ).order_by(PhotoUploadReservation.expires_at).limit(limit)).all()
    released = failed = 0
    for row in rows:
        # Defensive recovery: never delete a registered photo, even if an old
        # deployment failed to update the reservation's completion state.
        model = GalleryPhoto if row.service_code == "CLIENT_GALLERY" else EventPhoto
        key_column = model.object_key if row.service_code == "CLIENT_GALLERY" else model.original_object_key
        photo = db.scalar(select(model).where(key_column == row.object_key))
        if photo is not None:
            if photo.workspace_id != row.workspace_id:
                logger.error("Reservation/photo workspace mismatch: %s", row.id)
                failed += 1
                continue
            row.status = "COMPLETED"
            row.completed_at = datetime.now(timezone.utc)
            db.flush()
            continue
        try:
            delete_private_object(row.object_key)
        except PrivateStorageError:
            logger.warning("Unable to clean abandoned upload reservation %s", row.id)
            failed += 1
            continue
        row.status = "RELEASED"
        released += 1
        db.flush()
    return {"released": released, "failed": failed}


def reserve_photo_uploads(workspace_id, service_code: str, resource_id, uploads: list[dict], db: Session) -> None:
    """Reserve an entire validated batch before returning any PUT URLs.

    Each item contains object_key, content_type and file_size. The route holds
    the workspace lock and commits only after all URLs have been generated.
    """
    folder = {"CLIENT_GALLERY": "galleries", "EVENT_SALES": "events"}.get(service_code)
    if folder is None or not uploads:
        raise HTTPException(400, "Invalid upload reservation.")
    expected_prefix = f"workspaces/{workspace_id}/{folder}/{resource_id}/originals/"
    keys = [item["object_key"] for item in uploads]
    if len(keys) != len(set(keys)):
        raise HTTPException(400, "Duplicate upload objects.")
    maximum = 15 * 1024 * 1024 if service_code == "CLIENT_GALLERY" else 30 * 1024 * 1024
    for item in uploads:
        if not item["object_key"].startswith(expected_prefix):
            raise HTTPException(403, "Invalid upload object.")
        if item["content_type"] not in {"image/jpeg", "image/png", "image/webp"}:
            raise HTTPException(400, "Unsupported image type.")
        if not 0 < item["file_size"] <= maximum:
            raise HTTPException(400, "Invalid photo size.")
    cleanup_expired_upload_reservations(workspace_id, db)
    require_storage_capacity(workspace_id, service_code, db, additional_bytes=sum(item["file_size"] for item in uploads))
    now = datetime.now(timezone.utc)
    for item in uploads:
        db.add(PhotoUploadReservation(
            workspace_id=workspace_id, service_code=service_code, resource_id=resource_id,
            object_key=item["object_key"], content_type=item["content_type"], reserved_bytes=item["file_size"],
            status="PENDING", created_at=now, updated_at=now,
            expires_at=now + timedelta(seconds=RESERVATION_SECONDS),
        ))
    db.flush()


def require_upload_reservation(workspace_id, service_code: str, resource_id, object_key: str, db: Session):
    row = db.scalar(select(PhotoUploadReservation).where(
        PhotoUploadReservation.workspace_id == workspace_id,
        PhotoUploadReservation.service_code == service_code,
        PhotoUploadReservation.resource_id == resource_id,
        PhotoUploadReservation.object_key == object_key,
    ))
    if row is None or row.status != "PENDING" or row.expires_at <= datetime.now(timezone.utc):
        raise HTTPException(409, "This upload reservation is missing or expired. Select the photo again to start a new upload.")
    return row


def complete_upload_reservation(reservation, actual_size: int, content_type: str, db: Session) -> None:
    """Move reserved bytes to a photo record in the same transaction.

    Caller adds the new photo before this call. Flush both changes together,
    including between items when completing a batch with autoflush disabled.
    """
    if actual_size != reservation.reserved_bytes or content_type != reservation.content_type:
        raise HTTPException(400, "The uploaded file does not match its reserved size or image type. Start a new upload.")
    with db.no_autoflush:
        require_storage_capacity(reservation.workspace_id, reservation.service_code, db)
    reservation.status = "COMPLETED"
    reservation.completed_at = datetime.now(timezone.utc)
    db.flush()


def get_workspace_storage(workspace, db: Session) -> dict:
    """Read-only storage summary for the authenticated workspace.

    Preserve usage visibility after expiry. A displayed last allowance does
    not grant upload access; write routes still enforce paid subscriptions.
    """
    from app.services.workspace_billing import get_workspace_billing

    billing = get_workspace_billing(workspace, db)
    subscriptions = {item["service_code"]: item for item in billing["subscriptions"]}
    services = []
    for code in ("CLIENT_GALLERY", "EVENT_SALES"):
        subscription = subscriptions.get(code)
        usage = get_storage_usage(workspace.id, code, db)
        limit = subscription["storage_limit_bytes"] if subscription is not None else None
        entitlement = billing["subscription_entitlements"][code]
        can_upload = bool(
            subscription is not None
            and subscription["eligible"]
            and entitlement["configured_service_status"] == "ACTIVE"
        )
        allocated = usage["allocated_bytes"]
        services.append({
            "service_code": code,
            "service_name": SERVICE_STORAGE_LABELS[code],
            "has_subscription": subscription is not None,
            "plan_name": subscription["plan_name"] if subscription is not None else None,
            "subscription_status": subscription["effective_status"] if subscription is not None else None,
            "can_upload": can_upload,
            "storage_limit_bytes": limit,
            **usage,
            "remaining_bytes": max(0, limit - allocated) if limit is not None else None,
            "over_limit_bytes": max(0, allocated - limit) if limit is not None else 0,
            "allocation_percent": allocated / limit * 100 if limit is not None and limit > 0 else None,
        })
    return {"workspace_id": str(workspace.id), "as_of": billing["as_of"], "services": services}


SERVICE_STORAGE_LABELS = {"CLIENT_GALLERY": "Client Gallery", "EVENT_SALES": "Event Sales"}