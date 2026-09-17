from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field


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