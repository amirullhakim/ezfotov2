from __future__ import annotations

from pathlib import PurePosixPath
from typing import Any

import boto3

from botocore.client import Config
from botocore.exceptions import BotoCoreError, ClientError

from app.core.config import settings


class PrivateStorageError(Exception):
    """Raised when an EZFOTOO private-storage operation fails."""


def _require_private_storage_config() -> None:
    required_values = {
        "R2_ACCOUNT_ID":
            settings.r2_account_id,
        "R2_PRIVATE_ACCESS_KEY_ID":
            settings.r2_private_access_key_id,
        "R2_PRIVATE_SECRET_ACCESS_KEY":
            settings.r2_private_secret_access_key,
        "R2_PRIVATE_BUCKET_NAME":
            settings.r2_private_bucket_name,
    }

    missing = [
        key
        for key, value
        in required_values.items()
        if not value
    ]

    if missing:
        raise PrivateStorageError(
            "Missing private R2 configuration: "
            + ", ".join(missing)
        )


def _private_r2_client():
    _require_private_storage_config()

    endpoint_url = (
        "https://"
        f"{settings.r2_account_id}"
        ".r2.cloudflarestorage.com"
    )

    return boto3.client(
        "s3",
        endpoint_url=endpoint_url,
        aws_access_key_id=
            settings.r2_private_access_key_id,
        aws_secret_access_key=
            settings.r2_private_secret_access_key,
        region_name="auto",
        config=Config(
            signature_version="s3v4",
        ),
    )


def normalize_object_key(
    object_key: str,
) -> str:
    cleaned = (
        object_key
        .strip()
        .lstrip("/")
    )

    if not cleaned:
        raise PrivateStorageError(
            "Object key cannot be empty."
        )

    path = PurePosixPath(
        cleaned
    )

    if ".." in path.parts:
        raise PrivateStorageError(
            "Invalid object key."
        )

    return str(path)


def generate_private_upload_url(
    object_key: str,
    content_type: str,
    expires_seconds: int = 900,
) -> str:
    """
    Create a presigned PUT URL.

    Default lifetime:
    15 minutes.
    """

    key = normalize_object_key(
        object_key
    )

    try:
        client = (
            _private_r2_client()
        )

        return (
            client.generate_presigned_url(
                ClientMethod="put_object",
                Params={
                    "Bucket":
                        settings.r2_private_bucket_name,
                    "Key":
                        key,
                    "ContentType":
                        content_type,
                },
                ExpiresIn=
                    expires_seconds,
            )
        )

    except (
        BotoCoreError,
        ClientError,
    ) as exc:
        raise PrivateStorageError(
            "Unable to create private upload URL."
        ) from exc


def generate_private_download_url(
    object_key: str,
    expires_seconds: int = 600,
    download_filename: str | None = None,
) -> str:
    """
    Create a presigned GET URL.

    Default lifetime:
    10 minutes.
    """

    key = normalize_object_key(
        object_key
    )

    params: dict[str, Any] = {
        "Bucket":
            settings.r2_private_bucket_name,
        "Key":
            key,
    }

    if download_filename:
        safe_filename = (
            download_filename
            .replace('"', "")
            .replace("\r", "")
            .replace("\n", "")
        )

        params[
            "ResponseContentDisposition"
        ] = (
            'attachment; '
            f'filename="{safe_filename}"'
        )

    try:
        client = (
            _private_r2_client()
        )

        return (
            client.generate_presigned_url(
                ClientMethod="get_object",
                Params=params,
                ExpiresIn=
                    expires_seconds,
            )
        )

    except (
        BotoCoreError,
        ClientError,
    ) as exc:
        raise PrivateStorageError(
            "Unable to create private download URL."
        ) from exc


def generate_private_view_url(
    object_key: str,
    expires_seconds: int = 600,
) -> str:
    return (
        generate_private_download_url(
            object_key=
                object_key,
            expires_seconds=
                expires_seconds,
            download_filename=None,
        )
    )


def get_private_object_metadata(
    object_key: str,
) -> dict[str, Any]:
    """
    Verify the object exists in private R2 and
    return its metadata.
    """

    key = normalize_object_key(
        object_key
    )

    try:
        client = (
            _private_r2_client()
        )

        return client.head_object(
            Bucket=
                settings.r2_private_bucket_name,
            Key=
                key,
        )

    except ClientError as exc:
        raise PrivateStorageError(
            "Private object was not found or could not be inspected."
        ) from exc

    except BotoCoreError as exc:
        raise PrivateStorageError(
            "Unable to inspect private object."
        ) from exc


def delete_private_object(
    object_key: str,
) -> None:
    key = normalize_object_key(
        object_key
    )

    try:
        client = (
            _private_r2_client()
        )

        client.delete_object(
            Bucket=
                settings.r2_private_bucket_name,
            Key=
                key,
        )

    except (
        BotoCoreError,
        ClientError,
    ) as exc:
        raise PrivateStorageError(
            "Unable to delete private object."
        ) from exc


def private_object_exists(
    object_key: str,
) -> bool:
    key = normalize_object_key(
        object_key
    )

    try:
        client = (
            _private_r2_client()
        )

        client.head_object(
            Bucket=
                settings.r2_private_bucket_name,
            Key=
                key,
        )

        return True

    except ClientError as exc:
        error_code = str(
            exc.response
            .get(
                "Error",
                {},
            )
            .get(
                "Code",
                "",
            )
        )

        if error_code in {
            "404",
            "NoSuchKey",
            "NotFound",
        }:
            return False

        raise PrivateStorageError(
            "Unable to inspect private object."
        ) from exc

    except BotoCoreError as exc:
        raise PrivateStorageError(
            "Unable to inspect private object."
        ) from exc