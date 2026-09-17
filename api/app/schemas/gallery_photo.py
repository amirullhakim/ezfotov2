from pydantic import (
    BaseModel,
    Field,
)


class GalleryPhotoPresignRequest(
    BaseModel
):
    filename: str = Field(
        min_length=1,
        max_length=255,
    )

    content_type: str

    file_size: int = Field(
        gt=0,
    )


class GalleryPhotoPresignResponse(
    BaseModel
):
    upload_url: str
    object_key: str
    method: str = "PUT"

    headers: dict[str, str]


class GalleryPhotoCompleteRequest(
    BaseModel
):
    object_key: str

    filename: str = Field(
        min_length=1,
        max_length=255,
    )

    content_type: str

    width: int | None = Field(
        default=None,
        gt=0,
    )

    height: int | None = Field(
        default=None,
        gt=0,
    )