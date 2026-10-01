import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger, Boolean, CheckConstraint, DateTime, ForeignKeyConstraint,
    Index, Integer, PrimaryKeyConstraint, SmallInteger, String, Text,
    UniqueConstraint, text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import TimestampMixin, utc_now


class SubscriptionBillingOrder(TimestampMixin, Base):
    __tablename__ = "subscription_billing_orders"

    __table_args__ = (
        PrimaryKeyConstraint('id', name='pk_sbo'),
        ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], ondelete='RESTRICT', name='fk_sbo_workspace'),
        ForeignKeyConstraint(['service_id'], ['services.id'], ondelete='RESTRICT', name='fk_sbo_service'),
        ForeignKeyConstraint(['plan_id', 'service_id'], ['service_plans.id', 'service_plans.service_id'], ondelete='RESTRICT', name='fk_sbo_plan_service'),
        ForeignKeyConstraint(['subscription_id', 'workspace_id', 'service_id'], ['workspace_subscriptions.id', 'workspace_subscriptions.workspace_id', 'workspace_subscriptions.service_id'], ondelete='RESTRICT', name='fk_sbo_subscription_identity'),
        ForeignKeyConstraint(['created_by_profile_id'], ['profiles.id'], ondelete='RESTRICT', name='fk_sbo_creator'),
        UniqueConstraint('order_number', name='uq_sbo_order_number'),
        UniqueConstraint('workspace_id', 'idempotency_key', name='uq_sbo_idempotency'),
        UniqueConstraint('payment_provider', 'payment_reference', name='uq_sbo_provider_reference'),
        CheckConstraint("status IN ('PENDING_PAYMENT', 'PAID', 'PAYMENT_FAILED', 'CANCELLED', 'EXPIRED', 'REFUNDED')", name='ck_sbo_status'),
        CheckConstraint('price_cents > 0 AND total_cents = price_cents AND customer_service_fee_cents >= 0', name='ck_sbo_amounts'),
        CheckConstraint('commission_bps BETWEEN 0 AND 10000', name='ck_sbo_commission'),
        CheckConstraint('billing_interval_months IN (1, 12)', name='ck_sbo_interval'),
        CheckConstraint("currency ~ '^[A-Z]{3}$'", name='ck_sbo_currency'),
        CheckConstraint('storage_limit_bytes IS NULL OR storage_limit_bytes > 0', name='ck_sbo_storage'),
        CheckConstraint('active_event_limit IS NULL OR active_event_limit > 0', name='ck_sbo_event_limit'),
        CheckConstraint('length(trim(order_number)) > 0 AND length(trim(payer_email)) > 0 AND length(trim(plan_code_snapshot)) > 0 AND length(trim(plan_name_snapshot)) > 0 AND length(trim(payment_provider)) > 0', name='ck_sbo_labels'),
        CheckConstraint('payment_reference IS NULL OR length(trim(payment_reference)) > 0', name='ck_sbo_reference'),
        CheckConstraint('expires_at > created_at', name='ck_sbo_expiry'),
        CheckConstraint("(paid_at IS NULL AND status NOT IN ('PAID', 'REFUNDED')) OR (paid_at IS NOT NULL AND status IN ('PAID', 'REFUNDED') AND payment_reference IS NOT NULL)", name='ck_sbo_payment_state'),
        CheckConstraint('(period_start IS NULL AND period_end IS NULL) OR (period_start IS NOT NULL AND period_end IS NOT NULL AND period_end > period_start)', name='ck_sbo_period'),
        CheckConstraint('activated_at IS NULL OR (paid_at IS NOT NULL AND subscription_id IS NOT NULL AND period_start IS NOT NULL AND period_end IS NOT NULL)', name='ck_sbo_activation'),
        Index('ix_sbo_workspace_created', 'workspace_id', 'created_at'),
        Index('ix_sbo_service', 'service_id'),
        Index('ix_sbo_plan_service', 'plan_id', 'service_id'),
        Index('ix_sbo_subscription', 'subscription_id'),
        Index('ix_sbo_creator', 'created_by_profile_id'),
        Index('ix_sbo_status_expiry', 'status', 'expires_at'),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), default=uuid.uuid4, nullable=False)
    workspace_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    service_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    plan_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    subscription_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_by_profile_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    idempotency_key: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    order_number: Mapped[str] = mapped_column(String(40), nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="PENDING_PAYMENT", server_default=text("'PENDING_PAYMENT'"), nullable=False)
    payer_email: Mapped[str] = mapped_column(String(320), nullable=False)
    plan_code_snapshot: Mapped[str] = mapped_column(String(80), nullable=False)
    plan_name_snapshot: Mapped[str] = mapped_column(String(100), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    price_cents: Mapped[int] = mapped_column(BigInteger(), nullable=False)
    total_cents: Mapped[int] = mapped_column(BigInteger(), nullable=False)
    billing_interval_months: Mapped[int] = mapped_column(SmallInteger(), nullable=False)
    commission_bps: Mapped[int] = mapped_column(SmallInteger(), nullable=False)
    customer_service_fee_cents: Mapped[int] = mapped_column(BigInteger(), nullable=False)
    storage_limit_bytes: Mapped[int | None] = mapped_column(BigInteger(), nullable=True)
    active_event_limit: Mapped[int | None] = mapped_column(Integer(), nullable=True)
    includes_website: Mapped[bool] = mapped_column(Boolean(), nullable=False)
    payment_provider: Mapped[str] = mapped_column(String(50), default="CHIP", server_default=text("'CHIP'"), nullable=False)
    payment_reference: Mapped[str | None] = mapped_column(String(255), nullable=True)
    checkout_url: Mapped[str | None] = mapped_column(Text(), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    activated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    period_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, server_default=text('now()'), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, server_default=text('now()'), nullable=False)