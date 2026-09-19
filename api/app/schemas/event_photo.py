from pydantic import (
    BaseModel,
    Field,
    field_validator,
)


class EventPhotoUploadItem(BaseModel):
    filename: str = Field(
        min_length=1,
        max_length=255,
    )

    content_type: str = Field(
        min_length=1,
        max_length=100,
    )

    file_size: int = Field(
        gt=0,
    )

    model_config = {
        "extra": "forbid",
    }


class EventPhotoBatchPresignRequest(BaseModel):
    files: list[
        EventPhotoUploadItem
    ] = Field(
        min_length=1,
        max_length=100,
    )

    model_config = {
        "extra": "forbid",
    }


class EventPhotoPresignedItem(BaseModel):
    filename: str
    content_type: str
    file_size: int

    upload_url: str
    object_key: str

    method: str = "PUT"

    headers: dict[
        str,
        str,
    ]


class EventPhotoBatchPresignResponse(BaseModel):
    event_id: str

    expires_in: int

    uploads: list[
        EventPhotoPresignedItem
    ]


class EventPhotoCompleteItem(BaseModel):
    object_key: str = Field(
        min_length=1,
        max_length=1500,
    )

    filename: str = Field(
        min_length=1,
        max_length=255,
    )

    content_type: str = Field(
        min_length=1,
        max_length=100,
    )

    width: int | None = Field(
        default=None,
        gt=0,
    )

    height: int | None = Field(
        default=None,
        gt=0,
    )

    @field_validator(
        "object_key",
        "filename",
        "content_type",
    )
    @classmethod
    def clean_required_text(
        cls,
        value: str,
    ) -> str:
        cleaned = value.strip()

        if not cleaned:
            raise ValueError(
                "Value cannot be empty."
            )

        return cleaned

    model_config = {
        "extra": "forbid",
    }


class EventPhotoBatchCompleteRequest(BaseModel):
    files: list[
        EventPhotoCompleteItem
    ] = Field(
        min_length=1,
        max_length=100,
    )

    model_config = {
        "extra": "forbid",
    }