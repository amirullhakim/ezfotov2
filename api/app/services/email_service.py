from __future__ import annotations

from typing import Any

import resend

from app.core.config import settings


class EmailDeliveryError(Exception):
    pass


def _get_sender() -> str:
    email = (settings.resend_from_email or "").strip()
    name = (settings.resend_from_name or "EZFOTOO").strip()

    if not email:
        raise EmailDeliveryError(
            "RESEND_FROM_EMAIL is not configured."
        )

    return f"{name} <{email}>"


def _configure_resend() -> None:
    api_key = (settings.resend_api_key or "").strip()

    if not api_key:
        raise EmailDeliveryError(
            "RESEND_API_KEY is not configured."
        )

    resend.api_key = api_key


async def send_transactional_email(
    *,
    to_email: str,
    subject: str,
    html: str,
    text: str | None = None,
    reply_to: str | None = None,
    idempotency_key: str | None = None,
) -> dict[str, Any]:
    _configure_resend()

    clean_to = to_email.strip().lower()

    if not clean_to:
        raise EmailDeliveryError(
            "Recipient email is required."
        )

    params: resend.Emails.SendParams = {
        "from": _get_sender(),
        "to": [clean_to],
        "subject": subject.strip(),
        "html": html,
    }

    if text:
        params["text"] = text

    if reply_to:
        params["reply_to"] = reply_to.strip()

    try:
        if idempotency_key:
            options: resend.Emails.SendOptions = {
                "idempotency_key": idempotency_key,
            }
            response = await resend.Emails.send_async(
                params,
                options,
            )
        else:
            response = await resend.Emails.send_async(
                params
            )

    except Exception as exc:
        raise EmailDeliveryError(
            "Unable to send email through Resend."
        ) from exc

    if isinstance(response, dict):
        return response

    return {
        "id": getattr(response, "id", None),
    }