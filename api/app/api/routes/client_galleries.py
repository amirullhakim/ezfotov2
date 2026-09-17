import re
import unicodedata
import uuid
from datetime import datetime

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
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.session import get_db
from app.models import (
    ClientGallery,
    GalleryPhoto,
)
from app.schemas.client_gallery import (
    ClientGalleryCreate,
    ClientGalleryUpdate,
)
from app.services.gallery_security import (
    generate_private_gallery_token,
    hash_gallery_password,
    hash_private_gallery_token,
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
    prefix="/galleries",
    tags=["Client Galleries"],
)


# --------------------------------------------------
# WORKSPACE / SERVICE ACCESS
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

    return workspace, membership


# --------------------------------------------------
# HELPERS
# --------------------------------------------------


def normalize_gallery_slug(
    value: str,
) -> str:
    normalized = unicodedata.normalize(
        "NFKD",
        value,
    )

    normalized = normalized.encode(
        "ascii",
        "ignore",
    ).decode("ascii")

    normalized = normalized.lower()

    normalized = re.sub(
        r"[^a-z0-9]+",
        "-",
        normalized,
    )

    normalized = normalized.strip("-")

    if len(normalized) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Gallery address must contain "
                "at least 3 characters."
            ),
        )

    if len(normalized) > 120:
        normalized = normalized[:120].rstrip(
            "-"
        )

    return normalized


def parse_gallery_id(
    gallery_id: str,
) -> uuid.UUID:
    try:
        return uuid.UUID(
            gallery_id
        )

    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid gallery ID.",
        )


def get_workspace_gallery(
    db: Session,
    workspace_id: uuid.UUID,
    gallery_id: str,
) -> ClientGallery:
    parsed_id = parse_gallery_id(
        gallery_id
    )

    gallery = db.scalar(
        select(ClientGallery).where(
            ClientGallery.id
            == parsed_id,
            ClientGallery.workspace_id
            == workspace_id,
        )
    )

    if not gallery:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gallery not found.",
        )

    return gallery


def ensure_slug_available(
    db: Session,
    workspace_id: uuid.UUID,
    slug: str,
    exclude_gallery_id: uuid.UUID | None = None,
) -> None:
    query = select(
        ClientGallery
    ).where(
        ClientGallery.workspace_id
        == workspace_id,
        ClientGallery.slug
        == slug,
    )

    if exclude_gallery_id:
        query = query.where(
            ClientGallery.id
            != exclude_gallery_id
        )

    existing = db.scalar(
        query
    )

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "This gallery address "
                "is already in use."
            ),
        )


def validate_expiry(
    value: datetime | None,
) -> None:
    if (
        value is not None
        and value.tzinfo is None
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Gallery expiry date must "
                "include a timezone."
            ),
        )


def get_photo_count(
    db: Session,
    gallery_id: uuid.UUID,
) -> int:
    count = db.scalar(
        select(
            func.count(
                GalleryPhoto.id
            )
        ).where(
            GalleryPhoto.gallery_id
            == gallery_id,
            GalleryPhoto.status
            == "ACTIVE",
        )
    )

    return int(
        count or 0
    )


def gallery_response(
    db: Session,
    gallery: ClientGallery,
    share_token: str | None = None,
) -> dict:
    return {
        "id": str(
            gallery.id
        ),
        "workspace_id": str(
            gallery.workspace_id
        ),
        "title":
            gallery.title,
        "slug":
            gallery.slug,
        "client_name":
            gallery.client_name,
        "description":
            gallery.description,
        "shoot_date":
            gallery.shoot_date,
        "privacy_mode":
            gallery.privacy_mode,
        "password_configured":
            gallery.password_hash
            is not None,
        "private_link_configured":
            gallery.access_token_hash
            is not None,
        "allow_downloads":
            gallery.allow_downloads,
        "allow_favourites":
            gallery.allow_favourites,
        "is_published":
            gallery.is_published,
        "expires_at":
            gallery.expires_at,
        "photo_count":
            get_photo_count(
                db,
                gallery.id,
            ),
        "share_token":
            share_token,
        "created_at":
            gallery.created_at,
        "updated_at":
            gallery.updated_at,
    }


# --------------------------------------------------
# LIST GALLERIES
# --------------------------------------------------


@router.get("")
def list_galleries(
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
        select(ClientGallery)
        .where(
            ClientGallery.workspace_id
            == workspace.id
        )
        .order_by(
            ClientGallery.created_at.desc()
        )
    ).all()

    return {
        "galleries": [
            gallery_response(
                db,
                gallery,
            )
            for gallery in galleries
        ],
    }


# --------------------------------------------------
# CREATE GALLERY
# --------------------------------------------------


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
)
def create_gallery(
    payload: ClientGalleryCreate,
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

    source_slug = (
        payload.slug
        if payload.slug
        else payload.title
    )

    slug = normalize_gallery_slug(
        source_slug
    )

    ensure_slug_available(
        db=db,
        workspace_id=workspace.id,
        slug=slug,
    )

    validate_expiry(
        payload.expires_at
    )

    password_hash = None
    access_token_hash = None
    share_token = None


    if (
        payload.privacy_mode
        == "PASSWORD"
    ):
        if not payload.password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "A gallery password is required "
                    "for PASSWORD privacy."
                ),
            )

        password_hash = (
            hash_gallery_password(
                payload.password
            )
        )


    elif (
        payload.privacy_mode
        == "PRIVATE"
    ):
        share_token = (
            generate_private_gallery_token()
        )

        access_token_hash = (
            hash_private_gallery_token(
                share_token
            )
        )


    gallery = ClientGallery(
        workspace_id=
            workspace.id,
        title=
            payload.title.strip(),
        slug=
            slug,
        client_name=(
            payload.client_name.strip()
            if payload.client_name
            else None
        ),
        description=
            payload.description,
        shoot_date=
            payload.shoot_date,
        privacy_mode=
            payload.privacy_mode,
        password_hash=
            password_hash,
        access_token_hash=
            access_token_hash,
        allow_downloads=
            payload.allow_downloads,
        allow_favourites=
            payload.allow_favourites,
        is_published=
            payload.is_published,
        expires_at=
            payload.expires_at,
    )

    db.add(
        gallery
    )

    try:
        db.commit()
        db.refresh(
            gallery
        )

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Gallery could not be created "
                "because its address already exists."
            ),
        )


    return gallery_response(
        db,
        gallery,
        share_token=share_token,
    )


# --------------------------------------------------
# GET SINGLE GALLERY
# --------------------------------------------------


@router.get(
    "/{gallery_id}"
)
def get_gallery(
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

    return gallery_response(
        db,
        gallery,
    )


# --------------------------------------------------
# UPDATE GALLERY
# --------------------------------------------------


@router.patch(
    "/{gallery_id}"
)
def update_gallery(
    gallery_id: str,
    payload: ClientGalleryUpdate,
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

    values = payload.model_dump(
        exclude_unset=True
    )


    # --------------------------------------------------
    # BASIC FIELDS
    # --------------------------------------------------

    if "title" in values:
        if values["title"] is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Gallery title cannot "
                    "be empty."
                ),
            )

        gallery.title = (
            values["title"].strip()
        )


    if "slug" in values:
        if not values["slug"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Gallery address cannot "
                    "be empty."
                ),
            )

        new_slug = (
            normalize_gallery_slug(
                values["slug"]
            )
        )

        ensure_slug_available(
            db=db,
            workspace_id=
                workspace.id,
            slug=
                new_slug,
            exclude_gallery_id=
                gallery.id,
        )

        gallery.slug = (
            new_slug
        )


    if "client_name" in values:
        client_name = (
            values[
                "client_name"
            ]
        )

        gallery.client_name = (
            client_name.strip()
            if client_name
            else None
        )


    if "description" in values:
        gallery.description = (
            values["description"]
        )


    if "shoot_date" in values:
        gallery.shoot_date = (
            values["shoot_date"]
        )


    if "allow_downloads" in values:
        if (
            values[
                "allow_downloads"
            ]
            is None
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "allow_downloads "
                    "cannot be null."
                ),
            )

        gallery.allow_downloads = (
            values[
                "allow_downloads"
            ]
        )


    if "allow_favourites" in values:
        if (
            values[
                "allow_favourites"
            ]
            is None
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "allow_favourites "
                    "cannot be null."
                ),
            )

        gallery.allow_favourites = (
            values[
                "allow_favourites"
            ]
        )


    if "is_published" in values:
        if (
            values[
                "is_published"
            ]
            is None
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "is_published "
                    "cannot be null."
                ),
            )

        gallery.is_published = (
            values[
                "is_published"
            ]
        )


    if "expires_at" in values:
        validate_expiry(
            values["expires_at"]
        )

        gallery.expires_at = (
            values["expires_at"]
        )


    # --------------------------------------------------
    # PRIVACY
    # --------------------------------------------------

    requested_mode = (
        values.get(
            "privacy_mode"
        )
        or gallery.privacy_mode
    )

    raw_password = (
        values.get(
            "password"
        )
    )

    regenerate_private_link = (
        values.get(
            "regenerate_private_link",
            False,
        )
    )

    share_token = None


    if (
        requested_mode
        == "PASSWORD"
    ):
        if raw_password:
            gallery.password_hash = (
                hash_gallery_password(
                    raw_password
                )
            )

        elif (
            gallery.password_hash
            is None
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "A gallery password is required "
                    "for PASSWORD privacy."
                ),
            )

        gallery.access_token_hash = (
            None
        )


    elif (
        requested_mode
        == "PRIVATE"
    ):
        gallery.password_hash = (
            None
        )

        should_generate_token = (
            gallery.privacy_mode
            != "PRIVATE"
            or gallery.access_token_hash
            is None
            or regenerate_private_link
        )

        if should_generate_token:
            share_token = (
                generate_private_gallery_token()
            )

            gallery.access_token_hash = (
                hash_private_gallery_token(
                    share_token
                )
            )


    else:
        # PUBLIC
        gallery.password_hash = (
            None
        )

        gallery.access_token_hash = (
            None
        )


    gallery.privacy_mode = (
        requested_mode
    )


    try:
        db.commit()
        db.refresh(
            gallery
        )

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Gallery could not be updated "
                "because its address already exists."
            ),
        )


    return gallery_response(
        db,
        gallery,
        share_token=share_token,
    )


# --------------------------------------------------
# DELETE GALLERY
# --------------------------------------------------


@router.delete(
    "/{gallery_id}"
)
def delete_gallery(
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
        select(GalleryPhoto).where(
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
    # If storage fails, keep the database rows
    # so we can safely retry instead of creating
    # forgotten private files.
    try:
        for photo in photos:
            delete_private_object(
                photo.object_key
            )

    except PrivateStorageError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                "Gallery could not be deleted "
                "because private storage cleanup failed."
            ),
        ) from exc


    db.delete(
        gallery
    )

    db.commit()


    return {
        "ok": True,
        "deleted_photos":
            len(photos),
    }