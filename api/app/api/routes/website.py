from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.session import get_db
from app.models import (
    PhotographyPackage,
    PortfolioItem,
    WebsiteSettings,
)
from app.schemas.website import (
    PhotographyPackageCreate,
    PortfolioItemCreate,
    WebsiteSettingsUpdate,
)
from app.services.service_access import (
    require_workspace_service,
)
from app.services.workspace_access import (
    get_user_workspace,
)


router = APIRouter(
    prefix="/website",
    tags=["Photographer Website"],
)


def get_website_workspace(
    current_user: dict,
    db: Session,
):
    workspace, membership = get_user_workspace(
        current_user["id"],
        db,
    )

    require_workspace_service(
        workspace.id,
        "WEBSITE",
        db,
    )

    return workspace, membership


@router.get("/settings")
def get_website_settings(
    current_user: dict = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):
    workspace, _ = get_website_workspace(
        current_user,
        db,
    )

    settings = db.scalar(
        select(WebsiteSettings).where(
            WebsiteSettings.workspace_id
            == workspace.id
        )
    )

    if settings is None:
        settings = WebsiteSettings(
            workspace_id=workspace.id,
            display_name=workspace.name,
            hero_title=workspace.name,
        )

        db.add(settings)
        db.commit()
        db.refresh(settings)

    return settings


@router.put("/settings")
def update_website_settings(
    payload: WebsiteSettingsUpdate,
    current_user: dict = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):
    workspace, _ = get_website_workspace(
        current_user,
        db,
    )

    settings = db.scalar(
        select(WebsiteSettings).where(
            WebsiteSettings.workspace_id
            == workspace.id
        )
    )

    if settings is None:
        settings = WebsiteSettings(
            workspace_id=workspace.id,
        )

        db.add(settings)

    values = payload.model_dump()

    for key, value in values.items():
        setattr(
            settings,
            key,
            value,
        )

    db.commit()
    db.refresh(settings)

    return settings


@router.get("/portfolio")
def get_portfolio(
    current_user: dict = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):
    workspace, _ = get_website_workspace(
        current_user,
        db,
    )

    items = db.scalars(
        select(PortfolioItem)
        .where(
            PortfolioItem.workspace_id
            == workspace.id
        )
        .order_by(
            PortfolioItem.sort_order,
            PortfolioItem.created_at,
        )
    ).all()

    return {
        "items": items,
    }


@router.post(
    "/portfolio",
    status_code=status.HTTP_201_CREATED,
)
def create_portfolio_item(
    payload: PortfolioItemCreate,
    current_user: dict = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):
    workspace, _ = get_website_workspace(
        current_user,
        db,
    )

    item = PortfolioItem(
        workspace_id=workspace.id,
        **payload.model_dump(),
    )

    db.add(item)
    db.commit()
    db.refresh(item)

    return item


@router.delete("/portfolio/{item_id}")
def delete_portfolio_item(
    item_id: str,
    current_user: dict = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):
    workspace, _ = get_website_workspace(
        current_user,
        db,
    )

    item = db.scalar(
        select(PortfolioItem).where(
            PortfolioItem.id == item_id,
            PortfolioItem.workspace_id
            == workspace.id,
        )
    )

    if item:
        db.delete(item)
        db.commit()

    return {
        "ok": True,
    }


@router.get("/packages")
def get_packages(
    current_user: dict = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):
    workspace, _ = get_website_workspace(
        current_user,
        db,
    )

    packages = db.scalars(
        select(PhotographyPackage)
        .where(
            PhotographyPackage.workspace_id
            == workspace.id
        )
        .order_by(
            PhotographyPackage.sort_order,
            PhotographyPackage.created_at,
        )
    ).all()

    return {
        "packages": packages,
    }


@router.post(
    "/packages",
    status_code=status.HTTP_201_CREATED,
)
def create_package(
    payload: PhotographyPackageCreate,
    current_user: dict = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):
    workspace, _ = get_website_workspace(
        current_user,
        db,
    )

    package = PhotographyPackage(
        workspace_id=workspace.id,
        **payload.model_dump(),
    )

    db.add(package)
    db.commit()
    db.refresh(package)

    return package


@router.delete("/packages/{package_id}")
def delete_package(
    package_id: str,
    current_user: dict = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):
    workspace, _ = get_website_workspace(
        current_user,
        db,
    )

    package = db.scalar(
        select(PhotographyPackage).where(
            PhotographyPackage.id
            == package_id,
            PhotographyPackage.workspace_id
            == workspace.id,
        )
    )

    if package:
        db.delete(package)
        db.commit()

    return {
        "ok": True,
    }