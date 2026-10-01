import uuid
from datetime import datetime
from sqlalchemy import BigInteger, Boolean, CheckConstraint, DateTime, ForeignKeyConstraint, Index, Integer, PrimaryKeyConstraint, SmallInteger, String, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base
from app.models.mixins import TimestampMixin, utc_now


class WorkspaceSubscription(TimestampMixin, Base):
    __tablename__ = 'workspace_subscriptions'
    __table_args__ = (
        PrimaryKeyConstraint('id', name='pk_workspace_subscriptions'),
        ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], ondelete='RESTRICT', name='fk_workspace_subscriptions_workspace'),
        ForeignKeyConstraint(['service_id'], ['services.id'], ondelete='RESTRICT', name='fk_workspace_subscriptions_service'),
        ForeignKeyConstraint(['plan_id', 'service_id'], ['service_plans.id', 'service_plans.service_id'], ondelete='RESTRICT', name='fk_workspace_subscriptions_plan_service'),
        UniqueConstraint('workspace_id', 'service_id', name='uq_workspace_subscriptions_workspace_service'),
        UniqueConstraint('id', 'workspace_id', 'service_id', name='uq_ws_subscription_identity'),
        CheckConstraint("status IN ('PENDING', 'ACTIVE', 'EXPIRED', 'CANCELED')", name='ck_workspace_subscriptions_status'),
        CheckConstraint('price_cents >= 0 AND customer_service_fee_cents >= 0', name='ck_workspace_subscriptions_amounts'),
        CheckConstraint('commission_bps BETWEEN 0 AND 10000', name='ck_workspace_subscriptions_commission'),
        CheckConstraint('billing_interval_months IN (1, 12)', name='ck_workspace_subscriptions_interval'),
        CheckConstraint('storage_limit_bytes IS NULL OR storage_limit_bytes > 0', name='ck_workspace_subscriptions_storage'),
        CheckConstraint('active_event_limit IS NULL OR active_event_limit > 0', name='ck_workspace_subscriptions_event_limit'),
        CheckConstraint("currency ~ '^[A-Z]{3}$'", name='ck_workspace_subscriptions_currency'),
        CheckConstraint('length(trim(plan_code_snapshot)) > 0 AND length(trim(plan_name_snapshot)) > 0', name='ck_workspace_subscriptions_names'),
        CheckConstraint('(current_period_start IS NULL AND current_period_end IS NULL) OR (current_period_start IS NOT NULL AND current_period_end IS NOT NULL AND current_period_end > current_period_start)', name='ck_workspace_subscriptions_period'),
        CheckConstraint("status <> 'ACTIVE' OR (current_period_start IS NOT NULL AND current_period_end IS NOT NULL)", name='ck_workspace_subscriptions_active_period'),
        Index('ix_workspace_subscriptions_service', 'service_id'),
        Index('ix_workspace_subscriptions_plan_service', 'plan_id', 'service_id'),
        Index('ix_workspace_subscriptions_status_end', 'status', 'current_period_end'),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), default=uuid.uuid4, nullable=False)
    workspace_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    service_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    plan_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default='PENDING', server_default=text("'PENDING'"), nullable=False)
    plan_code_snapshot: Mapped[str] = mapped_column(String(80), nullable=False)
    plan_name_snapshot: Mapped[str] = mapped_column(String(100), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    price_cents: Mapped[int] = mapped_column(BigInteger(), nullable=False)
    billing_interval_months: Mapped[int] = mapped_column(SmallInteger(), nullable=False)
    commission_bps: Mapped[int] = mapped_column(SmallInteger(), nullable=False)
    customer_service_fee_cents: Mapped[int] = mapped_column(BigInteger(), nullable=False)
    storage_limit_bytes: Mapped[int | None] = mapped_column(BigInteger(), nullable=True)
    active_event_limit: Mapped[int | None] = mapped_column(Integer(), nullable=True)
    includes_website: Mapped[bool] = mapped_column(Boolean(), nullable=False)
    current_period_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancel_at_period_end: Mapped[bool] = mapped_column(Boolean(), default=False, server_default=text('false'), nullable=False)
    canceled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, server_default=text('now()'), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, server_default=text('now()'), nullable=False)
