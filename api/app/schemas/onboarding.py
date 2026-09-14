import re

from pydantic import BaseModel, Field, field_validator


SLUG_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


class SlugAvailabilityResponse(BaseModel):
    slug: str
    available: bool


class CompleteOnboardingRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=255)
    business_name: str = Field(min_length=2, max_length=255)
    slug: str = Field(min_length=3, max_length=60)

    @field_validator("full_name", "business_name")
    @classmethod
    def clean_text(cls, value: str) -> str:
        return " ".join(value.strip().split())

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, value: str) -> str:
        value = value.strip().lower()

        if not SLUG_PATTERN.fullmatch(value):
            raise ValueError(
                "Slug may only contain lowercase letters, numbers and single hyphens."
            )

        reserved = {
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

        if value in reserved:
            raise ValueError("This subdomain is reserved.")

        return value


class CompleteOnboardingResponse(BaseModel):
    workspace_id: str
    workspace_name: str
    workspace_slug: str
    hostname: str
    role: str