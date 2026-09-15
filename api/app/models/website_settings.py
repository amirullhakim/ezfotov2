import uuid

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import TimestampMixin


class WebsiteSettings(TimestampMixin, Base):
    __tablename__ = "website_settings"

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
        unique=True,
        nullable=False,
        index=True,
    )

    # --------------------------------------------------
    # Media references
    # --------------------------------------------------
    logo_media_asset_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "media_assets.id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    hero_media_asset_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "media_assets.id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    about_media_asset_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "media_assets.id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    # --------------------------------------------------
    # Brand
    # --------------------------------------------------
    display_name: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    tagline: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    logo_url: Mapped[str | None] = mapped_column(
        String(1000),
        nullable=True,
    )

    favicon_url: Mapped[str | None] = mapped_column(
        String(1000),
        nullable=True,
    )

    # --------------------------------------------------
    # Hero
    # --------------------------------------------------
    hero_title: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    hero_subtitle: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    hero_image_url: Mapped[str | None] = mapped_column(
        String(1000),
        nullable=True,
    )

    hero_cta_text: Mapped[str | None] = mapped_column(
        String(100),
        default="View Portfolio",
        nullable=True,
    )

    # --------------------------------------------------
    # About
    # --------------------------------------------------
    about_title: Mapped[str | None] = mapped_column(
        String(255),
        default="About",
        nullable=True,
    )

    about_text: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    about_image_url: Mapped[str | None] = mapped_column(
        String(1000),
        nullable=True,
    )

    # --------------------------------------------------
    # Contact
    # --------------------------------------------------
    contact_email: Mapped[str | None] = mapped_column(
        String(320),
        nullable=True,
    )

    contact_phone: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )

    location: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    instagram_url: Mapped[str | None] = mapped_column(
        String(1000),
        nullable=True,
    )

    facebook_url: Mapped[str | None] = mapped_column(
        String(1000),
        nullable=True,
    )

    tiktok_url: Mapped[str | None] = mapped_column(
        String(1000),
        nullable=True,
    )

    # --------------------------------------------------
    # Theme
    # --------------------------------------------------
    primary_color: Mapped[str] = mapped_column(
        String(20),
        default="#073B4C",
        nullable=False,
    )

    accent_color: Mapped[str] = mapped_column(
        String(20),
        default="#1CC9D8",
        nullable=False,
    )

    template_key: Mapped[str] = mapped_column(
        String(50),
        default="SIGNATURE",
        nullable=False,
    )

    # --------------------------------------------------
    # Visibility
    # --------------------------------------------------
    is_published: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    workspace = relationship(
        "Workspace",
        back_populates="website_settings",
    )