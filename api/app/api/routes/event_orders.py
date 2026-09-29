from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.session import get_db
from app.models import EventGallery, EventOrder, EventOrderItem, EventPhoto
from app.services.private_storage import (
    PrivateStorageError,
    generate_private_view_url,
)
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

IMAGE_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/avif",
    "image/gif",
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


@router.get("/{order_number}")
def get_event_order_detail(
    order_number: str,
    response: Response,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    response.headers["Cache-Control"] = "private, no-store"

    workspace, _ = get_user_workspace(current_user["id"], db)
    require_workspace_service(workspace.id, "EVENT_SALES", db)

    row = db.execute(
        select(EventOrder, EventGallery.title)
        .join(
            EventGallery,
            and_(
                EventGallery.id == EventOrder.event_id,
                EventGallery.workspace_id == EventOrder.workspace_id,
            ),
        )
        .where(
            EventOrder.workspace_id == workspace.id,
            EventOrder.order_number == order_number.strip().upper(),
        )
    ).one_or_none()

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found.",
        )

    order, event_title = row

    items = db.execute(
        select(EventOrderItem, EventPhoto)
        .join(
            EventPhoto,
            and_(
                EventPhoto.id == EventOrderItem.photo_id,
                EventPhoto.workspace_id == EventOrderItem.workspace_id,
                EventPhoto.event_id == EventOrderItem.event_id,
            ),
        )
        .where(
            EventOrderItem.order_id == order.id,
            EventOrderItem.workspace_id == workspace.id,
            EventOrderItem.event_id == order.event_id,
        )
        .order_by(EventOrderItem.created_at.asc(), EventOrderItem.id.asc())
    ).all()

    photos = []

    for item, photo in items:
        view_url = None

        if photo.content_type.lower() in IMAGE_CONTENT_TYPES:
            try:
                view_url = generate_private_view_url(
                    object_key=photo.original_object_key,
                    expires_seconds=600,
                )
            except PrivateStorageError:
                # Keep order information available if R2 signing is unavailable.
                pass

        photos.append(
            {
                "photo_id": str(photo.id),
                "filename": photo.original_filename,
                "size_bytes": photo.size_bytes,
                "unit_price_cents": item.unit_price_cents,
                "view_url": view_url,
            }
        )

    return {
        "order": {
            "order_number": order.order_number,
            "customer_name": order.customer_name,
            "customer_email": order.customer_email,
            "event_id": str(order.event_id),
            "event_title": event_title,
            "status": order.status,
            "currency": order.currency,
            "item_count": order.item_count,
            "regular_subtotal_cents": order.regular_subtotal_cents,
            "discount_cents": order.discount_cents,
            "photo_subtotal_cents": order.photo_subtotal_cents,
            "service_fee_cents": order.service_fee_cents,
            "total_cents": order.total_cents,
            "payment_provider": order.payment_provider,
            "created_at": order.created_at,
            "paid_at": order.paid_at,
            "expires_at": order.expires_at,
        },
        "photos": photos,
    }