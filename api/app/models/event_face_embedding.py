import uuid

from sqlalchemy import (
    ARRAY,
    CheckConstraint,
    Float,
    ForeignKey,
    Index,
    Integer,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import TimestampMixin


class EventFaceEmbedding(
    TimestampMixin,
    Base,
):
    __tablename__ = "event_face_embeddings"

    __table_args__ = (
        CheckConstraint(
            "face_index >= 0",
            name=(
                "ck_event_face_embeddings_"
                "face_index_nonnegative"
            ),
        ),

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
                "ck_event_face_embeddings_"
                "detection_confidence"
            ),
        ),

        Index(
            "ix_event_face_embeddings_"
            "event_photo",
            "event_id",
            "photo_id",
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


    face_index: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )


    embedding: Mapped[
        list[float]
    ] = mapped_column(
        ARRAY(Float),
        nullable=False,
    )


    detection_confidence: Mapped[
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