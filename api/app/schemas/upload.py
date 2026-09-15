from pydantic import BaseModel, Field


class CreateUploadRequest(BaseModel):
    filename: str = Field(
        min_length=1,
        max_length=255,
    )

    content_type: str = Field(
        min_length=1,
        max_length=100,
    )

    purpose: str = Field(
        min_length=1,
        max_length=50,
    )

    file_size: int = Field(
        gt=0,
        le=15 * 1024 * 1024,
    )


class CreateUploadResponse(BaseModel):
    upload_url: str
    public_url: str
    object_key: str


class CompleteUploadRequest(BaseModel):
    object_key: str
    filename: str
    content_type: str
    purpose: str


class MediaAssetResponse(BaseModel):
    id: str
    object_key: str
    public_url: str
    filename: str
    content_type: str
    size_bytes: int
    purpose: str