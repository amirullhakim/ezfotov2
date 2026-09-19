import re
import uuid

from datetime import (
    datetime,
    timezone,
)

from pathlib import Path

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    status,
)

from sqlalchemy import (
    func,
    select,
)

from sqlalchemy.exc import (
    IntegrityError,
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
    EventGallery,
    EventPhoto,
)

from app.schemas.event_photo import (
    EventPhotoBatchCompleteRequest,
    EventPhotoBatchPresignRequest,
    EventPhotoBatchPresignResponse,
)

from app.services.private_storage import (
    PrivateStorageError,
    delete_private_object,
    generate_private_upload_url,
    get_private_object_metadata,
)

from app.services.service_access import (
    require_workspace_service,
)

from app.services.workspace_access import (
    get_user_workspace,
)


router = APIRouter(
    prefix="/event-sales/events",
    tags=["Event Sales Photos"],
)


# --------------------------------------------------
# UPLOAD SETTINGS
# --------------------------------------------------


MAX_FILE_SIZE = (
    30
    * 1024
    * 1024
)


MAX_BATCH_SIZE = 100


UPLOAD_URL_EXPIRES_SECONDS = 900


ALLOWED_CONTENT_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


# --------------------------------------------------
# WORKSPACE / SERVICE ACCESS
# --------------------------------------------------


def get_event_sales_workspace(
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


# --------------------------------------------------
# ID HELPERS
# --------------------------------------------------


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


def get_workspace_event(
    db: Session,
    workspace_id: uuid.UUID,
    event_id: str,
) -> EventGallery:
    parsed_event_id = (
        parse_uuid(
            event_id,
            "event",
        )
    )

    event = db.scalar(
        select(
            EventGallery
        ).where(
            EventGallery.id
            == parsed_event_id,

            EventGallery.workspace_id
            == workspace_id,
        )
    )

    if not event:
        raise HTTPException(
            status_code=
                status.HTTP_404_NOT_FOUND,
            detail=
                "Event not found.",
        )

    return event


def get_workspace_event_photo(
    db: Session,
    workspace_id: uuid.UUID,
    event_id: uuid.UUID,
    photo_id: str,
) -> EventPhoto:
    parsed_photo_id = (
        parse_uuid(
            photo_id,
            "photo",
        )
    )

    photo = db.scalar(
        select(
            EventPhoto
        ).where(
            EventPhoto.id
            == parsed_photo_id,

            EventPhoto.workspace_id
            == workspace_id,

            EventPhoto.event_id
            == event_id,
        )
    )

    if not photo:
        raise HTTPException(
            status_code=
                status.HTTP_404_NOT_FOUND,
            detail=
                "Event photo not found.",
        )

    return photo


# --------------------------------------------------
# UPLOAD HELPERS
# --------------------------------------------------


def clean_filename(
    filename: str,
) -> str:
    stem = (
        Path(filename)
        .stem
        .lower()
    )

    stem = re.sub(
        r"[^a-z0-9]+",
        "-",
        stem,
    ).strip("-")

    return (
        stem[:80]
        or "photo"
    )


def validate_upload(
    content_type: str,
    file_size: int,
) -> None:
    if (
        content_type
        not in
        ALLOWED_CONTENT_TYPES
    ):
        raise HTTPException(
            status_code=
                status.HTTP_400_BAD_REQUEST,
            detail=(
                "Only JPEG, PNG and WebP "
                "event photos are supported."
            ),
        )

    if file_size <= 0:
        raise HTTPException(
            status_code=
                status.HTTP_400_BAD_REQUEST,
            detail=(
                "Photo size must be "
                "greater than zero."
            ),
        )

    if (
        file_size
        > MAX_FILE_SIZE
    ):
        raise HTTPException(
            status_code=
                status.HTTP_400_BAD_REQUEST,
            detail=(
                "Each event photo must be "
                "smaller than 30 MB."
            ),
        )


def ensure_event_accepts_uploads(
    event: EventGallery,
) -> None:
    if event.status == "CLOSED":
        raise HTTPException(
            status_code=
                status.HTTP_409_CONFLICT,
            detail=(
                "Photos cannot be uploaded "
                "to a CLOSED event."
            ),
        )


def event_photo_prefix(
    workspace_id: uuid.UUID,
    event_id: uuid.UUID,
) -> str:
    return (
        f"workspaces/"
        f"{workspace_id}/"
        f"events/"
        f"{event_id}/"
        f"originals/"
    )


def build_event_photo_key(
    workspace_id: uuid.UUID,
    event_id: uuid.UUID,
    filename: str,
    content_type: str,
) -> str:
    extension = (
        ALLOWED_CONTENT_TYPES[
            content_type
        ]
    )

    cleaned_filename = (
        clean_filename(
            filename
        )
    )

    unique_id = (
        uuid.uuid4().hex
    )

    return (
        event_photo_prefix(
            workspace_id,
            event_id,
        )
        + f"{unique_id}-"
        + f"{cleaned_filename}"
        + f"{extension}"
    )


# --------------------------------------------------
# RESPONSE
# --------------------------------------------------


def photo_response(
    photo: EventPhoto,
) -> dict:
    return {
        "id":
            str(photo.id),

        "workspace_id":
            str(photo.workspace_id),

        "event_id":
            str(photo.event_id),

        "filename":
            photo.original_filename,

        "content_type":
            photo.content_type,

        "size_bytes":
            photo.size_bytes,

        "width":
            photo.width,

        "height":
            photo.height,

        "sort_order":
            photo.sort_order,

        "is_visible":
            photo.is_visible,

        "status":
            photo.status,

        "processing_error":
            photo.processing_error,

        "preview_ready":
            (
                photo.preview_object_key
                is not None
            ),

        "processed_at":
            photo.processed_at,

        "deleted_at":
            photo.deleted_at,

        "created_at":
            photo.created_at,

        "updated_at":
            photo.updated_at,
    }


# --------------------------------------------------
# BATCH PRESIGN
# --------------------------------------------------


@router.post(
    "/{event_id}/photos/uploads/presign",
    response_model=
        EventPhotoBatchPresignResponse,
)
def create_event_upload_urls(
    event_id: str,
    payload:
        EventPhotoBatchPresignRequest,
    current_user: dict = Depends(
        get_current_user
    ),
    db: Session = Depends(
        get_db
    ),
):
    workspace, _ = (
        get_event_sales_workspace(
            current_user,
            db,
        )
    )

    event = (
        get_workspace_event(
            db=db,
            workspace_id=
                workspace.id,
            event_id=
                event_id,
        )
    )

    ensure_event_accepts_uploads(
        event
    )

    if (
        len(payload.files)
        > MAX_BATCH_SIZE
    ):
        raise HTTPException(
            status_code=
                status.HTTP_400_BAD_REQUEST,
            detail=(
                "A maximum of 100 photos "
                "can be prepared per request."
            ),
        )


    uploads = []


    for item in payload.files:
        validate_upload(
            content_type=
                item.content_type,
            file_size=
                item.file_size,
        )

        object_key = (
            build_event_photo_key(
                workspace_id=
                    workspace.id,
                event_id=
                    event.id,
                filename=
                    item.filename,
                content_type=
                    item.content_type,
            )
        )

        try:
            upload_url = (
                generate_private_upload_url(
                    object_key=
                        object_key,
                    content_type=
                        item.content_type,
                    expires_seconds=
                        UPLOAD_URL_EXPIRES_SECONDS,
                )
            )

        except PrivateStorageError as exc:
            raise HTTPException(
                status_code=
                    status.HTTP_502_BAD_GATEWAY,
                detail=(
                    "Unable to prepare "
                    "event photo upload."
                ),
            ) from exc


        uploads.append(
            {
                "filename":
                    item.filename,

                "content_type":
                    item.content_type,

                "file_size":
                    item.file_size,

                "upload_url":
                    upload_url,

                "object_key":
                    object_key,

                "method":
                    "PUT",

                "headers": {
                    "Content-Type":
                        item.content_type,
                },
            }
        )


    return {
        "event_id":
            str(event.id),

        "expires_in":
            UPLOAD_URL_EXPIRES_SECONDS,

        "uploads":
            uploads,
    }


# --------------------------------------------------
# BATCH COMPLETE
# --------------------------------------------------


@router.post(
    "/{event_id}/photos/uploads/complete",
    status_code=
        status.HTTP_201_CREATED,
)
def complete_event_uploads(
    event_id: str,
    payload:
        EventPhotoBatchCompleteRequest,
    current_user: dict = Depends(
        get_current_user
    ),
    db: Session = Depends(
        get_db
    ),
):
    workspace, _ = (
        get_event_sales_workspace(
            current_user,
            db,
        )
    )

    event = (
        get_workspace_event(
            db=db,
            workspace_id=
                workspace.id,
            event_id=
                event_id,
        )
    )

    ensure_event_accepts_uploads(
        event
    )


    if (
        len(payload.files)
        > MAX_BATCH_SIZE
    ):
        raise HTTPException(
            status_code=
                status.HTTP_400_BAD_REQUEST,
            detail=(
                "A maximum of 100 photos "
                "can be completed per request."
            ),
        )


    expected_prefix = (
        event_photo_prefix(
            workspace.id,
            event.id,
        )
    )


    # Prevent the same object from appearing twice
    # inside a single completion request.
    object_keys = [
        item.object_key
        for item
        in payload.files
    ]

    if (
        len(object_keys)
        != len(set(object_keys))
    ):
        raise HTTPException(
            status_code=
                status.HTTP_400_BAD_REQUEST,
            detail=(
                "The upload completion request "
                "contains duplicate objects."
            ),
        )


    highest_sort_order = db.scalar(
        select(
            func.max(
                EventPhoto.sort_order
            )
        ).where(
            EventPhoto.event_id
            == event.id,

            EventPhoto.workspace_id
            == workspace.id,
        )
    )

    next_sort_order = (
        int(
            highest_sort_order
        )
        + 1
        if highest_sort_order
        is not None
        else 0
    )


    completed_photos = []
    already_completed = []


    for item in payload.files:

        # --------------------------------------------------
        # OBJECT OWNERSHIP
        # --------------------------------------------------

        if not (
            item.object_key.startswith(
                expected_prefix
            )
        ):
            raise HTTPException(
                status_code=
                    status.HTTP_403_FORBIDDEN,
                detail=(
                    "Invalid event photo object."
                ),
            )


        # --------------------------------------------------
        # IDEMPOTENCY
        # --------------------------------------------------

        existing_photo = db.scalar(
            select(
                EventPhoto
            ).where(
                EventPhoto.original_object_key
                == item.object_key
            )
        )

        if existing_photo:
            if (
                existing_photo.workspace_id
                != workspace.id
                or
                existing_photo.event_id
                != event.id
            ):
                raise HTTPException(
                    status_code=
                        status.HTTP_403_FORBIDDEN,
                    detail=(
                        "Photo does not belong "
                        "to this event."
                    ),
                )

            already_completed.append(
                existing_photo
            )

            continue


        # --------------------------------------------------
        # REQUEST TYPE VALIDATION
        # --------------------------------------------------

        if (
            item.content_type
            not in
            ALLOWED_CONTENT_TYPES
        ):
            raise HTTPException(
                status_code=
                    status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Unsupported event "
                    "photo type."
                ),
            )


        # --------------------------------------------------
        # VERIFY PRIVATE R2 OBJECT
        # --------------------------------------------------

        try:
            metadata = (
                get_private_object_metadata(
                    item.object_key
                )
            )

        except PrivateStorageError as exc:
            raise HTTPException(
                status_code=
                    status.HTTP_400_BAD_REQUEST,
                detail=(
                    "An uploaded event photo "
                    "could not be verified."
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
            or item.content_type
        )


        # --------------------------------------------------
        # ACTUAL OBJECT VALIDATION
        # --------------------------------------------------

        if actual_size <= 0:
            raise HTTPException(
                status_code=
                    status.HTTP_400_BAD_REQUEST,
                detail=(
                    "An uploaded event photo "
                    "is empty."
                ),
            )


        if (
            actual_size
            > MAX_FILE_SIZE
        ):
            try:
                delete_private_object(
                    item.object_key
                )

            except PrivateStorageError:
                pass

            raise HTTPException(
                status_code=
                    status.HTTP_400_BAD_REQUEST,
                detail=(
                    "An uploaded event photo "
                    "exceeds the 30 MB limit."
                ),
            )


        if (
            actual_content_type
            not in
            ALLOWED_CONTENT_TYPES
        ):
            try:
                delete_private_object(
                    item.object_key
                )

            except PrivateStorageError:
                pass

            raise HTTPException(
                status_code=
                    status.HTTP_400_BAD_REQUEST,
                detail=(
                    "An uploaded object has "
                    "an unsupported file type."
                ),
            )


        # --------------------------------------------------
        # CREATE PHOTO RECORD
        # --------------------------------------------------

        photo = EventPhoto(
            workspace_id=
                workspace.id,

            event_id=
                event.id,

            original_object_key=
                item.object_key,

            original_filename=
                item.filename,

            content_type=
                actual_content_type,

            size_bytes=
                actual_size,

            width=
                item.width,

            height=
                item.height,

            preview_object_key=
                None,

            sort_order=
                next_sort_order,

            is_visible=
                True,

            status=
                "UPLOADED",

            processing_error=
                None,

            processed_at=
                None,

            deleted_at=
                None,
        )


        next_sort_order += 1

        db.add(
            photo
        )

        completed_photos.append(
            photo
        )


    try:
        db.commit()

    except IntegrityError as exc:
        db.rollback()

        raise HTTPException(
            status_code=
                status.HTTP_409_CONFLICT,
            detail=(
                "One or more event photos "
                "have already been registered."
            ),
        ) from exc


    for photo in completed_photos:
        db.refresh(
            photo
        )


    all_photos = (
        already_completed
        + completed_photos
    )


    return {
        "ok":
            True,

        "event_id":
            str(event.id),

        "completed_count":
            len(
                completed_photos
            ),

        "already_completed_count":
            len(
                already_completed
            ),

        "photos": [
            photo_response(
                photo
            )
            for photo
            in all_photos
        ],
    }


# --------------------------------------------------
# LIST EVENT PHOTOS
# --------------------------------------------------


@router.get(
    "/{event_id}/photos"
)
def list_event_photos(
    event_id: str,

    limit: int = Query(
        default=50,
        ge=1,
        le=100,
    ),

    offset: int = Query(
        default=0,
        ge=0,
    ),

    current_user: dict = Depends(
        get_current_user
    ),

    db: Session = Depends(
        get_db
    ),
):
    workspace, _ = (
        get_event_sales_workspace(
            current_user,
            db,
        )
    )

    event = (
        get_workspace_event(
            db=db,
            workspace_id=
                workspace.id,
            event_id=
                event_id,
        )
    )


    total = db.scalar(
        select(
            func.count(
                EventPhoto.id
            )
        ).where(
            EventPhoto.workspace_id
            == workspace.id,

            EventPhoto.event_id
            == event.id,

            EventPhoto.status
            != "DELETED",
        )
    )

    total = int(
        total or 0
    )


    photos = db.scalars(
        select(
            EventPhoto
        )
        .where(
            EventPhoto.workspace_id
            == workspace.id,

            EventPhoto.event_id
            == event.id,

            EventPhoto.status
            != "DELETED",
        )
        .order_by(
            EventPhoto.sort_order,
            EventPhoto.created_at,
        )
        .offset(
            offset
        )
        .limit(
            limit
        )
    ).all()


    status_counts = dict(
        db.execute(
            select(
                EventPhoto.status,
                func.count(
                    EventPhoto.id
                ),
            )
            .where(
                EventPhoto.workspace_id
                == workspace.id,

                EventPhoto.event_id
                == event.id,

                EventPhoto.status
                != "DELETED",
            )
            .group_by(
                EventPhoto.status
            )
        ).all()
    )


    storage_bytes = db.scalar(
        select(
            func.coalesce(
                func.sum(
                    EventPhoto.size_bytes
                ),
                0,
            )
        ).where(
            EventPhoto.workspace_id
            == workspace.id,

            EventPhoto.event_id
            == event.id,

            EventPhoto.status
            != "DELETED",
        )
    )


    return {
        "event_id":
            str(event.id),

        "total":
            total,

        "limit":
            limit,

        "offset":
            offset,

        "has_more":
            (
                offset
                + len(photos)
                < total
            ),

        "storage_bytes":
            int(
                storage_bytes
                or 0
            ),

        "status_counts": {
            str(key):
                int(value)
            for key, value
            in status_counts.items()
        },

        "photos": [
            photo_response(
                photo
            )
            for photo
            in photos
        ],
    }


# --------------------------------------------------
# DELETE EVENT PHOTO
# --------------------------------------------------


@router.delete(
    "/{event_id}/photos/{photo_id}"
)
def delete_event_photo(
    event_id: str,
    photo_id: str,
    current_user: dict = Depends(
        get_current_user
    ),
    db: Session = Depends(
        get_db
    ),
):
    workspace, _ = (
        get_event_sales_workspace(
            current_user,
            db,
        )
    )

    event = (
        get_workspace_event(
            db=db,
            workspace_id=
                workspace.id,
            event_id=
                event_id,
        )
    )

    photo = (
        get_workspace_event_photo(
            db=db,
            workspace_id=
                workspace.id,
            event_id=
                event.id,
            photo_id=
                photo_id,
        )
    )


    if (
        photo.status
        == "DELETED"
    ):
        return {
            "ok":
                True,

            "photo_id":
                str(photo.id),
        }


    # --------------------------------------------------
    # DELETE PRIVATE ORIGINAL
    # --------------------------------------------------

    try:
        delete_private_object(
            photo.original_object_key
        )

    except PrivateStorageError as exc:
        raise HTTPException(
            status_code=
                status.HTTP_502_BAD_GATEWAY,
            detail=(
                "Unable to delete the "
                "original event photo "
                "from private storage."
            ),
        ) from exc


    # --------------------------------------------------
    # DELETE PREVIEW IF IT EXISTS
    # --------------------------------------------------

    if photo.preview_object_key:
        try:
            delete_private_object(
                photo.preview_object_key
            )

        except PrivateStorageError as exc:
            raise HTTPException(
                status_code=
                    status.HTTP_502_BAD_GATEWAY,
                detail=(
                    "Original photo was removed, "
                    "but its preview could not "
                    "be removed. Retry deletion."
                ),
            ) from exc


    photo.status = (
        "DELETED"
    )

    photo.deleted_at = (
        datetime.now(
            timezone.utc
        )
    )

    photo.is_visible = (
        False
    )

    photo.processing_error = (
        None
    )


    db.commit()

    db.refresh(
        photo
    )


    return {
        "ok":
            True,

        "photo_id":
            str(photo.id),

        "status":
            photo.status,
    }