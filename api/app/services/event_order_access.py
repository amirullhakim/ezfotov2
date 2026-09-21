from __future__ import annotations

import base64
import hashlib
import hmac
import uuid

from app.core.config import settings


def _get_secret() -> bytes:
    secret = (
        settings.event_order_access_secret
        or ""
    ).strip()

    if len(secret) < 32:
        raise RuntimeError(
            "EVENT_ORDER_ACCESS_SECRET must be "
            "configured with at least 32 characters."
        )

    return secret.encode(
        "utf-8"
    )


def create_event_order_access_token(
    order_id: uuid.UUID,
) -> str:
    message = (
        f"ezfotoo:event-order:{order_id}"
    ).encode(
        "utf-8"
    )

    digest = hmac.new(
        _get_secret(),
        message,
        hashlib.sha256,
    ).digest()

    return (
        base64
        .urlsafe_b64encode(
            digest
        )
        .rstrip(
            b"="
        )
        .decode(
            "ascii"
        )
    )


def verify_event_order_access_token(
    *,
    order_id: uuid.UUID,
    token: str,
) -> bool:
    expected = (
        create_event_order_access_token(
            order_id
        )
    )

    return hmac.compare_digest(
        expected,
        token,
    )