import uuid

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)

from sqlalchemy import (
    select,
)

from sqlalchemy.orm import (
    Session,
)

from app.core.auth import (
    get_current_user,
)

from app.db.session import (
    get_db,
)

from app.models import (
    EventPhoto,
)

from app.services.private_storage import (
    PrivateStorageError,
    generate_private_view_url,
)

from app.services.service_access import (
    require_workspace_service,
)

from app.services.workspace_access import (
    get_user_workspace,
)


router = APIRouter(
    prefix="/event-sales/events",
    tags=["Event Photo Previews"],
)


PREVIEW_URL_EXPIRES_SECONDS = (
    600
)


def parse_uuid(
    value: str,
    label: str,
) -> uuid.UUID:
    try:
        return uuid.UUID(
            value
        )

    except ValueError:
        raise HTTPException(
            status_code=
                status.HTTP_400_BAD_REQUEST,
            detail=
                f"Invalid {label} ID.",
        )


def get_workspace(
    current_user: dict,
    db: Session,
):
    workspace, membership = (
        get_user_workspace(
            current_user["id"],
            db,
        )
    )

    require_workspace_service(
        workspace.id,
        "EVENT_SALES",
        db,
    )

    return (
        workspace,
        membership,
    )


@router.get(
    "/{event_id}/photos/{photo_id}/preview"
)
def get_event_photo_preview(
    event_id: str,
    photo_id: str,

    current_user: dict = Depends(
        get_current_user
    ),

    db: Session = Depends(
        get_db
    ),
):
    workspace, _ = get_workspace(
        current_user,
        db,
    )

    parsed_event_id = parse_uuid(
        event_id,
        "event",
    )

    parsed_photo_id = parse_uuid(
        photo_id,
        "photo",
    )

    photo = db.scalar(
        select(
            EventPhoto
        ).where(
            EventPhoto.id
            == parsed_photo_id,

            EventPhoto.event_id
            == parsed_event_id,

            EventPhoto.workspace_id
            == workspace.id,

            EventPhoto.deleted_at
            .is_(
                None
            ),
        )
    )

    if not photo:
        raise HTTPException(
            status_code=
                status.HTTP_404_NOT_FOUND,
            detail=
                "Event photo not found.",
        )

    if (
        photo.status
        != "READY"
        or not photo.preview_object_key
    ):
        raise HTTPException(
            status_code=
                status.HTTP_409_CONFLICT,
            detail=(
                "A protected preview is "
                "not ready for this photo."
            ),
        )

    try:
        preview_url = (
            generate_private_view_url(
                object_key=
                    photo.preview_object_key,
                expires_seconds=
                    PREVIEW_URL_EXPIRES_SECONDS,
            )
        )

    except PrivateStorageError as exc:
        raise HTTPException(
            status_code=
                status.HTTP_502_BAD_GATEWAY,
            detail=(
                "Unable to create a secure "
                "preview link."
            ),
        ) from exc

    return {
        "photo_id":
            str(photo.id),

        "event_id":
            str(photo.event_id),

        "filename":
            photo.original_filename,

        "preview_url":
            preview_url,

        "expires_in":
            PREVIEW_URL_EXPIRES_SECONDS,
    }