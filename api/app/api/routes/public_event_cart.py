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

from sqlalchemy.orm import Session

from app.api.routes.public_event_sales import (
    event_sales_open,
    get_public_event_workspace,
    get_public_live_event,
)

from app.db.session import get_db

from app.services.event_sales_pricing import (
    MAX_CART_PHOTOS,
    calculate_event_sales_quote,
)


router = APIRouter(
    prefix="/public/events",
    tags=["Public Event Cart"],
)


class PublicEventQuoteRequest(
    BaseModel
):
    photo_ids: list[UUID] = Field(
        min_length=1,
        max_length=
            MAX_CART_PHOTOS,
    )


def cents_to_rm(
    value: int,
) -> float:
    return round(
        value / 100,
        2,
    )


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


    try:
        quote = (
            calculate_event_sales_quote(
                db=db,
                event=event,
                photo_ids=
                    payload.photo_ids,
            )
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=
                status.HTTP_400_BAD_REQUEST,
            detail=
                str(exc),
        ) from exc


    return {
        "event_id":
            str(event.id),

        "currency":
            event.currency,

        "selected_count":
            quote.selected_count,

        "selected_photo_ids": [
            str(
                photo.id
            )
            for photo
            in quote.photos
        ],

        "pricing": {
            "unit_price_cents":
                quote.unit_price_cents,

            "unit_price_rm":
                cents_to_rm(
                    quote.unit_price_cents
                ),

            "regular_subtotal_cents":
                quote.regular_subtotal_cents,

            "regular_subtotal_rm":
                cents_to_rm(
                    quote.regular_subtotal_cents
                ),

            "total_cents":
                quote.total_cents,

            "total_rm":
                cents_to_rm(
                    quote.total_cents
                ),

            "savings_cents":
                quote.discount_cents,

            "savings_rm":
                cents_to_rm(
                    quote.discount_cents
                ),
        },

        "bundle": {
            "configured":
                quote.bundle_configured,

            "applied":
                quote.bundle_applied,

            "quantity":
                quote.bundle_quantity,

            "price_cents":
                quote.bundle_price_cents,

            "price_rm":
                cents_to_rm(
                    quote.bundle_price_cents
                ),

            "bundle_count":
                quote.bundle_count,

            "bundled_photo_count":
                quote.bundled_photo_count,

            "remainder_photo_count":
                quote.remainder_photo_count,
        },

        "sales": {
            "open":
                True,
        },
    }