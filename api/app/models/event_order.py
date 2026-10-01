import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    SmallInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import TimestampMixin


class EventOrder(TimestampMixin, Base):
    __tablename__ = "event_orders"

    __table_args__ = (
        CheckConstraint('(pricing_subscription_id IS NULL AND pricing_plan_code IS NULL AND pricing_plan_name IS NULL AND commission_bps IS NULL AND commission_cents IS NULL AND photographer_share_cents IS NULL AND platform_share_cents IS NULL) OR (pricing_subscription_id IS NOT NULL AND pricing_plan_code IS NOT NULL AND pricing_plan_name IS NOT NULL AND commission_bps IS NOT NULL AND commission_cents IS NOT NULL AND photographer_share_cents IS NOT NULL AND platform_share_cents IS NOT NULL AND length(trim(pricing_plan_code)) > 0 AND length(trim(pricing_plan_name)) > 0 AND commission_bps BETWEEN 0 AND 10000 AND commission_cents >= 0 AND photographer_share_cents >= 0 AND platform_share_cents >= 0 AND commission_cents = floor((photo_subtotal_cents::numeric * commission_bps + 5000) / 10000) AND photographer_share_cents = photo_subtotal_cents - commission_cents AND platform_share_cents = commission_cents + service_fee_cents AND photographer_share_cents + platform_share_cents = total_cents)', name="ck_eo_commission_snapshot"),
        CheckConstraint(
            (
                "status IN ("
                "'PENDING_PAYMENT', "
                "'PAID', "
                "'PAYMENT_FAILED', "
                "'CANCELLED', "
                "'EXPIRED', "
                "'REFUNDED'"
                ")"
            ),
            name="ck_event_orders_status",
        ),
        CheckConstraint(
            "item_count > 0",
            name="ck_event_orders_item_count_positive",
        ),
        CheckConstraint(
            "unit_price_cents >= 0",
            name="ck_event_orders_unit_price_nonnegative",
        ),
        CheckConstraint(
            "regular_subtotal_cents >= 0",
            name="ck_event_orders_subtotal_nonnegative",
        ),
        CheckConstraint(
            "discount_cents >= 0",
            name="ck_event_orders_discount_nonnegative",
        ),
        CheckConstraint(
            "photo_subtotal_cents >= 0",
            name="ck_event_orders_photo_subtotal_nonnegative",
        ),
        CheckConstraint(
            "service_fee_cents >= 0",
            name="ck_event_orders_service_fee_nonnegative",
        ),
        CheckConstraint(
            "total_cents >= 0",
            name="ck_event_orders_total_nonnegative",
        ),
        CheckConstraint(
            "total_cents = photo_subtotal_cents + service_fee_cents",
            name="ck_event_orders_total_matches_breakdown",
        ),
        CheckConstraint(
            "bundle_quantity >= 0",
            name="ck_event_orders_bundle_quantity_nonnegative",
        ),
        CheckConstraint(
            "bundle_price_cents >= 0",
            name="ck_event_orders_bundle_price_nonnegative",
        ),
        CheckConstraint(
            "bundle_count >= 0",
            name="ck_event_orders_bundle_count_nonnegative",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("event_galleries.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    order_number: Mapped[str] = mapped_column(
        String(40),
        nullable=False,
        unique=True,
        index=True,
    )

    customer_name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    customer_email: Mapped[str] = mapped_column(
        String(320),
        nullable=False,
        index=True,
    )

    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="PENDING_PAYMENT",
        index=True,
    )

    currency: Mapped[str] = mapped_column(
        String(3),
        nullable=False,
        default="MYR",
    )

    item_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    unit_price_cents: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    regular_subtotal_cents: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    discount_cents: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    photo_subtotal_cents: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    service_fee_cents: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    total_cents: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    bundle_quantity: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    bundle_price_cents: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    bundle_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    payment_provider: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )

    payment_reference: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        index=True,
    )

    provider_transaction_id: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        index=True,
    )

    paid_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )

    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )

    confirmation_email_sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    confirmation_email_claimed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    confirmation_email_attempts: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    pricing_subscription_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("workspace_subscriptions.id", ondelete="RESTRICT", name="fk_eo_pricing_subscription"), nullable=True)

    pricing_plan_code: Mapped[str | None] = mapped_column(String(80), nullable=True)

    pricing_plan_name: Mapped[str | None] = mapped_column(String(100), nullable=True)

    commission_bps: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)

    commission_cents: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    photographer_share_cents: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    platform_share_cents: Mapped[int | None] = mapped_column(BigInteger, nullable=True)