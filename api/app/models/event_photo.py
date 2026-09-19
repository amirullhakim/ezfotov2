import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import TimestampMixin


class EventPhoto(TimestampMixin, Base):
    __tablename__ = "event_photos"

    __table_args__ = (
        CheckConstraint(
            (
                "status IN ("
                "'UPLOADED', "
                "'PROCESSING', "
                "'READY', "
                "'FAILED', "
                "'DELETED'"
                ")"
            ),
            name="ck_event_photos_status",
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

    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "event_galleries.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    # --------------------------------------------------
    # ORIGINAL PHOTO
    # --------------------------------------------------
    #
    # Original high-resolution photos live in
    # the PRIVATE R2 bucket.
    #
    # Example:
    #
    # workspaces/<workspace-id>/
    # events/<event-id>/
    # originals/<uuid>.jpg
    #
    original_object_key: Mapped[str] = mapped_column(
        String(1500),
        unique=True,
        nullable=False,
        index=True,
    )

    original_filename: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    content_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    size_bytes: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
    )

    width: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    height: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    # --------------------------------------------------
    # WATERMARKED PREVIEW
    # --------------------------------------------------
    #
    # This is generated later by the AI/media pipeline.
    #
    # The public event gallery must NEVER expose
    # original_object_key directly.
    #
    preview_object_key: Mapped[str | None] = mapped_column(
        String(1500),
        unique=True,
        nullable=True,
        index=True,
    )

    # --------------------------------------------------
    # DISPLAY
    # --------------------------------------------------

    sort_order: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    is_visible: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )

    # --------------------------------------------------
    # PROCESSING
    # --------------------------------------------------
    #
    # UPLOADED
    #   Original exists in R2 but AI processing has
    #   not started.
    #
    # PROCESSING
    #   Watermark / bib / OCR / face processing is
    #   running.
    #
    # READY
    #   Photo can appear in the public event gallery.
    #
    # FAILED
    #   Processing failed.
    #
    # DELETED
    #   Photo is no longer active.
    #
    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="UPLOADED",
        index=True,
    )

    processing_error: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    processed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )

    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )