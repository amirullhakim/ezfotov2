from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Literal

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models.event_order import EventOrder
from app.models.event_sales_payment_ledger import EventSalesPaymentLedger
from app.services.event_sales_pricing import calculate_event_commission


LedgerSource = Literal["WEBHOOK", "RECONCILIATION", "BACKFILL"]


class EventSalesLedgerError(RuntimeError):
    """The order cannot be safely recorded in the payment ledger."""


def record_paid_event_order(
    *,
    db: Session,
    order: EventOrder,
    source: LedgerSource,
) -> EventSalesPaymentLedger:
    """Record a verified payment in the caller's transaction.

    The caller must verify payment with the provider and lock the order
    before changing its status. This function never commits or rolls back.

    Repeated calls reuse an identical receipt. Conflicting data raises
    an error so the caller can roll back the whole payment update.
    """
    if source not in {"WEBHOOK", "RECONCILIATION", "BACKFILL"}:
        raise EventSalesLedgerError("Invalid ledger source.")

    if order.status != "PAID":
        raise EventSalesLedgerError("Only paid orders can be recorded.")

    if order.id is None or order.workspace_id is None:
        raise EventSalesLedgerError(
            "The order must have saved identifiers."
        )

    if order.paid_at is None or order.paid_at.utcoffset() is None:
        raise EventSalesLedgerError(
            "A timezone-aware payment timestamp is required."
        )

    if not re.fullmatch(r"[A-Z]{3}", order.currency or ""):
        raise EventSalesLedgerError("Invalid order currency.")

    for name in (
        "order_number",
        "payment_provider",
        "payment_reference",
    ):
        value = getattr(order, name)

        if not isinstance(value, str) or not value.strip():
            raise EventSalesLedgerError(f"Missing {name}.")

    for name in (
        "photo_subtotal_cents",
        "service_fee_cents",
        "total_cents",
    ):
        value = getattr(order, name)

        if type(value) is not int or value < 0:
            raise EventSalesLedgerError(f"Invalid {name}.")

    if (
        order.total_cents
        != order.photo_subtotal_cents + order.service_fee_cents
    ):
        raise EventSalesLedgerError(
            "The order total does not match its breakdown."
        )

    commission_snapshot = {
        "pricing_subscription_id": order.pricing_subscription_id,
        "pricing_plan_code": order.pricing_plan_code,
        "pricing_plan_name": order.pricing_plan_name,
        "commission_bps": order.commission_bps,
        "commission_cents": order.commission_cents,
        "photographer_share_cents": order.photographer_share_cents,
        "platform_share_cents": order.platform_share_cents,
    }
    if any(value is not None for value in commission_snapshot.values()):
        if any(value is None for value in commission_snapshot.values()):
            raise EventSalesLedgerError("Incomplete saved commission snapshot.")
        if not isinstance(order.pricing_subscription_id, uuid.UUID):
            raise EventSalesLedgerError("Invalid saved subscription identifier.")
        if any(not isinstance(value, str) or not value.strip() for value in (order.pricing_plan_code, order.pricing_plan_name)):
            raise EventSalesLedgerError("Invalid saved plan identity.")
        try:
            expected_shares = calculate_event_commission(
                order.photo_subtotal_cents, order.commission_bps, order.service_fee_cents,
            )
        except ValueError as exc:
            raise EventSalesLedgerError("Invalid saved commission terms.") from exc
        for name, expected in expected_shares.items():
            if type(getattr(order, name)) is not int or getattr(order, name) != expected:
                raise EventSalesLedgerError(f"Invalid saved commission amount: {name}.")

    snapshot = {
        "order_id": order.id,
        "workspace_id": order.workspace_id,
        "order_number": order.order_number,
        "currency": order.currency,
        "payment_provider": order.payment_provider,
        "payment_reference": order.payment_reference,
        "photo_subtotal_cents": order.photo_subtotal_cents,
        "service_fee_cents": order.service_fee_cents,
        "total_cents": order.total_cents,
        "paid_at": order.paid_at,
        **commission_snapshot,
    }

    # Flush PAID in this transaction, then insert its matching receipt.
    # The caller rolls back both changes if any later step fails.
    db.flush()

    db.execute(
        insert(EventSalesPaymentLedger)
        .values(
            id=uuid.uuid4(),
            **snapshot,
            recorded_at=datetime.now(timezone.utc),
            provider_transaction_id=order.provider_transaction_id,
            source=source,
        )
        .on_conflict_do_nothing()
    )

    entry = db.scalar(
        select(EventSalesPaymentLedger)
        .where(EventSalesPaymentLedger.order_id == order.id)
        .execution_options(populate_existing=True)
    )

    if entry is None:
        raise EventSalesLedgerError(
            "The provider payment belongs to another order."
        )

    for name, expected in snapshot.items():
        if getattr(entry, name) != expected:
            raise EventSalesLedgerError(
                f"Existing ledger entry differs: {name}."
            )

    # Later callbacks do not rewrite the first immutable receipt.
    return entry