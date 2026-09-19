import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import TimestampMixin


class EventGallery(TimestampMixin, Base):
    __tablename__ = "event_galleries"

    __table_args__ = (
        UniqueConstraint(
            "workspace_id",
            "slug",
            name="uq_event_galleries_workspace_slug",
        ),
        CheckConstraint(
            "status IN ('DRAFT', 'LIVE', 'CLOSED')",
            name="ck_event_galleries_status",
        ),
        CheckConstraint(
            "price_per_photo_cents >= 0",
            name="ck_event_galleries_price_nonnegative",
        ),
        CheckConstraint(
            "bundle_quantity > 0",
            name="ck_event_galleries_bundle_quantity_positive",
        ),
        CheckConstraint(
            "bundle_price_cents >= 0",
            name="ck_event_galleries_bundle_price_nonnegative",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "workspaces.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    slug: Mapped[str] = mapped_column(
        String(120),
        nullable=False,
        index=True,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    event_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
        index=True,
    )

    location: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    # --------------------------------------------------
    # EVENT STATUS
    # --------------------------------------------------
    #
    # DRAFT
    #   Photographer is still preparing the event.
    #
    # LIVE
    #   Event is published and customers can search,
    #   browse and purchase photographs.
    #
    # CLOSED
    #   Event is no longer accepting new purchases.
    #
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="DRAFT",
        index=True,
    )

    # --------------------------------------------------
    # SEARCH EXPERIENCE
    # --------------------------------------------------

    allow_browse: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )

    allow_bib_search: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )

    allow_face_search: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )

    # --------------------------------------------------
    # PRICING
    # --------------------------------------------------
    #
    # Monetary values are stored as integer cents.
    #
    # Example:
    # RM10.00 = 1000 cents
    #
    price_per_photo_cents: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1000,
    )

    currency: Mapped[str] = mapped_column(
        String(3),
        nullable=False,
        default="MYR",
    )

    bundle_enabled: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )

    bundle_quantity: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=5,
    )

    bundle_price_cents: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=4000,
    )

    # Optional deadline for new purchases.
    sales_end_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )