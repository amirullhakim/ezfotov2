import uuid

from sqlalchemy import (
    ForeignKey,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import TimestampMixin


class GalleryFavourite(TimestampMixin, Base):
    __tablename__ = "gallery_favourites"

    __table_args__ = (
        UniqueConstraint(
            "photo_id",
            "visitor_token",
            name="uq_gallery_favourites_photo_visitor",
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

    gallery_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "client_galleries.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    photo_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "gallery_photos.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    # Anonymous client identifier stored in
    # the visitor's browser/cookie later.
    visitor_token: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
    )