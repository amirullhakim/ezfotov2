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


def get_public_url(
    object_key: str,
) -> str:
    if not settings.r2_public_url:
        raise RuntimeError(
            "R2_PUBLIC_URL is not configured."
        )

    return (
        f"{settings.r2_public_url.rstrip('/')}/"
        f"{object_key}"
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

    return {
        "upload_url": upload_url,
        "public_url": get_public_url(
            object_key
        ),
        "object_key": object_key,
    }


def get_object_metadata(
    object_key: str,
):
    if not settings.r2_bucket_name:
        raise RuntimeError(
            "R2_BUCKET_NAME is not configured."
        )

    client = get_r2_client()

    return client.head_object(
        Bucket=settings.r2_bucket_name,
        Key=object_key,
    )


def delete_r2_object(
    object_key: str,
):
    if not settings.r2_bucket_name:
        raise RuntimeError(
            "R2_BUCKET_NAME is not configured."
        )

    client = get_r2_client()

    client.delete_object(
        Bucket=settings.r2_bucket_name,
        Key=object_key,
    )