import uuid
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator, model_validator


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

    price_rm: Decimal | None = Field(default=None, ge=0, max_digits=10, decimal_places=2, allow_inf_nan=False)

    price_label: str | None = Field(
        default=None,
        max_length=100,
    )

    features_text: str | None = None

    sort_order: int = 0

    is_featured: bool = False

    is_visible: bool = True

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Package name cannot be blank.")
        return value

    @field_validator("price_label")
    @classmethod
    def normalize_price_label(cls, value: str | None) -> str | None:
        return value.strip() or None if value is not None else None


class PhotographyPackageUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    price_rm: Decimal | None = Field(default=None, ge=0, max_digits=10, decimal_places=2, allow_inf_nan=False)
    price_label: str | None = Field(default=None, max_length=100)
    features_text: str | None = None
    sort_order: int | None = None
    is_featured: bool | None = None
    is_visible: bool | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str | None) -> str | None:
        if value is not None:
            value = value.strip()
            if not value:
                raise ValueError("Package name cannot be blank.")
        return value

    @field_validator("price_label")
    @classmethod
    def normalize_price_label(cls, value: str | None) -> str | None:
        return value.strip() or None if value is not None else None

    @model_validator(mode="after")
    def reject_null_required_fields(self):
        for field in ("name", "sort_order", "is_featured", "is_visible"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null.")
        return self