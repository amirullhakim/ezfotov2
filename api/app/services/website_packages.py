"""Website package pricing access and safe public serialization."""
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.services.subscription_access import require_paid_workspace_service


def can_manage_package_prices(workspace_id, db: Session) -> bool:
    try:
        require_paid_workspace_service(workspace_id, "CLIENT_GALLERY", db)
    except HTTPException as exc:
        if exc.status_code != 403:
            raise
        return False
    return True


def require_package_price_access(workspace_id, db: Session) -> None:
    if not can_manage_package_prices(workspace_id, db):
        raise HTTPException(
            403,
            "An active Client Gallery plan is required to set package prices. "
            "Choose or renew your plan in Billing.",
        )


def public_package_values(package, *, show_prices: bool) -> dict:
    # Prices are removed from the API response itself after Gallery expiry,
    # while preserving the stored values for renewal and draft management.
    return {
        "id": str(package.id),
        "name": package.name,
        "description": package.description,
        "price_rm": str(package.price_rm) if show_prices and package.price_rm is not None else None,
        "price_label": package.price_label if show_prices else None,
        "features_text": package.features_text,
        "sort_order": package.sort_order,
        "is_featured": package.is_featured,
        "is_visible": package.is_visible,
    }