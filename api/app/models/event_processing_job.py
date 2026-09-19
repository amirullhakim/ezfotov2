import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import TimestampMixin


class EventProcessingJob(
    TimestampMixin,
    Base,
):
    __tablename__ = "event_processing_jobs"

    __table_args__ = (
        CheckConstraint(
            (
                "status IN ("
                "'QUEUED', "
                "'PROCESSING', "
                "'COMPLETED', "
                "'FAILED', "
                "'CANCELLED'"
                ")"
            ),
            name=(
                "ck_event_processing_jobs_"
                "status"
            ),
        ),

        CheckConstraint(
            "total_files >= 0",
            name=(
                "ck_event_processing_jobs_"
                "total_files_nonnegative"
            ),
        ),

        CheckConstraint(
            "processed_files >= 0",
            name=(
                "ck_event_processing_jobs_"
                "processed_files_nonnegative"
            ),
        ),

        CheckConstraint(
            "ready_files >= 0",
            name=(
                "ck_event_processing_jobs_"
                "ready_files_nonnegative"
            ),
        ),

        CheckConstraint(
            "failed_files >= 0",
            name=(
                "ck_event_processing_jobs_"
                "failed_files_nonnegative"
            ),
        ),

        Index(
            "ix_event_processing_jobs_"
            "event_status",
            "event_id",
            "status",
        ),

        Index(
            "uq_event_processing_jobs_"
            "active_event",
            "event_id",
            unique=True,
            postgresql_where=text(
                "status IN "
                "('QUEUED', 'PROCESSING')"
            ),
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


    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="QUEUED",
        index=True,
    )


    total_files: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )


    processed_files: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )


    ready_files: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )


    failed_files: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )


    current_photo_id: Mapped[
        uuid.UUID | None
    ] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "event_photos.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )


    current_filename: Mapped[
        str | None
    ] = mapped_column(
        String(255),
        nullable=True,
    )


    message: Mapped[
        str | None
    ] = mapped_column(
        Text,
        nullable=True,
    )


    cancel_requested: Mapped[bool] = (
        mapped_column(
            Boolean,
            nullable=False,
            default=False,
        )
    )


    started_at: Mapped[
        datetime | None
    ] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )


    completed_at: Mapped[
        datetime | None
    ] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )