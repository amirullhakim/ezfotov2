from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.session import get_db
from app.models import (
    EventGallery,
    EventOrder,
    EventSalesPaymentLedger,
)
from app.services.service_access import require_workspace_service
from app.services.workspace_access import get_user_workspace


router = APIRouter(
    prefix="/event-sales/finance",
    tags=["Event Sales Finance"],
)


@router.get("")
def get_event_sales_finance(
    response: Response,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    currency: str = Query(
        "MYR",
        pattern=r"^[A-Za-z]{3}$",
    ),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    response.headers["Cache-Control"] = "private, no-store"

    workspace, _ = get_user_workspace(
        current_user["id"],
        db,
    )
    require_workspace_service(
        workspace.id,
        "EVENT_SALES",
        db,
    )

    selected_currency = currency.upper()

    ledger_filters = (
        EventSalesPaymentLedger.workspace_id == workspace.id,
        EventSalesPaymentLedger.currency == selected_currency,
    )

    count, photo_cents, fee_cents, total_cents = db.execute(
        select(
            func.count(EventSalesPaymentLedger.id),
            func.coalesce(
                func.sum(
                    EventSalesPaymentLedger.photo_subtotal_cents
                ),
                0,
            ),
            func.coalesce(
                func.sum(
                    EventSalesPaymentLedger.service_fee_cents
                ),
                0,
            ),
            func.coalesce(
                func.sum(EventSalesPaymentLedger.total_cents),
                0,
            ),
        ).where(*ledger_filters)
    ).one()

    # Sum saved ledger snapshots; never apply today's plan to an older sale.
    commission_count, commission_cents, photographer_cents, platform_cents = db.execute(
        select(
            func.count(EventSalesPaymentLedger.pricing_subscription_id),
            func.coalesce(func.sum(EventSalesPaymentLedger.commission_cents), 0),
            func.coalesce(func.sum(EventSalesPaymentLedger.photographer_share_cents), 0),
            func.coalesce(func.sum(EventSalesPaymentLedger.platform_share_cents), 0),
        ).where(*ledger_filters)
    ).one()

    paid_orders = db.scalar(
        select(func.count(EventOrder.id)).where(
            EventOrder.workspace_id == workspace.id,
            EventOrder.status == "PAID",
            EventOrder.currency == selected_currency,
        )
    ) or 0

    recorded_paid_orders = db.scalar(
        select(func.count(EventSalesPaymentLedger.id))
        .join(
            EventOrder,
            EventOrder.id == EventSalesPaymentLedger.order_id,
        )
        .where(
            *ledger_filters,
            EventOrder.workspace_id == workspace.id,
            EventOrder.status == "PAID",
        )
    ) or 0

    rows = db.execute(
        select(
            EventSalesPaymentLedger,
            EventOrder.status,
            EventGallery.title,
        )
        .join(
            EventOrder,
            and_(
                EventOrder.id
                == EventSalesPaymentLedger.order_id,
                EventOrder.workspace_id
                == EventSalesPaymentLedger.workspace_id,
            ),
        )
        .join(
            EventGallery,
            and_(
                EventGallery.id == EventOrder.event_id,
                EventGallery.workspace_id
                == EventSalesPaymentLedger.workspace_id,
            ),
        )
        .where(*ledger_filters)
        .order_by(
            EventSalesPaymentLedger.recorded_at.desc(),
            EventSalesPaymentLedger.id.desc(),
        )
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    recorded_count = int(count)

    return {
        "currency": selected_currency,
        "summary": {
            "recorded_payments": recorded_count,
            "photo_sales_cents": int(photo_cents),
            "service_fees_cents": int(fee_cents),
            "total_collected_cents": int(total_cents),
            "commission_recorded_payments": int(commission_count),
            "commission_missing_payments": int(recorded_count) - int(commission_count),
            "commission_cents": int(commission_cents) if commission_count else None,
            "photographer_share_cents": int(photographer_cents) if commission_count else None,
            "platform_share_cents": int(platform_cents) if commission_count else None,

        },
        "coverage": {
            "paid_orders": int(paid_orders),
            "paid_orders_recorded": int(
                recorded_paid_orders
            ),
            "paid_orders_missing": max(
                0,
                int(paid_orders) - int(recorded_paid_orders),
            ),
        },
        "transactions": [
            {
                "order_number": entry.order_number,
                "event_title": event_title,
                "order_status": order_status,
                "photo_subtotal_cents":
                    entry.photo_subtotal_cents,
                "service_fee_cents":
                    entry.service_fee_cents,
                "total_cents": entry.total_cents,
                "pricing_plan_code": entry.pricing_plan_code,
                "pricing_plan_name": entry.pricing_plan_name,
                "commission_bps": entry.commission_bps,
                "commission_cents": entry.commission_cents,
                "photographer_share_cents": entry.photographer_share_cents,
                "platform_share_cents": entry.platform_share_cents,

                "paid_at": entry.paid_at,
                "recorded_at": entry.recorded_at,
                "source": entry.source,
            }
            for entry, order_status, event_title in rows
        ],
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": recorded_count,
            "total_pages": (
                recorded_count + page_size - 1
            ) // page_size,
        },
    }