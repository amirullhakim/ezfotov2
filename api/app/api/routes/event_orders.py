from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.session import get_db
from app.models import EventGallery, EventOrder
from app.services.service_access import require_workspace_service
from app.services.workspace_access import get_user_workspace


router = APIRouter(
    prefix="/event-sales/orders",
    tags=["Event Sales Orders"],
)

ORDER_STATUSES = {
    "PENDING_PAYMENT",
    "PAID",
    "PAYMENT_FAILED",
    "CANCELLED",
    "EXPIRED",
    "REFUNDED",
}


def _search_pattern(value: str) -> str:
    # Treat SQL wildcard characters in customer input as ordinary text.
    escaped = value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


@router.get("")
def list_event_orders(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: str | None = Query(None, alias="status"),
    search: str = Query("", max_length=120),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    workspace, _ = get_user_workspace(current_user["id"], db)
    require_workspace_service(workspace.id, "EVENT_SALES", db)

    selected_status = status_filter.strip().upper() if status_filter else None
    if selected_status and selected_status not in ORDER_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid order status.",
        )

    filters = [EventOrder.workspace_id == workspace.id]
    if selected_status:
        filters.append(EventOrder.status == selected_status)

    search_text = search.strip()
    if search_text:
        pattern = _search_pattern(search_text)
        filters.append(
            or_(
                EventOrder.order_number.ilike(pattern, escape="\\"),
                EventOrder.customer_name.ilike(pattern, escape="\\"),
                EventOrder.customer_email.ilike(pattern, escape="\\"),
                EventGallery.title.ilike(pattern, escape="\\"),
            )
        )

    event_join = and_(
        EventGallery.id == EventOrder.event_id,
        EventGallery.workspace_id == EventOrder.workspace_id,
    )

    total = db.scalar(
        select(func.count(EventOrder.id))
        .select_from(EventOrder)
        .join(EventGallery, event_join)
        .where(*filters)
    ) or 0

    rows = db.execute(
        select(EventOrder, EventGallery.title)
        .join(EventGallery, event_join)
        .where(*filters)
        .order_by(EventOrder.created_at.desc(), EventOrder.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    return {
        "orders": [
            {
                "order_number": order.order_number,
                "customer_name": order.customer_name,
                "customer_email": order.customer_email,
                "event_id": str(order.event_id),
                "event_title": event_title,
                "item_count": order.item_count,
                "currency": order.currency,
                "photo_subtotal_cents": order.photo_subtotal_cents,
                "service_fee_cents": order.service_fee_cents,
                "total_cents": order.total_cents,
                "status": order.status,
                "payment_provider": order.payment_provider,
                "created_at": order.created_at,
                "paid_at": order.paid_at,
            }
            for order, event_title in rows
        ],
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": (total + page_size - 1) // page_size,
        },
    }