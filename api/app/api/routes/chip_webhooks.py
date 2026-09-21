from __future__ import annotations

import json

from datetime import (
    datetime,
    timezone,
)

from decimal import (
    Decimal,
    InvalidOperation,
)

from typing import Any

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Request,
    status,
)

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db

from app.models import EventOrder

from app.services.chip_payments import (
    ChipPaymentError,
    get_chip_purchase,
    verify_chip_signature,
)


router = APIRouter(
    prefix="/payments/chip",
    tags=["CHIP Payments"],
)


def _to_int(
    value: Any,
) -> int | None:
    if value is None:
        return None


    if isinstance(
        value,
        bool,
    ):
        return None


    if isinstance(
        value,
        int,
    ):
        return value


    try:
        decimal_value = Decimal(
            str(value)
        )

    except (
        InvalidOperation,
        ValueError,
    ):
        return None


    if (
        decimal_value
        != decimal_value.to_integral_value()
    ):
        return None


    return int(
        decimal_value
    )


def _extract_purchase_total(
    purchase: dict[
        str,
        Any,
    ],
) -> int | None:
    purchase_details = (
        purchase.get(
            "purchase"
        )
    )


    if not isinstance(
        purchase_details,
        dict,
    ):
        return None


    direct_total = (
        _to_int(
            purchase_details.get(
                "total"
            )
        )
    )


    if direct_total is not None:
        return direct_total


    products = (
        purchase_details.get(
            "products"
        )
    )


    if not isinstance(
        products,
        list,
    ):
        return None


    calculated_total = (
        Decimal("0")
    )


    for product in products:
        if not isinstance(
            product,
            dict,
        ):
            return None


        price = _to_int(
            product.get(
                "price"
            )
        )


        if price is None:
            return None


        quantity_value = (
            product.get(
                "quantity",
                "1",
            )
        )


        try:
            quantity = Decimal(
                str(
                    quantity_value
                )
            )

        except InvalidOperation:
            return None


        calculated_total += (
            Decimal(
                price
            )
            * quantity
        )


    if (
        calculated_total
        != calculated_total
        .to_integral_value()
    ):
        return None


    return int(
        calculated_total
    )


def _extract_currency(
    purchase: dict[
        str,
        Any,
    ],
) -> str:
    purchase_details = (
        purchase.get(
            "purchase"
        )
    )


    if not isinstance(
        purchase_details,
        dict,
    ):
        return ""


    return str(
        purchase_details.get(
            "currency"
        )
        or ""
    ).upper()


def _extract_transaction_id(
    purchase: dict[
        str,
        Any,
    ],
) -> str | None:
    payment = purchase.get(
        "payment"
    )


    if isinstance(
        payment,
        dict,
    ):
        value = (
            payment.get(
                "id"
            )
            or payment.get(
                "transaction_id"
            )
        )

        if value:
            return str(
                value
            )


    return None


def _validate_purchase(
    *,
    order: EventOrder,
    purchase: dict[
        str,
        Any,
    ],
) -> None:
    purchase_id = str(
        purchase.get(
            "id"
        )
        or ""
    )


    if (
        not order.payment_reference
        or purchase_id
        != order.payment_reference
    ):
        raise HTTPException(
            status_code=
                status.HTTP_409_CONFLICT,
            detail=(
                "CHIP purchase reference mismatch."
            ),
        )


    reference = str(
        purchase.get(
            "reference"
        )
        or ""
    )


    if (
        reference
        != order.order_number
    ):
        raise HTTPException(
            status_code=
                status.HTTP_409_CONFLICT,
            detail=(
                "CHIP order reference mismatch."
            ),
        )


    brand_id = str(
        purchase.get(
            "brand_id"
        )
        or ""
    )


    expected_brand_id = (
        settings.chip_brand_id
        or ""
    ).strip()


    if (
        brand_id
        and expected_brand_id
        and brand_id
        != expected_brand_id
    ):
        raise HTTPException(
            status_code=
                status.HTTP_409_CONFLICT,
            detail=
                "CHIP brand mismatch.",
        )


    currency = _extract_currency(
        purchase
    )


    if (
        currency
        != order.currency.upper()
    ):
        raise HTTPException(
            status_code=
                status.HTTP_409_CONFLICT,
            detail=
                "CHIP currency mismatch.",
        )


    purchase_total = (
        _extract_purchase_total(
            purchase
        )
    )


    if purchase_total is None:
        raise HTTPException(
            status_code=
                status.HTTP_409_CONFLICT,
            detail=(
                "Unable to verify CHIP payment amount."
            ),
        )


    if (
        purchase_total
        != order.total_cents
    ):
        raise HTTPException(
            status_code=
                status.HTTP_409_CONFLICT,
            detail=
                "CHIP amount mismatch.",
        )


@router.post(
    "/webhook"
)
async def chip_payment_webhook(
    request: Request,

    db: Session = Depends(
        get_db
    ),
):
    # --------------------------------------------------
    # RAW REQUEST
    # --------------------------------------------------

    raw_body = await request.body()


    signature = (
        request.headers.get(
            "X-Signature"
        )
        or ""
    )


    if not signature:
        raise HTTPException(
            status_code=
                status.HTTP_400_BAD_REQUEST,
            detail=(
                "Missing CHIP signature."
            ),
        )


    # --------------------------------------------------
    # SIGNATURE VERIFICATION
    # --------------------------------------------------

    try:
        signature_valid = (
            verify_chip_signature(
                raw_body=
                    raw_body,

                signature=
                    signature,
            )
        )

    except ChipPaymentError as exc:
        raise HTTPException(
            status_code=
                status.HTTP_502_BAD_GATEWAY,
            detail=(
                "Unable to verify CHIP callback."
            ),
        ) from exc


    if not signature_valid:
        raise HTTPException(
            status_code=
                status.HTTP_400_BAD_REQUEST,
            detail=(
                "Invalid CHIP signature."
            ),
        )


    # --------------------------------------------------
    # PARSE PAYLOAD
    # --------------------------------------------------

    try:
        payload = json.loads(
            raw_body.decode(
                "utf-8"
            )
        )

    except (
        UnicodeDecodeError,
        json.JSONDecodeError,
    ) as exc:
        raise HTTPException(
            status_code=
                status.HTTP_400_BAD_REQUEST,
            detail=(
                "Invalid CHIP callback payload."
            ),
        ) from exc


    if not isinstance(
        payload,
        dict,
    ):
        raise HTTPException(
            status_code=
                status.HTTP_400_BAD_REQUEST,
            detail=(
                "Invalid CHIP callback payload."
            ),
        )


    purchase_id = str(
        payload.get(
            "id"
        )
        or ""
    ).strip()


    event_type = str(
        payload.get(
            "event_type"
        )
        or ""
    ).strip()


    if not purchase_id:
        raise HTTPException(
            status_code=
                status.HTTP_400_BAD_REQUEST,
            detail=(
                "Missing CHIP purchase ID."
            ),
        )


    # --------------------------------------------------
    # FIND LOCAL ORDER
    # --------------------------------------------------

    order = db.scalar(
        select(
            EventOrder
        )
        .where(
            EventOrder.payment_provider
            == "CHIP_FPX",

            EventOrder.payment_reference
            == purchase_id,
        )
        .with_for_update()
    )


    # A valid CHIP account may contain payments not
    # belonging to Event Sales. Acknowledge safely.
    if order is None:
        db.rollback()

        return {
            "received":
                True,

            "handled":
                False,
        }


    # --------------------------------------------------
    # RE-FETCH AUTHORITATIVE PURCHASE
    # --------------------------------------------------
    #
    # We do not trust the callback body for money or
    # payment status. We retrieve the purchase directly
    # from CHIP using our private API credentials.
    #

    try:
        purchase = (
            get_chip_purchase(
                purchase_id
            )
        )

    except ChipPaymentError as exc:
        db.rollback()

        raise HTTPException(
            status_code=
                status.HTTP_502_BAD_GATEWAY,
            detail=(
                "Unable to verify CHIP purchase."
            ),
        ) from exc


    _validate_purchase(
        order=
            order,

        purchase=
            purchase,
    )


    chip_status = str(
        purchase.get(
            "status"
        )
        or ""
    ).lower()


    transaction_id = (
        _extract_transaction_id(
            purchase
        )
    )


    # --------------------------------------------------
    # PAID
    # --------------------------------------------------

    if chip_status == "paid":
        if (
            order.status
            != "REFUNDED"
        ):
            order.status = (
                "PAID"
            )


            if order.paid_at is None:
                order.paid_at = (
                    datetime.now(
                        timezone.utc
                    )
                )


            if transaction_id:
                order.provider_transaction_id = (
                    transaction_id
                )


        db.commit()


        return {
            "received":
                True,

            "handled":
                True,

            "event_type":
                event_type,

            "order_status":
                order.status,
        }


    # --------------------------------------------------
    # NON-PAID STATES
    # --------------------------------------------------
    #
    # A successful PAID order is never downgraded by
    # a delayed callback.
    #

    if order.status != "PAID":
        if (
            event_type
            == "purchase.cancelled"
            or chip_status
            in {
                "cancelled",
                "canceled",
            }
        ):
            order.status = (
                "CANCELLED"
            )


        elif (
            event_type
            == "purchase.payment_failure"
            or chip_status
            in {
                "failed",
                "failure",
                "error",
            }
        ):
            order.status = (
                "PAYMENT_FAILED"
            )


    db.commit()


    return {
        "received":
            True,

        "handled":
            True,

        "event_type":
            event_type,

        "order_status":
            order.status,
    }