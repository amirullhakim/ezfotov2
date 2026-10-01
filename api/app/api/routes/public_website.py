from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import (
    Domain,
    ClientGallery,
    GalleryPhoto,
    PhotographyPackage,
    PortfolioItem,
    WebsiteSettings,
    Workspace,
)

from app.services.private_storage import PrivateStorageError, generate_private_view_url
from app.services.website_access import get_website_publication_access
from app.services.website_packages import can_manage_package_prices, public_package_values


router = APIRouter(
    prefix="/public/sites",
    tags=["Public Photographer Website"],
)


@router.get("/{slug}")
def get_public_site(
    slug: str,
    response: Response,
    db: Session = Depends(get_db),
):
    response.headers["Cache-Control"] = "no-store"

    workspace = db.scalar(
        select(Workspace).where(
            Workspace.slug == slug.lower(),
            Workspace.status == "ACTIVE",
        )
    )

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Photography website not found.",
        )

    if not get_website_publication_access(workspace, db)["can_publish"]:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Photography website not found.",
        )

    settings = db.scalar(
        select(WebsiteSettings).where(
            WebsiteSettings.workspace_id == workspace.id
        )
    )

    if not settings or not settings.is_published:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Photography website is not published.",
        )

    portfolio = db.scalars(
        select(PortfolioItem)
        .where(
            PortfolioItem.workspace_id == workspace.id,
            PortfolioItem.is_visible.is_(True),
        )
        .order_by(
            PortfolioItem.sort_order,
            PortfolioItem.created_at,
        )
    ).all()

    packages = db.scalars(
        select(PhotographyPackage)
        .where(
            PhotographyPackage.workspace_id == workspace.id,
            PhotographyPackage.is_visible.is_(True),
        )
        .order_by(
            PhotographyPackage.sort_order,
            PhotographyPackage.created_at,
        )
    ).all()

    show_package_prices = can_manage_package_prices(workspace.id, db)

    # Listing a gallery exposes only approved metadata. PASSWORD galleries
    # never expose a photo URL, password hash or private access token here.
    gallery_listings = []
    if show_package_prices:
        galleries = db.scalars(select(ClientGallery).where(
            ClientGallery.workspace_id == workspace.id,
            ClientGallery.show_on_website.is_(True),
            ClientGallery.is_published.is_(True),
            ClientGallery.deleted_at.is_(None),
            ClientGallery.privacy_mode.in_(("PUBLIC", "PASSWORD")),
            or_(ClientGallery.expires_at.is_(None), ClientGallery.expires_at > func.now()),
        ).order_by(ClientGallery.created_at.desc(), ClientGallery.id.desc())).all()
        public_ids = [gallery.id for gallery in galleries if gallery.privacy_mode == "PUBLIC"]
        covers = {}
        if public_ids:
            ranked = select(
                GalleryPhoto.id.label("photo_id"),
                func.row_number().over(
                    partition_by=GalleryPhoto.gallery_id,
                    order_by=(GalleryPhoto.is_cover.desc(), GalleryPhoto.sort_order,
                              GalleryPhoto.created_at, GalleryPhoto.id),
                ).label("position"),
            ).where(
                GalleryPhoto.workspace_id == workspace.id,
                GalleryPhoto.gallery_id.in_(public_ids),
                GalleryPhoto.status == "ACTIVE",
                GalleryPhoto.is_visible.is_(True),
                GalleryPhoto.content_type.in_(("image/jpeg", "image/png", "image/webp", "image/avif", "image/gif")),
            ).subquery()
            photos = db.scalars(select(GalleryPhoto).join(
                ranked, ranked.c.photo_id == GalleryPhoto.id,
            ).where(ranked.c.position == 1)).all()
            for photo in photos:
                try:
                    covers[photo.gallery_id] = generate_private_view_url(
                        object_key=photo.object_key, expires_seconds=600,
                    )
                except PrivateStorageError:
                    # Listing metadata stays available if storage signing fails.
                    covers[photo.gallery_id] = None
        gallery_listings = [
            {
                "id": str(gallery.id),
                "title": gallery.title,
                "slug": gallery.slug,
                "description": gallery.description,
                "shoot_date": gallery.shoot_date,
                "privacy_mode": gallery.privacy_mode,
                "price_rm": str(gallery.price_rm) if gallery.price_rm is not None else None,
                "cover_url": covers.get(gallery.id) if gallery.privacy_mode == "PUBLIC" else None,
            }
            for gallery in galleries
        ]

    primary_domain = db.scalar(
        select(Domain).where(
            Domain.workspace_id == workspace.id,
            Domain.is_primary.is_(True),
        )
    )

    return {
        "workspace": {
            "id": str(workspace.id),
            "name": workspace.name,
            "slug": workspace.slug,
            "domain": (
                primary_domain.hostname
                if primary_domain
                else f"{workspace.slug}.ezfotoo.com"
            ),
        },
        "settings": settings,
        "portfolio": portfolio,
        "galleries": gallery_listings,
        "packages": [
            public_package_values(package, show_prices=show_package_prices)
            for package in packages
        ],
    }