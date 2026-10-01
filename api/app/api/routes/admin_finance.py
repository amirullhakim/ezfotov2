from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.auth import require_platform_admin
from app.db.session import get_db
from app.models import EventOrder, EventSalesPaymentLedger, Workspace


router = APIRouter(
    prefix="/admin/finance",
    tags=["Platform Admin Finance"],
    dependencies=[Depends(require_platform_admin)],
)


@router.get("")
def get_admin_finance(
    response: Response,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    response.headers["Cache-Control"] = "private, no-store"
    ledger = EventSalesPaymentLedger

    count, photo_sales, service_fees, total_collected = db.execute(
        select(
            func.count(ledger.id),
            func.coalesce(func.sum(ledger.photo_subtotal_cents), 0),
            func.coalesce(func.sum(ledger.service_fee_cents), 0),
            func.coalesce(func.sum(ledger.total_cents), 0),
        ).where(ledger.currency == "MYR")
    ).one()

    # Commission totals come only from the immutable payment ledger.
    commission_count, commission_cents, photographer_cents, platform_cents = db.execute(
        select(
            func.count(ledger.pricing_subscription_id),
            func.coalesce(func.sum(ledger.commission_cents), 0),
            func.coalesce(func.sum(ledger.photographer_share_cents), 0),
            func.coalesce(func.sum(ledger.platform_share_cents), 0),
        ).where(ledger.currency == "MYR")
    ).one()

    paid_orders = db.scalar(
        select(func.count(EventOrder.id)).where(
            EventOrder.status == "PAID",
            EventOrder.currency == "MYR",
        )
    ) or 0

    recorded_paid_orders = db.scalar(
        select(func.count(ledger.id))
        .join(EventOrder, EventOrder.id == ledger.order_id)
        .where(
            ledger.currency == "MYR",
            EventOrder.status == "PAID",
            EventOrder.currency == "MYR",
        )
    ) or 0

    by_workspace = db.execute(
        select(
            Workspace.id,
            Workspace.name,
            Workspace.slug,
            func.count(ledger.id),
            func.coalesce(func.sum(ledger.photo_subtotal_cents), 0),
            func.coalesce(func.sum(ledger.service_fee_cents), 0),
            func.coalesce(func.sum(ledger.total_cents), 0),
            func.count(ledger.pricing_subscription_id),
            func.coalesce(func.sum(ledger.commission_cents), 0),
            func.coalesce(func.sum(ledger.photographer_share_cents), 0),
            func.coalesce(func.sum(ledger.platform_share_cents), 0),
        )
        .join(ledger, ledger.workspace_id == Workspace.id)
        .where(ledger.currency == "MYR")
        .group_by(Workspace.id, Workspace.name, Workspace.slug)
        .order_by(func.sum(ledger.total_cents).desc(), Workspace.name)
    ).all()

    transactions = db.execute(
        select(ledger, Workspace.name)
        .join(Workspace, Workspace.id == ledger.workspace_id)
        .where(ledger.currency == "MYR")
        .order_by(ledger.paid_at.desc(), ledger.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    return {
        "currency": "MYR",
        "summary": {
            "recorded_payments": int(count),
            "photo_sales_cents": int(photo_sales),
            "service_fees_cents": int(service_fees),
            "total_collected_cents": int(total_collected),
            "commission_recorded_payments": int(commission_count),
            "commission_missing_payments": int(count) - int(commission_count),
            "commission_cents": int(commission_cents) if commission_count else None,
            "photographer_share_cents": int(photographer_cents) if commission_count else None,
            "platform_share_cents": int(platform_cents) if commission_count else None,

        },
        "coverage": {
            "paid_orders": int(paid_orders),
            "paid_orders_recorded": int(recorded_paid_orders),
            "paid_orders_missing": max(
                0, int(paid_orders) - int(recorded_paid_orders)
            ),
        },
        "workspaces": [
            {
                "id": str(workspace_id),
                "name": name,
                "slug": slug,
                "recorded_payments": int(payments),
                "photo_sales_cents": int(photos),
                "service_fees_cents": int(fees),
                "total_collected_cents": int(collected),
                "commission_recorded_payments": int(commission_count),
                "commission_missing_payments": int(payments) - int(commission_count),
                "commission_cents": int(commission_cents) if commission_count else None,
                "photographer_share_cents": int(photographer_cents) if commission_count else None,
                "platform_share_cents": int(platform_cents) if commission_count else None,

            }
            for (workspace_id, name, slug, payments, photos, fees, collected,
                 commission_count, commission_cents, photographer_cents, platform_cents)
            in by_workspace
        ],
        "transactions": [
            {
                "order_number": entry.order_number,
                "workspace_name": workspace_name,
                "paid_at": entry.paid_at,
                "source": entry.source,
                "photo_sales_cents": entry.photo_subtotal_cents,
                "service_fee_cents": entry.service_fee_cents,
                "total_cents": entry.total_cents,
                "pricing_plan_code": entry.pricing_plan_code,
                "pricing_plan_name": entry.pricing_plan_name,
                "commission_bps": entry.commission_bps,
                "commission_cents": entry.commission_cents,
                "photographer_share_cents": entry.photographer_share_cents,
                "platform_share_cents": entry.platform_share_cents,

            }
            for entry, workspace_name in transactions
        ],
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": int(count),
            "total_pages": (int(count) + page_size - 1) // page_size,
        },
    }