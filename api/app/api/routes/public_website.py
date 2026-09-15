from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import (
    Domain,
    PhotographyPackage,
    PortfolioItem,
    Service,
    WebsiteSettings,
    Workspace,
    WorkspaceService,
)


router = APIRouter(
    prefix="/public/sites",
    tags=["Public Photographer Website"],
)


@router.get("/{slug}")
def get_public_site(
    slug: str,
    db: Session = Depends(get_db),
):
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

    website_service = db.scalar(
        select(WorkspaceService)
        .join(
            Service,
            Service.id == WorkspaceService.service_id,
        )
        .where(
            WorkspaceService.workspace_id == workspace.id,
            Service.code == "WEBSITE",
            WorkspaceService.status == "ACTIVE",
        )
    )

    if not website_service:
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
        "packages": packages,
    }