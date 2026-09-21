from __future__ import annotations

from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)

from pydantic import (
    BaseModel,
    Field,
)

from sqlalchemy import (
    select,
)

from sqlalchemy.orm import (
    Session,
)

from app.api.routes.public_event_sales import (
    event_sales_open,
    get_public_event_workspace,
    get_public_live_event,
    public_photo_conditions,
)

from app.db.session import (
    get_db,
)

from app.models import (
    EventPhoto,
)


router = APIRouter(
    prefix="/public/events",
    tags=["Public Event Cart"],
)


MAX_CART_PHOTOS = 100


# --------------------------------------------------
# REQUEST
# --------------------------------------------------


class PublicEventQuoteRequest(
    BaseModel
):
    photo_ids: list[UUID] = Field(
        min_length=1,
        max_length=
            MAX_CART_PHOTOS,
    )


# --------------------------------------------------
# MONEY
# --------------------------------------------------


def cents_to_rm(
    value: int,
) -> float:
    return round(
        value / 100,
        2,
    )


# --------------------------------------------------
# QUOTE
# --------------------------------------------------


@router.post(
    "/{workspace_slug}/{event_slug}/quote"
)
def quote_public_event_cart(
    workspace_slug: str,
    event_slug: str,
    payload: PublicEventQuoteRequest,

    db: Session = Depends(
        get_db
    ),
):
    workspace = (
        get_public_event_workspace(
            db=db,
            workspace_slug=
                workspace_slug,
        )
    )


    event = get_public_live_event(
        db=db,
        workspace=
            workspace,
        event_slug=
            event_slug,
    )


    # ----------------------------------------------
    # SALES STATUS
    # ----------------------------------------------

    if not event_sales_open(
        event
    ):
        raise HTTPException(
            status_code=
                status.HTTP_409_CONFLICT,
            detail=(
                "Sales are currently closed "
                "for this event."
            ),
        )


    # ----------------------------------------------
    # REMOVE DUPLICATES
    # ----------------------------------------------

    unique_photo_ids: list[
        UUID
    ] = []


    seen_photo_ids: set[
        UUID
    ] = set()


    for photo_id in (
        payload.photo_ids
    ):
        if (
            photo_id
            in seen_photo_ids
        ):
            continue


        seen_photo_ids.add(
            photo_id
        )


        unique_photo_ids.append(
            photo_id
        )


    if not unique_photo_ids:
        raise HTTPException(
            status_code=
                status.HTTP_400_BAD_REQUEST,
            detail=(
                "Select at least one photo."
            ),
        )


    # ----------------------------------------------
    # VALIDATE PUBLIC PHOTOS
    # ----------------------------------------------

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
        photo.id: photo
        for photo in photos
    }


    if (
        len(photo_map)
        != len(
            unique_photo_ids
        )
    ):
        raise HTTPException(
            status_code=
                status.HTTP_400_BAD_REQUEST,
            detail=(
                "One or more selected photos "
                "are no longer available."
            ),
        )


    # Preserve customer selection order.
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


    # ----------------------------------------------
    # BASE PRICE
    # ----------------------------------------------

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


    # ----------------------------------------------
    # BUNDLE SETTINGS
    # ----------------------------------------------

    configured_bundle_enabled = bool(
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


    bundle_is_valid = bool(
        configured_bundle_enabled
        and bundle_quantity > 1
        and bundle_price_cents > 0
    )


    # Only use the bundle if it actually gives
    # the customer a better price.
    bundle_is_beneficial = bool(
        bundle_is_valid
        and bundle_price_cents
        < (
            bundle_quantity
            * unit_price_cents
        )
    )


    # ----------------------------------------------
    # CALCULATE TOTAL
    # ----------------------------------------------

    bundle_count = 0

    bundled_photo_count = 0

    remainder_photo_count = (
        selected_count
    )


    if bundle_is_beneficial:
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


    if bundle_is_beneficial:
        total_cents = (
            bundle_total_cents
            + remainder_total_cents
        )

    else:
        total_cents = (
            regular_subtotal_cents
        )


    savings_cents = max(
        regular_subtotal_cents
        - total_cents,
        0,
    )


    # ----------------------------------------------
    # RESPONSE
    # ----------------------------------------------

    return {
        "event_id":
            str(event.id),

        "currency":
            event.currency,

        "selected_count":
            selected_count,

        "selected_photo_ids": [
            str(
                photo.id
            )
            for photo
            in selected_photos
        ],

        "pricing": {
            "unit_price_cents":
                unit_price_cents,

            "unit_price_rm":
                cents_to_rm(
                    unit_price_cents
                ),

            "regular_subtotal_cents":
                regular_subtotal_cents,

            "regular_subtotal_rm":
                cents_to_rm(
                    regular_subtotal_cents
                ),

            "total_cents":
                total_cents,

            "total_rm":
                cents_to_rm(
                    total_cents
                ),

            "savings_cents":
                savings_cents,

            "savings_rm":
                cents_to_rm(
                    savings_cents
                ),
        },

        "bundle": {
            "configured":
                configured_bundle_enabled,

            "applied":
                bundle_count > 0,

            "quantity":
                bundle_quantity,

            "price_cents":
                bundle_price_cents,

            "price_rm":
                cents_to_rm(
                    bundle_price_cents
                ),

            "bundle_count":
                bundle_count,

            "bundled_photo_count":
                bundled_photo_count,

            "remainder_photo_count":
                remainder_photo_count,
        },

        "sales": {
            "open":
                True,
        },
    }