import uuid

from sqlalchemy import (
    CheckConstraint,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import TimestampMixin


class EventBibDetection(
    TimestampMixin,
    Base,
):
    __tablename__ = "event_bib_detections"

    __table_args__ = (
        CheckConstraint(
            (
                "detection_confidence "
                "IS NULL "
                "OR "
                "("
                "detection_confidence >= 0 "
                "AND "
                "detection_confidence <= 1"
                ")"
            ),
            name=(
                "ck_event_bib_detections_"
                "detection_confidence"
            ),
        ),

        CheckConstraint(
            (
                "ocr_confidence "
                "IS NULL "
                "OR "
                "("
                "ocr_confidence >= 0 "
                "AND "
                "ocr_confidence <= 1"
                ")"
            ),
            name=(
                "ck_event_bib_detections_"
                "ocr_confidence"
            ),
        ),

        Index(
            "ix_event_bib_detections_"
            "event_bib",
            "event_id",
            "bib_number",
        ),

        Index(
            "ix_event_bib_detections_"
            "photo_bib",
            "photo_id",
            "bib_number",
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


    photo_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "event_photos.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )


    bib_number: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )


    raw_text: Mapped[
        str | None
    ] = mapped_column(
        String(100),
        nullable=True,
    )


    detection_confidence: Mapped[
        float | None
    ] = mapped_column(
        Float,
        nullable=True,
    )


    ocr_confidence: Mapped[
        float | None
    ] = mapped_column(
        Float,
        nullable=True,
    )


    bbox_x1: Mapped[
        int | None
    ] = mapped_column(
        Integer,
        nullable=True,
    )


    bbox_y1: Mapped[
        int | None
    ] = mapped_column(
        Integer,
        nullable=True,
    )


    bbox_x2: Mapped[
        int | None
    ] = mapped_column(
        Integer,
        nullable=True,
    )


    bbox_y2: Mapped[
        int | None
    ] = mapped_column(
        Integer,
        nullable=True,
    )