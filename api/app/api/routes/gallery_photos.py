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
    status,
)
from sqlalchemy import (
    func,
    select,
)
from sqlalchemy.orm import Session

from app.core.auth import (
    get_current_user,
)
from app.db.session import (
    get_db,
)
from app.models import (
    ClientGallery,
    GalleryPhoto,
    GalleryFavourite,
)
from app.schemas.gallery_photo import (
    GalleryPhotoCompleteRequest,
    GalleryPhotoPresignRequest,
    GalleryPhotoPresignResponse,
)
from app.services.private_storage import (
    PrivateStorageError,
    delete_private_object,
    generate_private_upload_url,
    generate_private_view_url,
    get_private_object_metadata,
)
from app.services.service_access import (
    require_workspace_service,
)
from app.services.workspace_access import (
    get_user_workspace,
)


router = APIRouter(
    prefix="/galleries",
    tags=["Client Gallery Photos"],
)


MAX_FILE_SIZE = (
    15
    * 1024
    * 1024
)


ALLOWED_CONTENT_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


# --------------------------------------------------
# ACCESS
# --------------------------------------------------


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

    return (
        workspace,
        membership,
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


def get_workspace_gallery(
    db: Session,
    workspace_id: uuid.UUID,
    gallery_id: str,
) -> ClientGallery:
    parsed_gallery_id = (
        parse_uuid(
            gallery_id,
            "gallery",
        )
    )

    gallery = db.scalar(
        select(
            ClientGallery
        ).where(
            ClientGallery.id
            == parsed_gallery_id,
            ClientGallery.workspace_id
            == workspace_id,
        )
    )

    if not gallery:
        raise HTTPException(
            status_code=
                status.HTTP_404_NOT_FOUND,
            detail=
                "Gallery not found.",
        )

    return gallery


# --------------------------------------------------
# HELPERS
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
                "images are supported."
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
                "Image must be smaller "
                "than 15 MB."
            ),
        )


def photo_response(
    photo: GalleryPhoto,
) -> dict:
    view_url = None

    if (
        photo.status
        == "ACTIVE"
        and photo.is_visible
    ):
        try:
            view_url = (
                generate_private_view_url(
                    photo.object_key,
                    expires_seconds=600,
                )
            )

        except PrivateStorageError:
            view_url = None


    return {
        "id":
            str(photo.id),

        "gallery_id":
            str(photo.gallery_id),

        "workspace_id":
            str(photo.workspace_id),

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

        "is_cover":
            photo.is_cover,

        "is_visible":
            photo.is_visible,

        "status":
            photo.status,

        "view_url":
            view_url,

        "view_url_expires_in":
            600
            if view_url
            else None,

        "created_at":
            photo.created_at,

        "updated_at":
            photo.updated_at,
    }


# --------------------------------------------------
# PRESIGN PRIVATE UPLOAD
# --------------------------------------------------


@router.post(
    "/{gallery_id}/uploads/presign",
    response_model=
        GalleryPhotoPresignResponse,
)
def create_gallery_upload_url(
    gallery_id: str,
    payload:
        GalleryPhotoPresignRequest,
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
        get_workspace_gallery(
            db=db,
            workspace_id=
                workspace.id,
            gallery_id=
                gallery_id,
        )
    )

    validate_upload(
        content_type=
            payload.content_type,
        file_size=
            payload.file_size,
    )

    extension = (
        ALLOWED_CONTENT_TYPES[
            payload.content_type
        ]
    )

    filename = (
        clean_filename(
            payload.filename
        )
    )

    unique_id = (
        uuid.uuid4().hex
    )

    object_key = (
        f"workspaces/"
        f"{workspace.id}/"
        f"galleries/"
        f"{gallery.id}/"
        f"originals/"
        f"{unique_id}-"
        f"{filename}"
        f"{extension}"
    )

    try:
        upload_url = (
            generate_private_upload_url(
                object_key=
                    object_key,
                content_type=
                    payload.content_type,
                expires_seconds=
                    900,
            )
        )

    except PrivateStorageError as exc:
        raise HTTPException(
            status_code=
                status.HTTP_502_BAD_GATEWAY,
            detail=(
                "Unable to prepare private "
                "photo upload."
            ),
        ) from exc


    return {
        "upload_url":
            upload_url,

        "object_key":
            object_key,

        "method":
            "PUT",

        "headers": {
            "Content-Type":
                payload.content_type,
        },
    }


# --------------------------------------------------
# COMPLETE PRIVATE UPLOAD
# --------------------------------------------------


@router.post(
    "/{gallery_id}/uploads/complete",
    status_code=
        status.HTTP_201_CREATED,
)
def complete_gallery_upload(
    gallery_id: str,
    payload:
        GalleryPhotoCompleteRequest,
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
        get_workspace_gallery(
            db=db,
            workspace_id=
                workspace.id,
            gallery_id=
                gallery_id,
        )
    )

    if (
        payload.content_type
        not in
        ALLOWED_CONTENT_TYPES
    ):
        raise HTTPException(
            status_code=
                status.HTTP_400_BAD_REQUEST,
            detail=
                "Unsupported image type.",
        )


    expected_prefix = (
        f"workspaces/"
        f"{workspace.id}/"
        f"galleries/"
        f"{gallery.id}/"
        f"originals/"
    )

    if not (
        payload.object_key.startswith(
            expected_prefix
        )
    ):
        raise HTTPException(
            status_code=
                status.HTTP_403_FORBIDDEN,
            detail=(
                "Invalid gallery photo "
                "object."
            ),
        )


    existing_photo = db.scalar(
        select(
            GalleryPhoto
        ).where(
            GalleryPhoto.object_key
            == payload.object_key
        )
    )

    if existing_photo:
        if (
            existing_photo.workspace_id
            != workspace.id
            or
            existing_photo.gallery_id
            != gallery.id
        ):
            raise HTTPException(
                status_code=
                    status.HTTP_403_FORBIDDEN,
                detail=(
                    "Photo does not belong "
                    "to this gallery."
                ),
            )

        return photo_response(
            existing_photo
        )


    try:
        metadata = (
            get_private_object_metadata(
                payload.object_key
            )
        )

    except PrivateStorageError as exc:
        raise HTTPException(
            status_code=
                status.HTTP_400_BAD_REQUEST,
            detail=(
                "Uploaded photo could not "
                "be verified."
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
            status_code=
                status.HTTP_400_BAD_REQUEST,
            detail=
                "Uploaded photo is empty.",
        )


    if (
        actual_size
        > MAX_FILE_SIZE
    ):
        try:
            delete_private_object(
                payload.object_key
            )

        finally:
            raise HTTPException(
                status_code=
                    status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Uploaded image exceeds "
                    "the 15 MB limit."
                ),
            )


    if (
        actual_content_type
        not in
        ALLOWED_CONTENT_TYPES
    ):
        try:
            delete_private_object(
                payload.object_key
            )

        finally:
            raise HTTPException(
                status_code=
                    status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Uploaded file type is "
                    "not supported."
                ),
            )


    active_count = db.scalar(
        select(
            func.count(
                GalleryPhoto.id
            )
        ).where(
            GalleryPhoto.gallery_id
            == gallery.id,
            GalleryPhoto.status
            == "ACTIVE",
        )
    )

    active_count = int(
        active_count or 0
    )


    photo = GalleryPhoto(
        workspace_id=
            workspace.id,

        gallery_id=
            gallery.id,

        object_key=
            payload.object_key,

        original_filename=
            payload.filename,

        content_type=
            actual_content_type,

        size_bytes=
            actual_size,

        width=
            payload.width,

        height=
            payload.height,

        sort_order=
            active_count,

        # First uploaded photo automatically
        # becomes the gallery cover.
        is_cover=(
            active_count == 0
        ),

        is_visible=True,

        status="ACTIVE",
    )


    db.add(
        photo
    )

    db.commit()
    db.refresh(
        photo
    )


    return photo_response(
        photo
    )


# --------------------------------------------------
# LIST GALLERY PHOTOS
# --------------------------------------------------


@router.get(
    "/{gallery_id}/photos"
)
def list_gallery_photos(
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
        get_workspace_gallery(
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
        )
        .where(
            GalleryPhoto.workspace_id
            == workspace.id,

            GalleryPhoto.gallery_id
            == gallery.id,

            GalleryPhoto.status
            == "ACTIVE",
        )
        .order_by(
            GalleryPhoto.is_cover.desc(),
            GalleryPhoto.sort_order,
            GalleryPhoto.created_at,
        )
    ).all()


    return {
        "gallery_id":
            str(gallery.id),

        "photos": [
            photo_response(
                photo
            )
            for photo
            in photos
        ],
    }


# --------------------------------------------------
# DELETE PHOTO
# --------------------------------------------------


@router.delete(
    "/{gallery_id}/photos/{photo_id}"
)
def delete_gallery_photo(
    gallery_id: str,
    photo_id: str,
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
        get_workspace_gallery(
            db=db,
            workspace_id=
                workspace.id,
            gallery_id=
                gallery_id,
        )
    )

    parsed_photo_id = (
        parse_uuid(
            photo_id,
            "photo",
        )
    )


    photo = db.scalar(
        select(
            GalleryPhoto
        ).where(
            GalleryPhoto.id
            == parsed_photo_id,

            GalleryPhoto.gallery_id
            == gallery.id,

            GalleryPhoto.workspace_id
            == workspace.id,
        )
    )


    if not photo:
        raise HTTPException(
            status_code=
                status.HTTP_404_NOT_FOUND,
            detail=
                "Gallery photo not found.",
        )


    if (
        photo.status
        == "DELETED"
    ):
        return {
            "ok": True,
        }


    was_cover = (
        photo.is_cover
    )


    try:
        delete_private_object(
            photo.object_key
        )

    except PrivateStorageError as exc:
        raise HTTPException(
            status_code=
                status.HTTP_502_BAD_GATEWAY,
            detail=(
                "Unable to delete photo "
                "from private storage."
            ),
        ) from exc


    photo.status = "DELETED"

    photo.deleted_at = (
        datetime.now(
            timezone.utc
        )
    )

    photo.is_visible = False
    photo.is_cover = False


    if was_cover:
        replacement = db.scalar(
            select(
                GalleryPhoto
            )
            .where(
                GalleryPhoto.gallery_id
                == gallery.id,

                GalleryPhoto.workspace_id
                == workspace.id,

                GalleryPhoto.id
                != photo.id,

                GalleryPhoto.status
                == "ACTIVE",
            )
            .order_by(
                GalleryPhoto.sort_order,
                GalleryPhoto.created_at,
            )
        )

        if replacement:
            replacement.is_cover = True


    db.commit()


    return {
        "ok": True,
    }

# --------------------------------------------------
# GALLERY FAVOURITES SUMMARY
# --------------------------------------------------


@router.get(
    "/{gallery_id}/favourites-summary"
)
def get_gallery_favourites_summary(
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
        get_workspace_gallery(
            db=db,
            workspace_id=
                workspace.id,
            gallery_id=
                gallery_id,
        )
    )


    favourite_rows = (
        db.execute(
            select(
                GalleryFavourite.photo_id,
                func.count(
                    GalleryFavourite.id
                ).label(
                    "favourite_count"
                ),
            )
            .join(
                GalleryPhoto,
                GalleryPhoto.id
                == GalleryFavourite.photo_id,
            )
            .where(
                GalleryFavourite.workspace_id
                == workspace.id,

                GalleryFavourite.gallery_id
                == gallery.id,

                GalleryPhoto.status
                == "ACTIVE",

                GalleryPhoto.is_visible.is_(
                    True
                ),
            )
            .group_by(
                GalleryFavourite.photo_id
            )
        )
        .mappings()
        .all()
    )


    unique_visitors = db.scalar(
        select(
            func.count(
                func.distinct(
                    GalleryFavourite.visitor_token
                )
            )
        ).where(
            GalleryFavourite.workspace_id
            == workspace.id,

            GalleryFavourite.gallery_id
            == gallery.id,
        )
    )


    total_favourites = sum(
        int(
            row[
                "favourite_count"
            ]
        )
        for row
        in favourite_rows
    )


    return {
        "gallery_id":
            str(gallery.id),

        "total_favourites":
            total_favourites,

        "favourited_photos":
            len(
                favourite_rows
            ),

        "unique_visitors":
            int(
                unique_visitors or 0
            ),

        "photos": [
            {
                "photo_id":
                    str(
                        row[
                            "photo_id"
                        ]
                    ),

                "favourite_count":
                    int(
                        row[
                            "favourite_count"
                        ]
                    ),
            }
            for row
            in favourite_rows
        ],
    }