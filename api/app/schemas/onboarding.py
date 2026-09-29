import re

from pydantic import BaseModel, Field, field_validator


SLUG_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")

RESERVED_SLUGS = {
    "www",
    "app",
    "api",
    "admin",
    "dashboard",
    "support",
    "help",
    "mail",
    "status",
    "blog",
    "auth",
    "login",
    "register",
    "pricing",
    "ezfotoo",
    "ezfoto",
}


def normalize_workspace_slug(value: str) -> str:
    value = value.strip().lower()

    if not 3 <= len(value) <= 60:
        raise ValueError(
            "Use between 3 and 60 characters."
        )

    if not SLUG_PATTERN.fullmatch(value):
        raise ValueError(
            "Use letters, numbers and single hyphens between words."
        )

    if value in RESERVED_SLUGS:
        raise ValueError(
            "This workspace address is reserved."
        )

    return value


class SlugAvailabilityResponse(BaseModel):
    slug: str
    available: bool
    hostname: str
    reason: str | None = None


class CompleteOnboardingRequest(BaseModel):
    full_name: str = Field(
        min_length=2,
        max_length=255,
    )

    business_name: str = Field(
        min_length=2,
        max_length=255,
    )

    slug: str = Field(
        min_length=3,
        max_length=60,
    )

    @field_validator(
        "full_name",
        "business_name",
        mode="before",
    )
    @classmethod
    def clean_text(cls, value: str) -> str:
        if isinstance(value, str):
            return " ".join(value.strip().split())

        return value

    @field_validator("slug", mode="before")
    @classmethod
    def validate_slug(cls, value: str) -> str:
        if isinstance(value, str):
            return normalize_workspace_slug(value)

        return value


class CompleteOnboardingResponse(BaseModel):
    workspace_id: str
    workspace_name: str
    workspace_slug: str
    hostname: str
    role: str