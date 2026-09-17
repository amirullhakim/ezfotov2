import base64
import hashlib
import hmac
import json
import time
import uuid

from app.core.config import settings


PASSWORD_ACCESS_TTL_SECONDS = (
    24 * 60 * 60
)


class GalleryAccessError(Exception):
    """Raised when gallery access configuration is invalid."""


def _require_secret() -> bytes:
    if not settings.gallery_access_secret:
        raise GalleryAccessError(
            "GALLERY_ACCESS_SECRET is not configured."
        )

    return settings.gallery_access_secret.encode(
        "utf-8"
    )


def _base64url_encode(
    value: bytes,
) -> str:
    return (
        base64.urlsafe_b64encode(
            value
        )
        .decode("utf-8")
        .rstrip("=")
    )


def _base64url_decode(
    value: str,
) -> bytes:
    padding = "=" * (
        (-len(value)) % 4
    )

    return base64.urlsafe_b64decode(
        value + padding
    )


def _password_version(
    password_hash: str,
) -> str:
    """
    Produce a fingerprint of the current
    password hash.

    If the photographer changes the gallery
    password, all previously issued gallery
    access tokens automatically become invalid.
    """

    return hashlib.sha256(
        password_hash.encode(
            "utf-8"
        )
    ).hexdigest()


def create_password_gallery_access_token(
    gallery_id: uuid.UUID,
    password_hash: str,
    expires_seconds: int = PASSWORD_ACCESS_TTL_SECONDS,
) -> str:
    now = int(
        time.time()
    )

    payload = {
        "gallery_id":
            str(gallery_id),

        "exp":
            now + expires_seconds,

        "password_version":
            _password_version(
                password_hash
            ),
    }


    payload_json = json.dumps(
        payload,
        separators=(",", ":"),
        sort_keys=True,
    ).encode(
        "utf-8"
    )


    encoded_payload = (
        _base64url_encode(
            payload_json
        )
    )


    signature = hmac.new(
        _require_secret(),
        encoded_payload.encode(
            "utf-8"
        ),
        hashlib.sha256,
    ).digest()


    encoded_signature = (
        _base64url_encode(
            signature
        )
    )


    return (
        f"{encoded_payload}."
        f"{encoded_signature}"
    )


def verify_password_gallery_access_token(
    token: str,
    gallery_id: uuid.UUID,
    current_password_hash: str | None,
) -> bool:
    if not current_password_hash:
        return False


    try:
        (
            encoded_payload,
            encoded_signature,
        ) = token.split(
            ".",
            1,
        )


        expected_signature = hmac.new(
            _require_secret(),
            encoded_payload.encode(
                "utf-8"
            ),
            hashlib.sha256,
        ).digest()


        provided_signature = (
            _base64url_decode(
                encoded_signature
            )
        )


        if not hmac.compare_digest(
            expected_signature,
            provided_signature,
        ):
            return False


        payload = json.loads(
            _base64url_decode(
                encoded_payload
            ).decode(
                "utf-8"
            )
        )


        if (
            payload.get(
                "gallery_id"
            )
            != str(gallery_id)
        ):
            return False


        expires_at = int(
            payload.get(
                "exp",
                0,
            )
        )


        if (
            expires_at
            <= int(
                time.time()
            )
        ):
            return False


        expected_version = (
            _password_version(
                current_password_hash
            )
        )


        token_version = (
            payload.get(
                "password_version"
            )
        )


        return hmac.compare_digest(
            expected_version,
            str(
                token_version
            ),
        )


    except (
        ValueError,
        TypeError,
        json.JSONDecodeError,
        GalleryAccessError,
    ):
        return False


def hash_gallery_visitor_token(
    visitor_token: str,
) -> str:
    return hashlib.sha256(
        visitor_token.encode(
            "utf-8"
        )
    ).hexdigest()