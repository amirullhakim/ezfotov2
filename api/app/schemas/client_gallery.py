from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


GalleryPrivacyMode = Literal[
    "PUBLIC",
    "PRIVATE",
    "PASSWORD",
]


class ClientGalleryCreate(BaseModel):
    title: str = Field(
        min_length=1,
        max_length=255,
    )

    slug: str | None = Field(
        default=None,
        max_length=120,
    )

    client_name: str | None = Field(
        default=None,
        max_length=255,
    )

    description: str | None = None

    price_rm: Decimal | None = Field(default=None, ge=0, max_digits=10, decimal_places=2, allow_inf_nan=False)

    shoot_date: date | None = None

    privacy_mode: GalleryPrivacyMode = "PRIVATE"

    # Only used when privacy_mode = PASSWORD.
    # The raw password is never stored.
    password: str | None = Field(
        default=None,
        min_length=6,
        max_length=128,
    )

    allow_downloads: bool = True
    allow_favourites: bool = True

    is_published: bool = False

    expires_at: datetime | None = None


    show_on_website: bool = False

    @model_validator(mode="after")
    def validate_website_listing(self):
        if self.show_on_website and self.privacy_mode == "PRIVATE":
            raise ValueError("Private galleries cannot be listed on the website.")
        return self


class ClientGalleryUpdate(BaseModel):
    title: str | None = Field(
        default=None,
        min_length=1,
        max_length=255,
    )

    slug: str | None = Field(
        default=None,
        min_length=1,
        max_length=120,
    )

    client_name: str | None = Field(
        default=None,
        max_length=255,
    )

    description: str | None = None

    price_rm: Decimal | None = Field(default=None, ge=0, max_digits=10, decimal_places=2, allow_inf_nan=False)

    shoot_date: date | None = None

    privacy_mode: GalleryPrivacyMode | None = None

    password: str | None = Field(
        default=None,
        min_length=6,
        max_length=128,
    )

    # For a PRIVATE gallery, setting this true
    # generates a new secret share token.
    regenerate_private_link: bool = False

    allow_downloads: bool | None = None
    allow_favourites: bool | None = None

    is_published: bool | None = None

    expires_at: datetime | None = None

    show_on_website: bool | None = None

    @field_validator("show_on_website")
    @classmethod
    def reject_null_website_listing(cls, value: bool | None) -> bool:
        if value is None:
            raise ValueError("show_on_website cannot be null.")
        return value