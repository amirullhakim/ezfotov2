from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class EventSalesPaymentLedger(Base):
    __tablename__ = "event_sales_payment_ledger"

    __table_args__ = (
        UniqueConstraint(
            "order_id",
            name="uq_espl_order",
        ),
        UniqueConstraint(
            "payment_provider",
            "payment_reference",
            name="uq_espl_provider_reference",
        ),
        CheckConstraint(
            "photo_subtotal_cents >= 0 AND service_fee_cents >= 0 "
            "AND total_cents >= 0",
            name="ck_espl_amounts_nonnegative",
        ),
        CheckConstraint(
            "total_cents = photo_subtotal_cents + service_fee_cents",
            name="ck_espl_total_matches_breakdown",
        ),
        CheckConstraint(
            "currency ~ '^[A-Z]{3}$'",
            name="ck_espl_currency",
        ),
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
        Index(
            "ix_espl_workspace_paid_at",
            "workspace_id",
            "paid_at",
        ),
        Index(
            "ix_espl_paid_at",
            "paid_at",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "event_orders.id",
            ondelete="RESTRICT",
            name="fk_espl_order",
        ),
        nullable=False,
    )

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "workspaces.id",
            ondelete="RESTRICT",
            name="fk_espl_workspace",
        ),
        nullable=False,
    )

    order_number: Mapped[str] = mapped_column(
        String(40),
        nullable=False,
    )

    currency: Mapped[str] = mapped_column(
        String(3),
        nullable=False,
    )

    payment_provider: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    payment_reference: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    provider_transaction_id: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    photo_subtotal_cents: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
    )

    service_fee_cents: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
    )

    total_cents: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
    )

    paid_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )

    source: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )