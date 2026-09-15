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


class CreateUploadResponse(BaseModel):
    upload_url: str
    public_url: str
    object_key: str