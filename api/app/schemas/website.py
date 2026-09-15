import uuid
from decimal import Decimal

from pydantic import BaseModel, Field


class WebsiteSettingsUpdate(BaseModel):
    display_name: str | None = Field(
        default=None,
        max_length=255,
    )

    tagline: str | None = Field(
        default=None,
        max_length=255,
    )

    logo_url: str | None = None
    logo_media_asset_id: uuid.UUID | None = None

    favicon_url: str | None = None

    hero_title: str | None = Field(
        default=None,
        max_length=255,
    )

    hero_subtitle: str | None = None

    hero_image_url: str | None = None
    hero_media_asset_id: uuid.UUID | None = None

    hero_cta_text: str | None = Field(
        default="View Portfolio",
        max_length=100,
    )

    about_title: str | None = Field(
        default="About",
        max_length=255,
    )

    about_text: str | None = None

    about_image_url: str | None = None
    about_media_asset_id: uuid.UUID | None = None

    contact_email: str | None = Field(
        default=None,
        max_length=320,
    )

    contact_phone: str | None = Field(
        default=None,
        max_length=50,
    )

    location: str | None = Field(
        default=None,
        max_length=255,
    )

    instagram_url: str | None = None
    facebook_url: str | None = None
    tiktok_url: str | None = None

    primary_color: str = "#073B4C"
    accent_color: str = "#1CC9D8"

    template_key: str = "SIGNATURE"

    is_published: bool = False


class PortfolioItemCreate(BaseModel):
    title: str = Field(
        min_length=1,
        max_length=255,
    )

    category: str | None = Field(
        default=None,
        max_length=100,
    )

    description: str | None = None

    image_url: str

    media_asset_id: uuid.UUID | None = None

    sort_order: int = 0

    is_featured: bool = False

    is_visible: bool = True


class PhotographyPackageCreate(BaseModel):
    name: str = Field(
        min_length=1,
        max_length=255,
    )

    description: str | None = None

    price_rm: Decimal | None = None

    price_label: str | None = Field(
        default=None,
        max_length=100,
    )

    features_text: str | None = None

    sort_order: int = 0

    is_featured: bool = False

    is_visible: bool = True