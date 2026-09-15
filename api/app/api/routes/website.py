import uuid

from fastapi import APIRouter, Depends, HTTPException, status
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
from app.services.media_assets import (
    delete_media_asset,
    get_workspace_media_asset,
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


def validate_media_asset(
    db: Session,
    workspace_id: uuid.UUID,
    asset_id: uuid.UUID | None,
    expected_purpose: str,
):
    if asset_id is None:
        return None

    asset = get_workspace_media_asset(
        db=db,
        asset_id=asset_id,
        workspace_id=workspace_id,
    )

    if not asset:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Media asset was not found or is not active.",
        )

    if asset.purpose != expected_purpose:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Media asset must have purpose "
                f"'{expected_purpose}'."
            ),
        )

    return asset


def cleanup_detached_asset(
    db: Session,
    workspace_id: uuid.UUID,
    old_asset_id: uuid.UUID | None,
    new_asset_id: uuid.UUID | None,
):
    if old_asset_id is None:
        return

    if old_asset_id == new_asset_id:
        return

    old_asset = get_workspace_media_asset(
        db=db,
        asset_id=old_asset_id,
        workspace_id=workspace_id,
    )

    if not old_asset:
        return

    try:
        delete_media_asset(
            db,
            old_asset,
        )

        db.commit()

    except Exception:
        # The website update has already succeeded.
        # If storage cleanup fails, keep the media row ACTIVE
        # so a later cleanup process can retry safely.
        db.rollback()


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
        db.flush()

    old_logo_asset_id = (
        settings.logo_media_asset_id
    )

    old_hero_asset_id = (
        settings.hero_media_asset_id
    )

    old_about_asset_id = (
        settings.about_media_asset_id
    )

    logo_asset = validate_media_asset(
        db=db,
        workspace_id=workspace.id,
        asset_id=payload.logo_media_asset_id,
        expected_purpose="logo",
    )

    hero_asset = validate_media_asset(
        db=db,
        workspace_id=workspace.id,
        asset_id=payload.hero_media_asset_id,
        expected_purpose="website-hero",
    )

    about_asset = validate_media_asset(
        db=db,
        workspace_id=workspace.id,
        asset_id=payload.about_media_asset_id,
        expected_purpose="website-about",
    )

    values = payload.model_dump()

    if logo_asset:
        values["logo_url"] = (
            logo_asset.public_url
        )

    if hero_asset:
        values["hero_image_url"] = (
            hero_asset.public_url
        )

    if about_asset:
        values["about_image_url"] = (
            about_asset.public_url
        )

    for key, value in values.items():
        setattr(
            settings,
            key,
            value,
        )

    db.commit()
    db.refresh(settings)

    new_logo_asset_id = (
        settings.logo_media_asset_id
    )

    new_hero_asset_id = (
        settings.hero_media_asset_id
    )

    new_about_asset_id = (
        settings.about_media_asset_id
    )

    cleanup_detached_asset(
        db=db,
        workspace_id=workspace.id,
        old_asset_id=old_logo_asset_id,
        new_asset_id=new_logo_asset_id,
    )

    cleanup_detached_asset(
        db=db,
        workspace_id=workspace.id,
        old_asset_id=old_hero_asset_id,
        new_asset_id=new_hero_asset_id,
    )

    cleanup_detached_asset(
        db=db,
        workspace_id=workspace.id,
        old_asset_id=old_about_asset_id,
        new_asset_id=new_about_asset_id,
    )

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

    media_asset = None

    if payload.media_asset_id:
        media_asset = validate_media_asset(
            db=db,
            workspace_id=workspace.id,
            asset_id=payload.media_asset_id,
            expected_purpose="portfolio",
        )

    image_url = (
        media_asset.public_url
        if media_asset
        else payload.image_url
    )

    item = PortfolioItem(
        workspace_id=workspace.id,
        media_asset_id=(
            media_asset.id
            if media_asset
            else None
        ),
        title=payload.title,
        category=payload.category,
        description=payload.description,
        image_url=image_url,
        sort_order=payload.sort_order,
        is_featured=payload.is_featured,
        is_visible=payload.is_visible,
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

    try:
        parsed_item_id = uuid.UUID(
            item_id
        )

    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid portfolio item ID.",
        )

    item = db.scalar(
        select(PortfolioItem).where(
            PortfolioItem.id
            == parsed_item_id,
            PortfolioItem.workspace_id
            == workspace.id,
        )
    )

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Portfolio item not found.",
        )

    media_asset = (
        get_workspace_media_asset(
            db=db,
            asset_id=item.media_asset_id,
            workspace_id=workspace.id,
        )
        if item.media_asset_id
        else None
    )

    db.delete(item)
    db.commit()

    media_deleted = False

    if media_asset:
        try:
            delete_media_asset(
                db,
                media_asset,
            )

            db.commit()

            media_deleted = True

        except Exception:
            db.rollback()

    return {
        "ok": True,
        "media_deleted": media_deleted,
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

    try:
        parsed_package_id = uuid.UUID(
            package_id
        )

    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid package ID.",
        )

    package = db.scalar(
        select(PhotographyPackage).where(
            PhotographyPackage.id
            == parsed_package_id,
            PhotographyPackage.workspace_id
            == workspace.id,
        )
    )

    if not package:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Package not found.",
        )

    db.delete(package)
    db.commit()

    return {
        "ok": True,
    }