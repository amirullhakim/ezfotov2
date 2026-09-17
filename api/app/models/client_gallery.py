import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import TimestampMixin


class ClientGallery(TimestampMixin, Base):
    __tablename__ = "client_galleries"

    __table_args__ = (
        UniqueConstraint(
            "workspace_id",
            "slug",
            name="uq_client_galleries_workspace_slug",
        ),
        CheckConstraint(
            "privacy_mode IN ('PUBLIC', 'PRIVATE', 'PASSWORD')",
            name="ck_client_galleries_privacy_mode",
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

    client_name: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    shoot_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )

    privacy_mode: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="PRIVATE",
        index=True,
    )

    # Used only when privacy_mode = PASSWORD.
    # Never store the actual gallery password.
    password_hash: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    # Used for PRIVATE galleries.
    # Only the hash of the secret link token is stored.
    access_token_hash: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    allow_downloads: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )

    allow_favourites: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )

    is_published: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        index=True,
    )

    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )

    # --------------------------------------------------
    # TRASH / RECOVERY
    # --------------------------------------------------
    #
    # null = normal gallery
    # timestamp = gallery is in Trash
    #
    # The actual R2 objects are NOT deleted until
    # permanent deletion.
    #
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )