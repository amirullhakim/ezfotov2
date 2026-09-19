from datetime import date, datetime
from typing import Literal

from pydantic import (
    BaseModel,
    Field,
    field_validator,
)


EventSaleStatus = Literal[
    "DRAFT",
    "LIVE",
    "CLOSED",
]


class EventSaleCreate(BaseModel):
    title: str = Field(
        min_length=1,
        max_length=255,
    )

    slug: str | None = Field(
        default=None,
        max_length=120,
    )

    description: str | None = None

    event_date: date | None = None

    location: str | None = Field(
        default=None,
        max_length=255,
    )

    status: EventSaleStatus = "DRAFT"

    allow_browse: bool = True
    allow_bib_search: bool = True
    allow_face_search: bool = True

    price_per_photo_cents: int = Field(
        default=1000,
        ge=0,
    )

    currency: Literal["MYR"] = "MYR"

    bundle_enabled: bool = False

    bundle_quantity: int = Field(
        default=5,
        gt=0,
    )

    bundle_price_cents: int = Field(
        default=4000,
        ge=0,
    )

    sales_end_at: datetime | None = None


    @field_validator("title")
    @classmethod
    def validate_title(
        cls,
        value: str,
    ) -> str:
        cleaned = value.strip()

        if not cleaned:
            raise ValueError(
                "Event title cannot be empty."
            )

        return cleaned


    @field_validator("slug")
    @classmethod
    def validate_slug(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None:
            return None

        cleaned = value.strip()

        return cleaned or None


    @field_validator(
        "description",
        "location",
    )
    @classmethod
    def clean_optional_text(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None:
            return None

        cleaned = value.strip()

        return cleaned or None


    @field_validator("sales_end_at")
    @classmethod
    def validate_sales_end_at(
        cls,
        value: datetime | None,
    ) -> datetime | None:
        if value is None:
            return None

        if (
            value.tzinfo is None
            or value.utcoffset() is None
        ):
            raise ValueError(
                "sales_end_at must include a timezone."
            )

        return value


    model_config = {
        "extra": "forbid",
    }


class EventSaleUpdate(BaseModel):
    title: str | None = Field(
        default=None,
        min_length=1,
        max_length=255,
    )

    slug: str | None = Field(
        default=None,
        max_length=120,
    )

    description: str | None = None

    event_date: date | None = None

    location: str | None = Field(
        default=None,
        max_length=255,
    )

    status: EventSaleStatus | None = None

    allow_browse: bool | None = None
    allow_bib_search: bool | None = None
    allow_face_search: bool | None = None

    price_per_photo_cents: int | None = Field(
        default=None,
        ge=0,
    )

    currency: Literal["MYR"] | None = None

    bundle_enabled: bool | None = None

    bundle_quantity: int | None = Field(
        default=None,
        gt=0,
    )

    bundle_price_cents: int | None = Field(
        default=None,
        ge=0,
    )

    sales_end_at: datetime | None = None


    @field_validator("title")
    @classmethod
    def validate_title(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None:
            return None

        cleaned = value.strip()

        if not cleaned:
            raise ValueError(
                "Event title cannot be empty."
            )

        return cleaned


    @field_validator("slug")
    @classmethod
    def validate_slug(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None:
            return None

        cleaned = value.strip()

        return cleaned or None


    @field_validator(
        "description",
        "location",
    )
    @classmethod
    def clean_optional_text(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None:
            return None

        cleaned = value.strip()

        return cleaned or None


    @field_validator("sales_end_at")
    @classmethod
    def validate_sales_end_at(
        cls,
        value: datetime | None,
    ) -> datetime | None:
        if value is None:
            return None

        if (
            value.tzinfo is None
            or value.utcoffset() is None
        ):
            raise ValueError(
                "sales_end_at must include a timezone."
            )

        return value


    model_config = {
        "extra": "forbid",
    }