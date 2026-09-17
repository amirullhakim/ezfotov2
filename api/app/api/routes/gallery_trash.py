import uuid
from datetime import datetime, timedelta, timezone

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.session import get_db
from app.models import (
    ClientGallery,
    GalleryPhoto,
)
from app.services.private_storage import (
    PrivateStorageError,
    delete_private_object,
)
from app.services.service_access import (
    require_workspace_service,
)
from app.services.workspace_access import (
    get_user_workspace,
)


router = APIRouter(
    prefix="/galleries/trash",
    tags=["Client Gallery Trash"],
)


TRASH_RETENTION_DAYS = 30


# --------------------------------------------------
# HELPERS
# --------------------------------------------------


def utc_now() -> datetime:
    return datetime.now(
        timezone.utc
    )


def get_gallery_workspace(
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
        "CLIENT_GALLERY",
        db,
    )


    return workspace, membership


def parse_gallery_id(
    gallery_id: str,
) -> uuid.UUID:
    try:
        return uuid.UUID(
            gallery_id
        )

    except ValueError:
        raise HTTPException(
            status_code=
                status.HTTP_400_BAD_REQUEST,

            detail=
                "Invalid gallery ID.",
        )


def get_trashed_gallery(
    db: Session,
    workspace_id: uuid.UUID,
    gallery_id: str,
) -> ClientGallery:
    parsed_id = parse_gallery_id(
        gallery_id
    )


    gallery = db.scalar(
        select(
            ClientGallery
        ).where(
            ClientGallery.id
            == parsed_id,

            ClientGallery.workspace_id
            == workspace_id,

            ClientGallery.deleted_at.is_not(
                None
            ),
        )
    )


    if not gallery:
        raise HTTPException(
            status_code=
                status.HTTP_404_NOT_FOUND,

            detail=
                "Trashed gallery not found.",
        )


    return gallery


def recovery_deadline(
    gallery: ClientGallery,
) -> datetime:
    deleted_at = (
        gallery.deleted_at
    )


    if deleted_at is None:
        raise HTTPException(
            status_code=
                status.HTTP_400_BAD_REQUEST,

            detail=
                "Gallery is not in Trash.",
        )


    if (
        deleted_at.tzinfo
        is None
    ):
        deleted_at = (
            deleted_at.replace(
                tzinfo=timezone.utc
            )
        )


    return (
        deleted_at
        + timedelta(
            days=
                TRASH_RETENTION_DAYS
        )
    )


def get_photo_count(
    db: Session,
    gallery_id: uuid.UUID,
) -> int:
    value = db.scalar(
        select(
            func.count(
                GalleryPhoto.id
            )
        ).where(
            GalleryPhoto.gallery_id
            == gallery_id,

            GalleryPhoto.status
            != "DELETED",
        )
    )


    return int(
        value or 0
    )


def get_storage_size(
    db: Session,
    gallery_id: uuid.UUID,
) -> int:
    value = db.scalar(
        select(
            func.sum(
                GalleryPhoto.size_bytes
            )
        ).where(
            GalleryPhoto.gallery_id
            == gallery_id,

            GalleryPhoto.status
            != "DELETED",
        )
    )


    return int(
        value or 0
    )


def trash_response(
    db: Session,
    gallery: ClientGallery,
) -> dict:
    deadline = (
        recovery_deadline(
            gallery
        )
    )


    return {
        "id":
            str(gallery.id),

        "title":
            gallery.title,

        "slug":
            gallery.slug,

        "client_name":
            gallery.client_name,

        "privacy_mode":
            gallery.privacy_mode,

        "was_published":
            gallery.is_published,

        "photo_count":
            get_photo_count(
                db,
                gallery.id,
            ),

        "storage_bytes":
            get_storage_size(
                db,
                gallery.id,
            ),

        "deleted_at":
            gallery.deleted_at,

        "recoverable_until":
            deadline,

        "recovery_available":
            utc_now()
            <= deadline,
    }


# --------------------------------------------------
# LIST TRASH
# --------------------------------------------------


@router.get(
    "/items"
)
def list_trashed_galleries(
    current_user: dict = Depends(
        get_current_user
    ),

    db: Session = Depends(
        get_db
    ),
):
    workspace, _ = (
        get_gallery_workspace(
            current_user,
            db,
        )
    )


    galleries = db.scalars(
        select(
            ClientGallery
        )
        .where(
            ClientGallery.workspace_id
            == workspace.id,

            ClientGallery.deleted_at.is_not(
                None
            ),
        )
        .order_by(
            ClientGallery.deleted_at.desc()
        )
    ).all()


    return {
        "retention_days":
            TRASH_RETENTION_DAYS,

        "galleries": [
            trash_response(
                db,
                gallery,
            )
            for gallery
            in galleries
        ],
    }


# --------------------------------------------------
# RESTORE GALLERY
# --------------------------------------------------


@router.post(
    "/{gallery_id}/restore"
)
def restore_gallery(
    gallery_id: str,

    current_user: dict = Depends(
        get_current_user
    ),

    db: Session = Depends(
        get_db
    ),
):
    workspace, _ = (
        get_gallery_workspace(
            current_user,
            db,
        )
    )


    gallery = (
        get_trashed_gallery(
            db=db,

            workspace_id=
                workspace.id,

            gallery_id=
                gallery_id,
        )
    )


    deadline = (
        recovery_deadline(
            gallery
        )
    )


    if (
        utc_now()
        > deadline
    ):
        raise HTTPException(
            status_code=
                status.HTTP_410_GONE,

            detail=(
                "This gallery's recovery "
                "period has expired."
            ),
        )


    gallery.deleted_at = None


    db.commit()

    db.refresh(
        gallery
    )


    return {
        "ok":
            True,

        "restored":
            True,

        "gallery_id":
            str(gallery.id),

        "title":
            gallery.title,

        "slug":
            gallery.slug,

        "is_published":
            gallery.is_published,
    }


# --------------------------------------------------
# PERMANENT DELETE
# --------------------------------------------------


@router.delete(
    "/{gallery_id}/permanent"
)
def permanently_delete_gallery(
    gallery_id: str,

    current_user: dict = Depends(
        get_current_user
    ),

    db: Session = Depends(
        get_db
    ),
):
    workspace, _ = (
        get_gallery_workspace(
            current_user,
            db,
        )
    )


    gallery = (
        get_trashed_gallery(
            db=db,

            workspace_id=
                workspace.id,

            gallery_id=
                gallery_id,
        )
    )


    photos = db.scalars(
        select(
            GalleryPhoto
        ).where(
            GalleryPhoto.gallery_id
            == gallery.id,

            GalleryPhoto.workspace_id
            == workspace.id,

            GalleryPhoto.status
            != "DELETED",
        )
    ).all()


    # Delete private R2 objects first.
    #
    # If storage cleanup fails, keep the
    # database rows so permanent deletion
    # can be retried safely.
    try:
        for photo in photos:
            delete_private_object(
                photo.object_key
            )

    except PrivateStorageError as exc:
        raise HTTPException(
            status_code=
                status.HTTP_502_BAD_GATEWAY,

            detail=(
                "Gallery could not be "
                "permanently deleted because "
                "private storage cleanup failed."
            ),
        ) from exc


    db.delete(
        gallery
    )


    db.commit()


    return {
        "ok":
            True,

        "permanently_deleted":
            True,

        "deleted_photos":
            len(photos),
    }