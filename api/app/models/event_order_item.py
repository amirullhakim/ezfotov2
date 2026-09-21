import uuid

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    Integer,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import TimestampMixin


class EventOrderItem(TimestampMixin, Base):
    __tablename__ = "event_order_items"

    __table_args__ = (
        UniqueConstraint(
            "order_id",
            "photo_id",
            name="uq_event_order_items_order_photo",
        ),
        CheckConstraint(
            "unit_price_cents >= 0",
            name="ck_event_order_items_unit_price_nonnegative",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # --------------------------------------------------
    # OWNERSHIP
    # --------------------------------------------------

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "workspaces.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "event_galleries.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "event_orders.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    photo_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "event_photos.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    # --------------------------------------------------
    # PRICE SNAPSHOT
    # --------------------------------------------------
    #
    # This is the event's normal per-photo price at
    # the moment the order is created.
    #
    # Bundle discounts are stored at order level.
    #
    unit_price_cents: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )