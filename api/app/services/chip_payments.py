from __future__ import annotations

import base64

from typing import Any
from urllib.parse import quote

import httpx

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

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
        .rstrip("/")
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
        payload = response.json()

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
        .rstrip("/")
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


    callback_url = (
        settings.chip_callback_url
        or ""
    ).strip()


    if callback_url:
        payload[
            "success_callback"
        ] = callback_url


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


# --------------------------------------------------
# CHIP PUBLIC KEY
# --------------------------------------------------


def _normalize_public_key_text(
    value: str,
) -> str:
    text = (
        value
        .strip()
    )


    # --------------------------------------------------
    # ESCAPED PEM
    # --------------------------------------------------
    #
    # CHIP may return something similar to:
    #
    # -----BEGIN PUBLIC KEY-----\nMIIBIjAN...
    #
    # The \n may be literal backslash characters
    # instead of real line breaks.
    #

    text = (
        text
        .replace(
            "\\r\\n",
            "\n",
        )
        .replace(
            "\\n",
            "\n",
        )
        .replace(
            "\\r",
            "\n",
        )
        .replace(
            '\\"',
            '"',
        )
    )


    # --------------------------------------------------
    # REMOVE WRAPPING JSON QUOTES
    # --------------------------------------------------

    if (
        len(text) >= 2
        and text[0] == '"'
        and text[-1] == '"'
    ):
        text = (
            text[
                1:-1
            ]
            .strip()
        )


    # --------------------------------------------------
    # STANDARD PUBLIC KEY PEM
    # --------------------------------------------------

    begin_marker = (
        "-----BEGIN PUBLIC KEY-----"
    )

    end_marker = (
        "-----END PUBLIC KEY-----"
    )


    begin_index = (
        text.find(
            begin_marker
        )
    )

    end_index = (
        text.find(
            end_marker
        )
    )


    if (
        begin_index >= 0
        and end_index >= 0
    ):
        end_index += len(
            end_marker
        )

        return (
            text[
                begin_index:
                end_index
            ]
            .strip()
            + "\n"
        )


    # --------------------------------------------------
    # RSA PUBLIC KEY PEM
    # --------------------------------------------------

    rsa_begin_marker = (
        "-----BEGIN RSA PUBLIC KEY-----"
    )

    rsa_end_marker = (
        "-----END RSA PUBLIC KEY-----"
    )


    rsa_begin_index = (
        text.find(
            rsa_begin_marker
        )
    )

    rsa_end_index = (
        text.find(
            rsa_end_marker
        )
    )


    if (
        rsa_begin_index >= 0
        and rsa_end_index >= 0
    ):
        rsa_end_index += len(
            rsa_end_marker
        )

        return (
            text[
                rsa_begin_index:
                rsa_end_index
            ]
            .strip()
            + "\n"
        )


    # --------------------------------------------------
    # BASE64 BODY ONLY
    # --------------------------------------------------
    #
    # If CHIP returns only the Base64 DER body,
    # reconstruct a normal PEM document.
    #

    compact = (
        text
        .replace(
            "\r",
            "",
        )
        .replace(
            "\n",
            "",
        )
        .replace(
            " ",
            "",
        )
        .strip()
    )


    if not compact:
        raise ValueError(
            "Public key is empty."
        )


    chunks = [
        compact[
            index:
            index + 64
        ]
        for index
        in range(
            0,
            len(compact),
            64,
        )
    ]


    return (
        "-----BEGIN PUBLIC KEY-----\n"
        + "\n".join(
            chunks
        )
        + "\n-----END PUBLIC KEY-----\n"
    )


def get_chip_public_key() -> str:
    (
        base_url,
        _brand_id,
        api_key,
    ) = _get_chip_config()


    url = (
        f"{base_url}/public_key/"
    )


    try:
        response = httpx.get(
            url,
            headers=
                _chip_headers(
                    api_key
                ),
            timeout=
                CHIP_TIMEOUT_SECONDS,
        )

    except httpx.RequestError as exc:
        raise ChipPaymentError(
            (
                "Unable to connect to CHIP "
                "for public key retrieval."
            )
        ) from exc


    if response.status_code >= 400:
        raise ChipPaymentError(
            (
                "CHIP public key API returned "
                f"{response.status_code}: "
                f"{_extract_error_message(response)}"
            )
        )


    candidates: list[str] = []


    # --------------------------------------------------
    # JSON RESPONSE FIRST
    # --------------------------------------------------
    #
    # Important:
    #
    # We intentionally parse JSON before using
    # response.text.
    #
    # This avoids returning raw JSON strings containing
    # literal escaped \n sequences.
    #

    try:
        payload = (
            response.json()
        )

    except ValueError:
        payload = None


    # --------------------------------------------------
    # JSON STRING
    # --------------------------------------------------

    if isinstance(
        payload,
        str,
    ):
        candidates.append(
            payload
        )


    # --------------------------------------------------
    # JSON OBJECT
    # --------------------------------------------------

    elif isinstance(
        payload,
        dict,
    ):
        for key_name in (
            "public_key",
            "publicKey",
            "key",
        ):
            value = payload.get(
                key_name
            )

            if isinstance(
                value,
                str,
            ):
                candidates.append(
                    value
                )


        data = payload.get(
            "data"
        )


        if isinstance(
            data,
            dict,
        ):
            for key_name in (
                "public_key",
                "publicKey",
                "key",
            ):
                value = data.get(
                    key_name
                )

                if isinstance(
                    value,
                    str,
                ):
                    candidates.append(
                        value
                    )


    # --------------------------------------------------
    # JSON ARRAY
    # --------------------------------------------------

    elif isinstance(
        payload,
        list,
    ):
        for item in payload:
            if isinstance(
                item,
                str,
            ):
                candidates.append(
                    item
                )


            elif isinstance(
                item,
                dict,
            ):
                for key_name in (
                    "public_key",
                    "publicKey",
                    "key",
                ):
                    value = item.get(
                        key_name
                    )

                    if isinstance(
                        value,
                        str,
                    ):
                        candidates.append(
                            value
                        )


                data = item.get(
                    "data"
                )


                if isinstance(
                    data,
                    dict,
                ):
                    for key_name in (
                        "public_key",
                        "publicKey",
                        "key",
                    ):
                        value = data.get(
                            key_name
                        )

                        if isinstance(
                            value,
                            str,
                        ):
                            candidates.append(
                                value
                            )


    # --------------------------------------------------
    # RAW RESPONSE FALLBACK
    # --------------------------------------------------

    raw_text = (
        response.text
        or ""
    ).strip()


    if raw_text:
        candidates.append(
            raw_text
        )


    # --------------------------------------------------
    # NORMALIZE + CRYPTOGRAPHIC VALIDATION
    # --------------------------------------------------
    #
    # Do not return a key merely because it looks
    # like PEM.
    #
    # cryptography must be able to load it first.
    #

    for candidate in candidates:
        try:
            normalized = (
                _normalize_public_key_text(
                    candidate
                )
            )


            serialization.load_pem_public_key(
                normalized.encode(
                    "utf-8"
                )
            )


            return normalized


        except (
            ValueError,
            TypeError,
        ):
            continue


    raise ChipPaymentError(
        (
            "CHIP returned a public key, "
            "but its format could not be parsed."
        )
    )


# --------------------------------------------------
# CHIP WEBHOOK SIGNATURE
# --------------------------------------------------


def _decode_chip_signature(
    signature: str,
) -> bytes:
    value = (
        signature
        .strip()
    )


    if value.lower().startswith(
        "sha256="
    ):
        value = value.split(
            "=",
            1,
        )[1]


    # --------------------------------------------------
    # STANDARD BASE64
    # --------------------------------------------------

    try:
        return base64.b64decode(
            value,
            validate=True,
        )


    except Exception:
        pass


    # --------------------------------------------------
    # URL-SAFE BASE64
    # --------------------------------------------------

    try:
        padding_length = (
            -len(value)
        ) % 4


        padded = (
            value
            + (
                "="
                * padding_length
            )
        )


        return (
            base64
            .urlsafe_b64decode(
                padded
            )
        )


    except Exception as exc:
        raise ChipPaymentError(
            "Invalid CHIP signature encoding."
        ) from exc


def verify_chip_signature(
    *,
    raw_body: bytes,
    signature: str,
) -> bool:
    if not raw_body:
        return False


    if not signature.strip():
        return False


    public_key_text = (
        get_chip_public_key()
    )


    try:
        public_key = (
            serialization
            .load_pem_public_key(
                public_key_text.encode(
                    "utf-8"
                )
            )
        )


        public_key.verify(
            _decode_chip_signature(
                signature
            ),

            raw_body,

            padding.PKCS1v15(),

            hashes.SHA256(),
        )


        return True


    except InvalidSignature:
        return False


    except (
        ValueError,
        TypeError,
    ) as exc:
        raise ChipPaymentError(
            "Unable to verify CHIP signature."
        ) from exc