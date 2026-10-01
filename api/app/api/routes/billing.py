import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.session import get_db
from app.models import SubscriptionBillingOrder
from app.services.workspace_access import get_user_workspace
from app.services.workspace_storage import get_workspace_storage
from app.services.workspace_billing import (
    BILLING_SERVICE_CODES, get_workspace_billing, list_available_plans,
)
from app.services.subscription_checkout import (
    reconcile_billing_order, start_checkout,
)


router = APIRouter(prefix="/billing", tags=["Billing"])


class CheckoutRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    plan_code: str = Field(min_length=1, max_length=80)
    idempotency_key: uuid.UUID


@router.get("/plans")
def get_billing_plans(
    service_code: str | None = Query(None, max_length=50),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_user_workspace(current_user["id"], db)
    selected_service = service_code.strip().upper() if service_code is not None else None
    if selected_service is not None and selected_service not in BILLING_SERVICE_CODES:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Invalid billing service code.")
    plans = list_available_plans(db, selected_service)
    return {"count": len(plans), "plans": plans}


@router.get("/subscriptions")
def get_billing_subscriptions(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    workspace, membership = get_user_workspace(current_user["id"], db)
    result = get_workspace_billing(workspace, db)
    result["can_manage_billing"] = membership.role == "OWNER" and workspace.status == "ACTIVE"
    return result


@router.get("/storage")
def get_billing_storage(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    workspace, _ = get_user_workspace(current_user["id"], db)
    return get_workspace_storage(workspace, db)


@router.post("/checkout")
def create_subscription_checkout(
    payload: CheckoutRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    workspace, membership = get_user_workspace(current_user["id"], db)
    try:
        return start_checkout(
            db, workspace_id=workspace.id, profile_id=membership.profile_id,
            email=str(current_user.get("email") or "").strip(),
            plan_code=payload.plan_code.strip().upper(),
            idempotency_key=payload.idempotency_key,
        )
    except Exception:
        db.rollback()
        raise


@router.get("/orders/{order_number}")
def get_subscription_checkout(
    order_number: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    workspace, _ = get_user_workspace(current_user["id"], db)
    order = db.scalar(select(SubscriptionBillingOrder).where(
        SubscriptionBillingOrder.workspace_id == workspace.id,
        SubscriptionBillingOrder.order_number == order_number,
    ))
    if order is None:
        raise HTTPException(404, "Billing order not found.")
    try:
        return reconcile_billing_order(db, order)
    except Exception:
        db.rollback()
        raise