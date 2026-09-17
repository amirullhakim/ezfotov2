from datetime import datetime, timezone

from fastapi import (
    APIRouter,
    Depends,
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
    GalleryPhoto,
    Service,
    Workspace,
    WorkspaceService,
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

        if expires_at <= utc_now():
            raise HTTPException(
                status_code=
                    status.HTTP_410_GONE,
                detail=
                    "This gallery has expired.",
            )


    return workspace, gallery


def get_workspace_domain(
    workspace_id,
    db: Session,
):
    primary_domain = db.scalar(
        select(Domain).where(
            Domain.workspace_id
            == workspace_id,
            Domain.is_primary.is_(True),
        )
    )

    return primary_domain


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
            "id": str(
                workspace.id
            ),
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
            # Keep the gallery available even if
            # one individual object cannot be signed.
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

                "view_url_expires_in":
                    600
                    if view_url
                    else None,
            }
        )


    response.update(
        {
            "locked": False,
            "photos": photo_results,
        }
    )

    return response


@router.get(
    "/{workspace_slug}/{gallery_slug}"
)
def get_public_client_gallery(
    workspace_slug: str,
    gallery_slug: str,

    t: str | None = Query(
        default=None,
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


    # --------------------------------------------------
    # PUBLIC
    # --------------------------------------------------

    if (
        gallery.privacy_mode
        == "PUBLIC"
    ):
        return full_gallery_response(
            workspace,
            gallery,
            db,
        )


    # --------------------------------------------------
    # PRIVATE SECRET LINK
    # --------------------------------------------------

    if (
        gallery.privacy_mode
        == "PRIVATE"
    ):
        if (
            not t
            or
            not gallery.access_token_hash
            or
            not verify_private_gallery_token(
                t,
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


        return full_gallery_response(
            workspace,
            gallery,
            db,
        )


    # --------------------------------------------------
    # PASSWORD
    # --------------------------------------------------

    metadata = (
        gallery_metadata_response(
            workspace,
            gallery,
            db,
        )
    )

    metadata.update(
        {
            "locked": True,
            "photos": [],
        }
    )

    return metadata


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


    return full_gallery_response(
        workspace,
        gallery,
        db,
    )