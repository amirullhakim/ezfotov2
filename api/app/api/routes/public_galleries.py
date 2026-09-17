import uuid
from datetime import datetime, timezone

from fastapi import (
    APIRouter,
    Depends,
    Header,
    HTTPException,
    Query,
    status,
)
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import (
    ClientGallery,
    Domain,
    GalleryFavourite,
    GalleryPhoto,
    Service,
    Workspace,
    WorkspaceService,
)
from app.services.gallery_access import (
    GalleryAccessError,
    PASSWORD_ACCESS_TTL_SECONDS,
    create_password_gallery_access_token,
    hash_gallery_visitor_token,
    verify_password_gallery_access_token,
)
from app.services.gallery_security import (
    verify_gallery_password,
    verify_private_gallery_token,
)
from app.services.private_storage import (
    PrivateStorageError,
    generate_private_download_url,
    generate_private_view_url,
)


router = APIRouter(
    prefix="/public/galleries",
    tags=["Public Client Galleries"],
)


class GalleryUnlockRequest(BaseModel):
    password: str = Field(
        min_length=1,
        max_length=128,
    )


def utc_now() -> datetime:
    return datetime.now(
        timezone.utc
    )


# --------------------------------------------------
# GALLERY
# --------------------------------------------------


def get_public_gallery(
    workspace_slug: str,
    gallery_slug: str,
    db: Session,
):
    workspace = db.scalar(
        select(Workspace).where(
            Workspace.slug
            == workspace_slug.strip().lower(),

            Workspace.status
            == "ACTIVE",
        )
    )


    if not workspace:
        raise HTTPException(
            status_code=
                status.HTTP_404_NOT_FOUND,

            detail=
                "Client gallery not found.",
        )


    gallery_service = db.scalar(
        select(WorkspaceService)
        .join(
            Service,
            Service.id
            == WorkspaceService.service_id,
        )
        .where(
            WorkspaceService.workspace_id
            == workspace.id,

            Service.code
            == "CLIENT_GALLERY",

            WorkspaceService.status
            == "ACTIVE",
        )
    )


    if not gallery_service:
        raise HTTPException(
            status_code=
                status.HTTP_404_NOT_FOUND,

            detail=
                "Client gallery not found.",
        )


    gallery = db.scalar(
        select(ClientGallery).where(
            ClientGallery.workspace_id
            == workspace.id,

            ClientGallery.slug
            == gallery_slug.strip().lower(),

            ClientGallery.is_published.is_(
                True
            ),

            ClientGallery.deleted_at.is_(
                None
            ),
        )
    )


    if not gallery:
        raise HTTPException(
            status_code=
                status.HTTP_404_NOT_FOUND,

            detail=
                "Client gallery not found.",
        )


    if gallery.expires_at:
        expires_at = (
            gallery.expires_at
        )


        if (
            expires_at.tzinfo
            is None
        ):
            expires_at = (
                expires_at.replace(
                    tzinfo=timezone.utc
                )
            )


        if (
            expires_at <=
            utc_now()
        ):
            raise HTTPException(
                status_code=
                    status.HTTP_410_GONE,

                detail=
                    "This gallery has expired.",
            )


    return (
        workspace,
        gallery,
    )


# --------------------------------------------------
# ACCESS
# --------------------------------------------------


def require_gallery_access(
    gallery: ClientGallery,

    private_token: str | None,

    password_access_token: str | None,
) -> None:
    if (
        gallery.privacy_mode
        == "PUBLIC"
    ):
        return


    if (
        gallery.privacy_mode
        == "PRIVATE"
    ):
        if (
            not private_token
            or
            not gallery.access_token_hash
            or
            not verify_private_gallery_token(
                private_token,
                gallery.access_token_hash,
            )
        ):
            raise HTTPException(
                status_code=
                    status.HTTP_403_FORBIDDEN,

                detail=(
                    "This private gallery link "
                    "is invalid or no longer active."
                ),
            )

        return


    if (
        gallery.privacy_mode
        == "PASSWORD"
    ):
        if (
            not password_access_token
            or
            not verify_password_gallery_access_token(
                token=
                    password_access_token,

                gallery_id=
                    gallery.id,

                current_password_hash=
                    gallery.password_hash,
            )
        ):
            raise HTTPException(
                status_code=
                    status.HTTP_401_UNAUTHORIZED,

                detail=
                    "Gallery access has expired.",
            )

        return


    raise HTTPException(
        status_code=
            status.HTTP_403_FORBIDDEN,

        detail=
            "Gallery access denied.",
    )


# --------------------------------------------------
# DOMAIN
# --------------------------------------------------


def get_workspace_domain(
    workspace_id,
    db: Session,
):
    return db.scalar(
        select(Domain).where(
            Domain.workspace_id
            == workspace_id,

            Domain.is_primary.is_(
                True
            ),
        )
    )


# --------------------------------------------------
# RESPONSES
# --------------------------------------------------


def gallery_metadata_response(
    workspace: Workspace,
    gallery: ClientGallery,
    db: Session,
):
    primary_domain = (
        get_workspace_domain(
            workspace.id,
            db,
        )
    )


    return {
        "workspace": {
            "id":
                str(workspace.id),

            "name":
                workspace.name,

            "slug":
                workspace.slug,

            "domain": (
                primary_domain.hostname
                if primary_domain
                else
                f"{workspace.slug}.ezfotoo.com"
            ),
        },

        "gallery": {
            "id":
                str(gallery.id),

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

            "allow_downloads":
                gallery.allow_downloads,

            "allow_favourites":
                gallery.allow_favourites,

            "expires_at":
                gallery.expires_at,

            "created_at":
                gallery.created_at,
        },
    }


def full_gallery_response(
    workspace: Workspace,
    gallery: ClientGallery,
    db: Session,
):
    response = (
        gallery_metadata_response(
            workspace,
            gallery,
            db,
        )
    )


    photos = db.scalars(
        select(GalleryPhoto)
        .where(
            GalleryPhoto.workspace_id
            == workspace.id,

            GalleryPhoto.gallery_id
            == gallery.id,

            GalleryPhoto.status
            == "ACTIVE",

            GalleryPhoto.is_visible.is_(
                True
            ),
        )
        .order_by(
            GalleryPhoto.is_cover.desc(),
            GalleryPhoto.sort_order,
            GalleryPhoto.created_at,
        )
    ).all()


    photo_results = []


    for photo in photos:
        view_url = None
        download_url = None


        try:
            view_url = (
                generate_private_view_url(
                    photo.object_key,
                    expires_seconds=600,
                )
            )


            if (
                gallery.allow_downloads
            ):
                download_url = (
                    generate_private_download_url(
                        object_key=
                            photo.object_key,

                        expires_seconds=
                            600,

                        download_filename=
                            photo.original_filename,
                    )
                )


        except PrivateStorageError:
            view_url = None
            download_url = None


        photo_results.append(
            {
                "id":
                    str(photo.id),

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

                "view_url":
                    view_url,

                "download_url":
                    download_url,

                "view_url_expires_in": (
                    600
                    if view_url
                    else None
                ),
            }
        )


    response.update(
        {
            "locked":
                False,

            "photos":
                photo_results,
        }
    )


    return response


# --------------------------------------------------
# GET GALLERY
# --------------------------------------------------


@router.get(
    "/{workspace_slug}/{gallery_slug}"
)
def get_public_client_gallery(
    workspace_slug: str,
    gallery_slug: str,

    t: str | None = Query(
        default=None,
    ),

    gallery_access_token: str | None = Header(
        default=None,
        alias="X-Gallery-Access",
    ),

    db: Session = Depends(
        get_db
    ),
):
    workspace, gallery = (
        get_public_gallery(
            workspace_slug,
            gallery_slug,
            db,
        )
    )


    # PUBLIC
    if (
        gallery.privacy_mode
        == "PUBLIC"
    ):
        return full_gallery_response(
            workspace,
            gallery,
            db,
        )


    # PRIVATE
    if (
        gallery.privacy_mode
        == "PRIVATE"
    ):
        require_gallery_access(
            gallery=
                gallery,

            private_token=
                t,

            password_access_token=
                None,
        )


        return full_gallery_response(
            workspace,
            gallery,
            db,
        )


    # PASSWORD
    if (
        gallery_access_token
        and
        verify_password_gallery_access_token(
            token=
                gallery_access_token,

            gallery_id=
                gallery.id,

            current_password_hash=
                gallery.password_hash,
        )
    ):
        return full_gallery_response(
            workspace,
            gallery,
            db,
        )


    metadata = (
        gallery_metadata_response(
            workspace,
            gallery,
            db,
        )
    )


    metadata.update(
        {
            "locked":
                True,

            "photos":
                [],
        }
    )


    return metadata


# --------------------------------------------------
# PASSWORD UNLOCK
# --------------------------------------------------


@router.post(
    "/{workspace_slug}/{gallery_slug}/unlock"
)
def unlock_password_gallery(
    workspace_slug: str,
    gallery_slug: str,

    payload: GalleryUnlockRequest,

    db: Session = Depends(
        get_db
    ),
):
    workspace, gallery = (
        get_public_gallery(
            workspace_slug,
            gallery_slug,
            db,
        )
    )


    if (
        gallery.privacy_mode
        != "PASSWORD"
    ):
        raise HTTPException(
            status_code=
                status.HTTP_400_BAD_REQUEST,

            detail=(
                "This gallery does not "
                "require a password."
            ),
        )


    if (
        not gallery.password_hash
        or
        not verify_gallery_password(
            payload.password,
            gallery.password_hash,
        )
    ):
        raise HTTPException(
            status_code=
                status.HTTP_401_UNAUTHORIZED,

            detail=
                "Incorrect gallery password.",
        )


    try:
        access_token = (
            create_password_gallery_access_token(
                gallery_id=
                    gallery.id,

                password_hash=
                    gallery.password_hash,
            )
        )

    except GalleryAccessError as exc:
        raise HTTPException(
            status_code=
                status.HTTP_500_INTERNAL_SERVER_ERROR,

            detail=
                "Gallery access could not be created.",
        ) from exc


    response = (
        full_gallery_response(
            workspace,
            gallery,
            db,
        )
    )


    response.update(
        {
            "access_token":
                access_token,

            "access_token_expires_in":
                PASSWORD_ACCESS_TTL_SECONDS,
        }
    )


    return response


# --------------------------------------------------
# FAVOURITE HELPERS
# --------------------------------------------------


def require_favourites_enabled(
    gallery: ClientGallery,
):
    if not gallery.allow_favourites:
        raise HTTPException(
            status_code=
                status.HTTP_403_FORBIDDEN,

            detail=(
                "Favourites are disabled "
                "for this gallery."
            ),
        )


def get_gallery_photo(
    workspace_id: uuid.UUID,
    gallery_id: uuid.UUID,
    photo_id: str,
    db: Session,
) -> GalleryPhoto:
    try:
        parsed_photo_id = (
            uuid.UUID(
                photo_id
            )
        )

    except ValueError:
        raise HTTPException(
            status_code=
                status.HTTP_400_BAD_REQUEST,

            detail=
                "Invalid photo ID.",
        )


    photo = db.scalar(
        select(GalleryPhoto).where(
            GalleryPhoto.id
            == parsed_photo_id,

            GalleryPhoto.workspace_id
            == workspace_id,

            GalleryPhoto.gallery_id
            == gallery_id,

            GalleryPhoto.status
            == "ACTIVE",

            GalleryPhoto.is_visible.is_(
                True
            ),
        )
    )


    if not photo:
        raise HTTPException(
            status_code=
                status.HTTP_404_NOT_FOUND,

            detail=
                "Photo not found.",
        )


    return photo


def require_visitor_token(
    visitor_token: str | None,
) -> str:
    if not visitor_token:
        raise HTTPException(
            status_code=
                status.HTTP_400_BAD_REQUEST,

            detail=
                "Gallery visitor token is required.",
        )


    if (
        len(visitor_token) < 20
        or
        len(visitor_token) > 200
    ):
        raise HTTPException(
            status_code=
                status.HTTP_400_BAD_REQUEST,

            detail=
                "Invalid gallery visitor token.",
        )


    return hash_gallery_visitor_token(
        visitor_token
    )


# --------------------------------------------------
# LIST FAVOURITES
# --------------------------------------------------


@router.get(
    "/{workspace_slug}/{gallery_slug}/favourites"
)
def get_gallery_favourites(
    workspace_slug: str,
    gallery_slug: str,

    t: str | None = Query(
        default=None,
    ),

    visitor_token: str | None = Header(
        default=None,
        alias="X-Gallery-Visitor",
    ),

    gallery_access_token: str | None = Header(
        default=None,
        alias="X-Gallery-Access",
    ),

    db: Session = Depends(
        get_db
    ),
):
    workspace, gallery = (
        get_public_gallery(
            workspace_slug,
            gallery_slug,
            db,
        )
    )


    require_gallery_access(
        gallery=
            gallery,

        private_token=
            t,

        password_access_token=
            gallery_access_token,
    )


    require_favourites_enabled(
        gallery
    )


    visitor_hash = (
        require_visitor_token(
            visitor_token
        )
    )


    favourites = db.scalars(
        select(GalleryFavourite)
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

            GalleryFavourite.visitor_token
            == visitor_hash,

            GalleryPhoto.status
            == "ACTIVE",

            GalleryPhoto.is_visible.is_(
                True
            ),
        )
        .order_by(
            GalleryFavourite.created_at,
        )
    ).all()


    return {
        "enabled":
            True,

        "photo_ids": [
            str(
                favourite.photo_id
            )
            for favourite
            in favourites
        ],

        "count":
            len(favourites),
    }


# --------------------------------------------------
# ADD FAVOURITE
# --------------------------------------------------


@router.post(
    "/{workspace_slug}/{gallery_slug}/favourites/{photo_id}"
)
def add_gallery_favourite(
    workspace_slug: str,
    gallery_slug: str,
    photo_id: str,

    t: str | None = Query(
        default=None,
    ),

    visitor_token: str | None = Header(
        default=None,
        alias="X-Gallery-Visitor",
    ),

    gallery_access_token: str | None = Header(
        default=None,
        alias="X-Gallery-Access",
    ),

    db: Session = Depends(
        get_db
    ),
):
    workspace, gallery = (
        get_public_gallery(
            workspace_slug,
            gallery_slug,
            db,
        )
    )


    require_gallery_access(
        gallery=
            gallery,

        private_token=
            t,

        password_access_token=
            gallery_access_token,
    )


    require_favourites_enabled(
        gallery
    )


    photo = (
        get_gallery_photo(
            workspace_id=
                workspace.id,

            gallery_id=
                gallery.id,

            photo_id=
                photo_id,

            db=
                db,
        )
    )


    visitor_hash = (
        require_visitor_token(
            visitor_token
        )
    )


    existing = db.scalar(
        select(GalleryFavourite).where(
            GalleryFavourite.photo_id
            == photo.id,

            GalleryFavourite.visitor_token
            == visitor_hash,
        )
    )


    if not existing:
        favourite = (
            GalleryFavourite(
                workspace_id=
                    workspace.id,

                gallery_id=
                    gallery.id,

                photo_id=
                    photo.id,

                visitor_token=
                    visitor_hash,
            )
        )


        db.add(
            favourite
        )

        db.commit()


    return {
        "ok":
            True,

        "favourited":
            True,

        "photo_id":
            str(photo.id),
    }


# --------------------------------------------------
# REMOVE FAVOURITE
# --------------------------------------------------


@router.delete(
    "/{workspace_slug}/{gallery_slug}/favourites/{photo_id}"
)
def remove_gallery_favourite(
    workspace_slug: str,
    gallery_slug: str,
    photo_id: str,

    t: str | None = Query(
        default=None,
    ),

    visitor_token: str | None = Header(
        default=None,
        alias="X-Gallery-Visitor",
    ),

    gallery_access_token: str | None = Header(
        default=None,
        alias="X-Gallery-Access",
    ),

    db: Session = Depends(
        get_db
    ),
):
    workspace, gallery = (
        get_public_gallery(
            workspace_slug,
            gallery_slug,
            db,
        )
    )


    require_gallery_access(
        gallery=
            gallery,

        private_token=
            t,

        password_access_token=
            gallery_access_token,
    )


    require_favourites_enabled(
        gallery
    )


    photo = (
        get_gallery_photo(
            workspace_id=
                workspace.id,

            gallery_id=
                gallery.id,

            photo_id=
                photo_id,

            db=
                db,
        )
    )


    visitor_hash = (
        require_visitor_token(
            visitor_token
        )
    )


    favourite = db.scalar(
        select(GalleryFavourite).where(
            GalleryFavourite.photo_id
            == photo.id,

            GalleryFavourite.visitor_token
            == visitor_hash,
        )
    )


    if favourite:
        db.delete(
            favourite
        )

        db.commit()


    return {
        "ok":
            True,

        "favourited":
            False,

        "photo_id":
            str(photo.id),
    }