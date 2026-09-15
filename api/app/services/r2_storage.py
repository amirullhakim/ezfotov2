import boto3
from botocore.client import Config

from app.core.config import settings


def get_r2_client():
    if not settings.r2_account_id:
        raise RuntimeError(
            "R2_ACCOUNT_ID is not configured."
        )

    if not settings.r2_access_key_id:
        raise RuntimeError(
            "R2_ACCESS_KEY_ID is not configured."
        )

    if not settings.r2_secret_access_key:
        raise RuntimeError(
            "R2_SECRET_ACCESS_KEY is not configured."
        )

    return boto3.client(
        service_name="s3",
        endpoint_url=(
            f"https://{settings.r2_account_id}"
            ".r2.cloudflarestorage.com"
        ),
        aws_access_key_id=(
            settings.r2_access_key_id
        ),
        aws_secret_access_key=(
            settings.r2_secret_access_key
        ),
        region_name="auto",
        config=Config(
            signature_version="s3v4",
        ),
    )


def create_presigned_upload_url(
    object_key: str,
    content_type: str,
    expires_in: int = 900,
):
    if not settings.r2_bucket_name:
        raise RuntimeError(
            "R2_BUCKET_NAME is not configured."
        )

    client = get_r2_client()

    upload_url = client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.r2_bucket_name,
            "Key": object_key,
            "ContentType": content_type,
        },
        ExpiresIn=expires_in,
    )

    public_base = (
        settings.r2_public_url or ""
    ).rstrip("/")

    public_url = (
        f"{public_base}/{object_key}"
        if public_base
        else None
    )

    return {
        "upload_url": upload_url,
        "public_url": public_url,
        "object_key": object_key,
    }