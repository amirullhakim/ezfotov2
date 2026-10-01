from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger, SmallInteger, CheckConstraint, DateTime, ForeignKey, Index,
    String, UniqueConstraint, text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class EventSalesPaymentLedger(Base):
    __tablename__ = "event_sales_payment_ledger"

    __table_args__ = (
        CheckConstraint('(pricing_subscription_id IS NULL AND pricing_plan_code IS NULL AND pricing_plan_name IS NULL AND commission_bps IS NULL AND commission_cents IS NULL AND photographer_share_cents IS NULL AND platform_share_cents IS NULL) OR (pricing_subscription_id IS NOT NULL AND pricing_plan_code IS NOT NULL AND pricing_plan_name IS NOT NULL AND commission_bps IS NOT NULL AND commission_cents IS NOT NULL AND photographer_share_cents IS NOT NULL AND platform_share_cents IS NOT NULL AND length(trim(pricing_plan_code)) > 0 AND length(trim(pricing_plan_name)) > 0 AND commission_bps BETWEEN 0 AND 10000 AND commission_cents >= 0 AND photographer_share_cents >= 0 AND platform_share_cents >= 0 AND commission_cents = floor((photo_subtotal_cents::numeric * commission_bps + 5000) / 10000) AND photographer_share_cents = photo_subtotal_cents - commission_cents AND platform_share_cents = commission_cents + service_fee_cents AND photographer_share_cents + platform_share_cents = total_cents)', name="ck_espl_commission_snapshot"),
        UniqueConstraint("order_id", name="uq_espl_order"),
        UniqueConstraint(
            "payment_provider", "payment_reference",
            name="uq_espl_provider_reference",
        ),
        CheckConstraint(
            "photo_subtotal_cents >= 0 AND service_fee_cents >= 0 "
            "AND total_cents >= 0", name="ck_espl_amounts_nonnegative",
        ),
        CheckConstraint(
            "total_cents = photo_subtotal_cents + service_fee_cents",
            name="ck_espl_total_matches_breakdown",
        ),
        CheckConstraint("currency ~ '^[A-Z]{3}$'", name="ck_espl_currency"),
        CheckConstraint(
            "length(trim(payment_provider)) > 0 "
            "AND length(trim(payment_reference)) > 0 "
            "AND length(trim(order_number)) > 0",
            name="ck_espl_references_nonempty",
        ),
        CheckConstraint(
            "source IN ('WEBHOOK', 'RECONCILIATION', 'BACKFILL')",
            name="ck_espl_source",
        ),
        Index("ix_espl_workspace_paid_at", "workspace_id", "paid_at"),
        Index("ix_espl_paid_at", "paid_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("event_orders.id", ondelete="RESTRICT", name="fk_espl_order"),
        nullable=False,
    )
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="RESTRICT", name="fk_espl_workspace"),
        nullable=False,
    )
    order_number: Mapped[str] = mapped_column(String(40), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    payment_provider: Mapped[str] = mapped_column(String(50), nullable=False)
    payment_reference: Mapped[str] = mapped_column(String(255), nullable=False)
    provider_transaction_id: Mapped[str | None] = mapped_column(String(255))
    photo_subtotal_cents: Mapped[int] = mapped_column(BigInteger, nullable=False)
    service_fee_cents: Mapped[int] = mapped_column(BigInteger, nullable=False)
    total_cents: Mapped[int] = mapped_column(BigInteger, nullable=False)
    paid_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False,
    )
    source: Mapped[str] = mapped_column(String(20), nullable=False)


    pricing_subscription_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("workspace_subscriptions.id", ondelete="RESTRICT", name="fk_espl_pricing_subscription"), nullable=True)

    pricing_plan_code: Mapped[str | None] = mapped_column(String(80), nullable=True)

    pricing_plan_name: Mapped[str | None] = mapped_column(String(100), nullable=True)

    commission_bps: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)

    commission_cents: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    photographer_share_cents: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    platform_share_cents: Mapped[int | None] = mapped_column(BigInteger, nullable=True)