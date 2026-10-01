from __future__ import annotations

import uuid
from dataclasses import dataclass

from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    EventGallery,
    EventPhoto,
    Workspace,
)


from app.services.subscription_access import require_paid_workspace_service


MAX_CART_PHOTOS = 100

# Legacy import compatibility. New quotes use the purchased plan fee.
EVENT_SALES_SERVICE_FEE_CENTS = 200


@dataclass
class EventSalesQuote:
    photos: list[EventPhoto]

    selected_count: int

    unit_price_cents: int
    regular_subtotal_cents: int

    discount_cents: int
    photo_subtotal_cents: int
    service_fee_cents: int
    total_cents: int

    bundle_configured: bool
    bundle_applied: bool

    bundle_quantity: int
    bundle_price_cents: int
    bundle_count: int

    bundled_photo_count: int
    remainder_photo_count: int

    pricing_subscription_id: uuid.UUID
    pricing_plan_code: str
    pricing_plan_name: str
    commission_bps: int
    commission_cents: int
    photographer_share_cents: int
    platform_share_cents: int


def calculate_event_commission(photo_subtotal_cents: int, commission_bps: int, service_fee_cents: int) -> dict[str, int]:
    """Round positive commission to the nearest sen, half up, using integers.

    Commission is charged on photo sales after discounts. The service fee is
    added to the platform's gross share; provider fees are not deducted here.
    """
    if any(type(value) is not int or value < 0 for value in (photo_subtotal_cents, commission_bps, service_fee_cents)):
        raise ValueError("Invalid commission pricing values.")
    if commission_bps > 10000:
        raise ValueError("Commission cannot exceed 100%.")
    commission = (photo_subtotal_cents * commission_bps + 5000) // 10000
    return {
        "commission_cents": commission,
        "photographer_share_cents": photo_subtotal_cents - commission,
        "platform_share_cents": commission + service_fee_cents,
    }


def _get_event_sales_subscription(db: Session, event: EventGallery, *, lock_subscription: bool):
    if lock_subscription:
        # Subscription activation and event management use the same parent
        # lock. Keep it through the order insert/commit to save consistent terms.
        workspace = db.scalar(select(Workspace).where(
            Workspace.id == event.workspace_id,
        ).with_for_update().execution_options(populate_existing=True))
        if workspace is None or workspace.status != "ACTIVE":
            raise HTTPException(409, "Photo purchases are currently unavailable for this event.")
        db.expire_all()
    try:
        subscription = require_paid_workspace_service(event.workspace_id, "EVENT_SALES", db)
    except HTTPException as exc:
        if exc.status_code == 403:
            raise HTTPException(409, "Photo purchases are currently unavailable for this event.") from exc
        raise
    now = datetime.now(timezone.utc)
    if event.status != "LIVE" or (event.sales_end_at is not None and event.sales_end_at <= now):
        raise HTTPException(409, "Sales are currently closed for this event.")
    if event.currency != subscription.currency:
        raise HTTPException(409, "Photo purchases are currently unavailable for this event currency.")
    return subscription


def public_photo_conditions(
    event: EventGallery,
):
    return (
        EventPhoto.workspace_id
        == event.workspace_id,

        EventPhoto.event_id
        == event.id,

        EventPhoto.status
        == "READY",

        EventPhoto.is_visible
        .is_(
            True
        ),

        EventPhoto.deleted_at
        .is_(
            None
        ),

        EventPhoto.preview_object_key
        .is_not(
            None
        ),
    )


def calculate_event_sales_quote(
    *,
    db: Session,
    event: EventGallery,
    photo_ids: list[uuid.UUID],
    lock_subscription: bool = False,
) -> EventSalesQuote:
    # --------------------------------------------------
    # DEDUPLICATE WHILE PRESERVING ORDER
    # --------------------------------------------------

    unique_photo_ids: list[
        uuid.UUID
    ] = []

    seen: set[
        uuid.UUID
    ] = set()


    for photo_id in photo_ids:
        if photo_id in seen:
            continue

        seen.add(
            photo_id
        )

        unique_photo_ids.append(
            photo_id
        )


    if not unique_photo_ids:
        raise ValueError(
            "Select at least one photo."
        )


    if (
        len(unique_photo_ids)
        > MAX_CART_PHOTOS
    ):
        raise ValueError(
            f"A maximum of {MAX_CART_PHOTOS} photos "
            "can be purchased in one order."
        )


    subscription = _get_event_sales_subscription(db, event, lock_subscription=lock_subscription)

    # --------------------------------------------------
    # VALIDATE PHOTOS
    # --------------------------------------------------

    photos = list(
        db.scalars(
            select(
                EventPhoto
            )
            .where(
                *public_photo_conditions(
                    event
                ),

                EventPhoto.id.in_(
                    unique_photo_ids
                ),
            )
        )
    )


    photo_map = {
        photo.id:
            photo
        for photo
        in photos
    }


    if (
        len(photo_map)
        != len(unique_photo_ids)
    ):
        raise ValueError(
            "One or more selected photos "
            "are no longer available."
        )


    selected_photos = [
        photo_map[
            photo_id
        ]
        for photo_id
        in unique_photo_ids
    ]


    selected_count = len(
        selected_photos
    )


    # --------------------------------------------------
    # REGULAR PRICE
    # --------------------------------------------------

    unit_price_cents = max(
        int(
            event.price_per_photo_cents
            or 0
        ),
        0,
    )


    regular_subtotal_cents = (
        selected_count
        * unit_price_cents
    )


    # --------------------------------------------------
    # BUNDLE
    # --------------------------------------------------

    bundle_configured = bool(
        event.bundle_enabled
    )


    bundle_quantity = max(
        int(
            event.bundle_quantity
            or 0
        ),
        0,
    )


    bundle_price_cents = max(
        int(
            event.bundle_price_cents
            or 0
        ),
        0,
    )


    bundle_valid = bool(
        bundle_configured
        and bundle_quantity > 1
        and bundle_price_cents > 0
    )


    bundle_beneficial = bool(
        bundle_valid
        and bundle_price_cents
        < (
            bundle_quantity
            * unit_price_cents
        )
    )


    bundle_count = 0
    bundled_photo_count = 0
    remainder_photo_count = (
        selected_count
    )


    if bundle_beneficial:
        bundle_count = (
            selected_count
            // bundle_quantity
        )


        bundled_photo_count = (
            bundle_count
            * bundle_quantity
        )


        remainder_photo_count = (
            selected_count
            - bundled_photo_count
        )


    bundle_total_cents = (
        bundle_count
        * bundle_price_cents
    )


    remainder_total_cents = (
        remainder_photo_count
        * unit_price_cents
    )


    if bundle_beneficial:
        photo_subtotal_cents = (
            bundle_total_cents
            + remainder_total_cents
        )

    else:
        photo_subtotal_cents = (
            regular_subtotal_cents
        )


    discount_cents = max(
        regular_subtotal_cents
        - photo_subtotal_cents,
        0,
    )


    # --------------------------------------------------
    # SERVICE FEE
    # --------------------------------------------------
    #
    # The fee is charged once per order, after bundle
    # pricing has been applied to the photo subtotal.
    #

    service_fee_cents = subscription.customer_service_fee_cents
    commission = calculate_event_commission(
        photo_subtotal_cents, subscription.commission_bps, service_fee_cents,
    )


    total_cents = (
        photo_subtotal_cents
        + service_fee_cents
    )


    return EventSalesQuote(
        pricing_subscription_id=subscription.id,
        pricing_plan_code=subscription.plan_code_snapshot,
        pricing_plan_name=subscription.plan_name_snapshot,
        commission_bps=subscription.commission_bps,
        **commission,
        photos=
            selected_photos,

        selected_count=
            selected_count,

        unit_price_cents=
            unit_price_cents,

        regular_subtotal_cents=
            regular_subtotal_cents,

        discount_cents=
            discount_cents,

        photo_subtotal_cents=
            photo_subtotal_cents,

        service_fee_cents=
            service_fee_cents,

        total_cents=
            total_cents,

        bundle_configured=
            bundle_configured,

        bundle_applied=
            bundle_count > 0,

        bundle_quantity=
            bundle_quantity,

        bundle_price_cents=
            bundle_price_cents,

        bundle_count=
            bundle_count,

        bundled_photo_count=
            bundled_photo_count,

        remainder_photo_count=
            remainder_photo_count,
    )