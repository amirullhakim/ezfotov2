import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKeyConstraint,
    Index,
    Integer,
    PrimaryKeyConstraint,
    SmallInteger,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import TimestampMixin, utc_now


class ServicePlan(TimestampMixin, Base):
    __tablename__ = "service_plans"

    __table_args__ = (
        PrimaryKeyConstraint("id", name="pk_service_plans"),
        ForeignKeyConstraint(
            ["service_id"],
            ["services.id"],
            ondelete="RESTRICT",
            name="fk_service_plans_service",
        ),
        UniqueConstraint("code", name="uq_service_plans_code"),
        UniqueConstraint(
            "id", "service_id",
            name="uq_service_plans_id_service",
        ),
        CheckConstraint(
            "price_cents >= 0 AND customer_service_fee_cents >= 0",
            name="ck_service_plans_amounts",
        ),
        CheckConstraint(
            "commission_bps BETWEEN 0 AND 10000",
            name="ck_service_plans_commission",
        ),
        CheckConstraint(
            "billing_interval_months IN (1, 12)",
            name="ck_service_plans_interval",
        ),
        CheckConstraint(
            "storage_limit_bytes IS NULL OR storage_limit_bytes > 0",
            name="ck_service_plans_storage",
        ),
        CheckConstraint(
            "active_event_limit IS NULL OR active_event_limit > 0",
            name="ck_service_plans_event_limit",
        ),
        CheckConstraint(
            "currency ~ '^[A-Z]{3}$'",
            name="ck_service_plans_currency",
        ),
        CheckConstraint(
            "length(trim(code)) > 0 AND length(trim(name)) > 0",
            name="ck_service_plans_names",
        ),
        Index(
            "ix_service_plans_service_active",
            "service_id", "is_active",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        default=uuid.uuid4,
        nullable=False,
    )

    service_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
    )

    code: Mapped[str] = mapped_column(
        String(80),
        nullable=False,
    )

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    currency: Mapped[str] = mapped_column(
        String(3),
        nullable=False,
    )

    price_cents: Mapped[int] = mapped_column(
        BigInteger(),
        nullable=False,
    )

    billing_interval_months: Mapped[int] = mapped_column(
        SmallInteger(),
        nullable=False,
    )

    commission_bps: Mapped[int] = mapped_column(
        SmallInteger(),
        nullable=False,
    )

    customer_service_fee_cents: Mapped[int] = mapped_column(
        BigInteger(),
        nullable=False,
    )

    storage_limit_bytes: Mapped[int | None] = mapped_column(
        BigInteger(),
        nullable=True,
    )

    active_event_limit: Mapped[int | None] = mapped_column(
        Integer(),
        nullable=True,
    )

    includes_website: Mapped[bool] = mapped_column(
        Boolean(),
        default=False,
        server_default=text("false"),
        nullable=False,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean(),
        default=True,
        server_default=text("true"),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        server_default=text("now()"),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        server_default=text("now()"),
        nullable=False,
    )