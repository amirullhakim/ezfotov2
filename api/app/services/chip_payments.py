from __future__ import annotations

from typing import Any
from urllib.parse import quote

import httpx

from app.core.config import settings
from app.models import EventOrder


CHIP_TIMEOUT_SECONDS = 25.0


class ChipPaymentError(
    Exception
):
    pass


class ChipPurchaseNotFound(
    ChipPaymentError
):
    pass


def _get_chip_config() -> tuple[
    str,
    str,
    str,
]:
    base_url = (
        settings
        .chip_api_base_url
        .strip()
        .rstrip(
            "/"
        )
    )

    brand_id = (
        settings.chip_brand_id
        or ""
    ).strip()

    api_key = (
        settings.chip_api_key
        or ""
    ).strip()

    if not brand_id:
        raise ChipPaymentError(
            "CHIP_BRAND_ID is not configured."
        )

    if not api_key:
        raise ChipPaymentError(
            "CHIP_API_KEY is not configured."
        )

    return (
        base_url,
        brand_id,
        api_key,
    )


def _chip_headers(
    api_key: str,
) -> dict[str, str]:
    return {
        "Authorization":
            f"Bearer {api_key}",

        "Content-Type":
            "application/json",

        "Accept":
            "application/json",
    }


def _extract_error_message(
    response: httpx.Response,
) -> str:
    try:
        payload = response.json()

        if isinstance(
            payload,
            dict,
        ):
            detail = (
                payload.get(
                    "detail"
                )
                or payload.get(
                    "message"
                )
                or payload.get(
                    "error"
                )
            )

            if detail:
                return str(
                    detail
                )[:500]

            return str(
                payload
            )[:500]

    except Exception:
        pass

    return (
        response.text
        or "Unknown CHIP API error."
    )[:500]


def _request_chip(
    *,
    method: str,
    path: str,
    json_payload: dict[
        str,
        Any,
    ] | None = None,
) -> dict[str, Any]:
    (
        base_url,
        _brand_id,
        api_key,
    ) = _get_chip_config()

    url = (
        f"{base_url}/"
        f"{path.lstrip('/')}"
    )

    try:
        response = httpx.request(
            method=
                method,

            url=
                url,

            headers=
                _chip_headers(
                    api_key
                ),

            json=
                json_payload,

            timeout=
                CHIP_TIMEOUT_SECONDS,
        )

    except httpx.RequestError as exc:
        raise ChipPaymentError(
            "Unable to connect to CHIP."
        ) from exc


    if response.status_code == 404:
        raise ChipPurchaseNotFound(
            "CHIP purchase was not found."
        )


    if response.status_code >= 400:
        raise ChipPaymentError(
            (
                "CHIP API returned "
                f"{response.status_code}: "
                f"{_extract_error_message(response)}"
            )
        )


    try:
        payload = (
            response.json()
        )

    except ValueError as exc:
        raise ChipPaymentError(
            "CHIP returned an invalid response."
        ) from exc


    if not isinstance(
        payload,
        dict,
    ):
        raise ChipPaymentError(
            "CHIP returned an unexpected response."
        )


    return payload


def create_chip_fpx_purchase(
    *,
    order: EventOrder,
) -> dict[str, Any]:
    (
        _base_url,
        brand_id,
        _api_key,
    ) = _get_chip_config()


    frontend_url = (
        settings
        .frontend_url
        .rstrip(
            "/"
        )
    )


    encoded_order = quote(
        order.order_number,
        safe="",
    )


    success_redirect = (
        f"{frontend_url}"
        "/payment/chip/return"
        "?result=success"
        f"&order={encoded_order}"
    )


    failure_redirect = (
        f"{frontend_url}"
        "/payment/chip/return"
        "?result=failure"
        f"&order={encoded_order}"
    )


    cancel_redirect = (
        f"{frontend_url}"
        "/payment/chip/return"
        "?result=cancelled"
        f"&order={encoded_order}"
    )


    payload: dict[
        str,
        Any,
    ] = {
        "brand_id":
            brand_id,

        "client": {
            "email":
                order.customer_email,

            "full_name":
                order.customer_name,
        },

        "purchase": {
            "currency":
                order.currency,

            "language":
                "en",

            "products": [
                {
                    "name":
                        "EZFOTOO Event Photos",

                    "price":
                        order.total_cents,

                    "quantity":
                        "1",
                }
            ],

            "notes": (
                f"{order.item_count} event "
                f"photo"
                f"{'' if order.item_count == 1 else 's'}"
                f" — {order.order_number}"
            ),
        },

        "reference":
            order.order_number,

        "payment_method_whitelist": [
            "fpx",
        ],

        "send_receipt":
            False,

        "success_redirect":
            success_redirect,

        "failure_redirect":
            failure_redirect,

        "cancel_redirect":
            cancel_redirect,
    }


    return _request_chip(
        method="POST",
        path="/purchases/",
        json_payload=
            payload,
    )


def get_chip_purchase(
    purchase_id: str,
) -> dict[str, Any]:
    return _request_chip(
        method="GET",
        path=(
            f"/purchases/"
            f"{purchase_id}/"
        ),
    )