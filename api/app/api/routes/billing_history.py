"""Read-only subscription payment history; never changes payment state."""
import math

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.auth import get_current_user, require_platform_admin
from app.db.session import get_db
from app.models import Service, SubscriptionBillingOrder, Workspace
from app.services.workspace_access import get_user_workspace

router = APIRouter(tags=["Subscription payment history"])
PAYMENT_STATUSES = {
    "PENDING_PAYMENT", "PAID", "PAYMENT_FAILED", "CANCELLED", "EXPIRED", "REFUNDED",
}
SERVICE_CODES = {"WEBSITE", "CLIENT_GALLERY", "EVENT_SALES"}


def list_history(db, *, workspace_id=None, page=1, page_size=20,
                 payment_status=None, service_code=None, search=None):
    filters = []
    if workspace_id is not None:
        filters.append(SubscriptionBillingOrder.workspace_id == workspace_id)
    if payment_status:
        if payment_status not in PAYMENT_STATUSES:
            raise HTTPException(422, "Invalid payment status.")
        filters.append(SubscriptionBillingOrder.status == payment_status)
    if service_code:
        if service_code not in SERVICE_CODES:
            raise HTTPException(422, "Invalid service code.")
        filters.append(Service.code == service_code)
    if search and search.strip():
        term = search.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        pattern = f"%{term}%"
        filters.append(or_(
            SubscriptionBillingOrder.order_number.ilike(pattern, escape="\\"),
            Workspace.name.ilike(pattern, escape="\\"),
            SubscriptionBillingOrder.payer_email.ilike(pattern, escape="\\"),
        ))
    query = select(SubscriptionBillingOrder, Workspace.name, Service.code).join(
        Workspace, Workspace.id == SubscriptionBillingOrder.workspace_id,
    ).join(Service, Service.id == SubscriptionBillingOrder.service_id).where(*filters)
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    records = db.execute(query.order_by(
        SubscriptionBillingOrder.created_at.desc(), SubscriptionBillingOrder.id.desc(),
    ).offset((page - 1) * page_size).limit(page_size)).all()
    return {
        "orders": [{
            "order_number": order.order_number,
            "workspace_name": workspace_name,
            "service_code": code,
            "plan_code": order.plan_code_snapshot,
            "plan_name": order.plan_name_snapshot,
            "payer_email": order.payer_email,
            "currency": order.currency,
            "total_cents": order.total_cents,
            "status": order.status,
            "payment_provider": order.payment_provider,
            "payment_reference": order.payment_reference,
            "created_at": order.created_at,
            "paid_at": order.paid_at,
            "activated_at": order.activated_at,
            "period_start": order.period_start,
            "period_end": order.period_end,
            "activation_pending": order.status == "PAID" and order.activated_at is None,
        } for order, workspace_name, code in records],
        "pagination": {
            "page": page, "page_size": page_size, "total": total,
            "total_pages": max(1, math.ceil(total / page_size)),
        },
    }


@router.get("/billing/history")
def workspace_payment_history(
    response: Response,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    payment_status: str | None = Query(None, max_length=30),
    service_code: str | None = Query(None, max_length=50),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    workspace, membership = get_user_workspace(current_user["id"], db)
    if membership.role != "OWNER":
        raise HTTPException(403, "Only the workspace owner can view subscription payment history.")
    response.headers["Cache-Control"] = "no-store"
    return list_history(db, workspace_id=workspace.id, page=page, page_size=page_size,
                        payment_status=payment_status, service_code=service_code)


@router.get("/admin/billing/history")
def platform_payment_history(
    response: Response,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    payment_status: str | None = Query(None, max_length=30),
    service_code: str | None = Query(None, max_length=50),
    search: str | None = Query(None, max_length=100),
    current_user: dict = Depends(require_platform_admin),
    db: Session = Depends(get_db),
):
    response.headers["Cache-Control"] = "no-store"
    return list_history(db, page=page, page_size=page_size,
                        payment_status=payment_status, service_code=service_code, search=search)