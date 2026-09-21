from __future__ import annotations

import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    EventGallery,
    EventPhoto,
)


MAX_CART_PHOTOS = 100


@dataclass
class EventSalesQuote:
    photos: list[EventPhoto]

    selected_count: int

    unit_price_cents: int
    regular_subtotal_cents: int

    discount_cents: int
    total_cents: int

    bundle_configured: bool
    bundle_applied: bool

    bundle_quantity: int
    bundle_price_cents: int
    bundle_count: int

    bundled_photo_count: int
    remainder_photo_count: int


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
        total_cents = (
            bundle_total_cents
            + remainder_total_cents
        )

    else:
        total_cents = (
            regular_subtotal_cents
        )


    discount_cents = max(
        regular_subtotal_cents
        - total_cents,
        0,
    )


    return EventSalesQuote(
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