from __future__ import annotations

import re
import secrets

from datetime import (
    datetime,
    timedelta,
    timezone,
)

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
    field_validator,
)

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.routes.public_event_sales import (
    event_sales_open,
    get_public_event_workspace,
    get_public_live_event,
)

from app.db.session import get_db

from app.models import (
    EventOrder,
    EventOrderItem,
)

from app.services.event_order_access import (
    create_event_order_access_token,
)

from app.services.event_sales_pricing import (
    MAX_CART_PHOTOS,
    calculate_event_sales_quote,
)


router = APIRouter(
    prefix="/public/events",
    tags=["Public Event Orders"],
)


ORDER_EXPIRY_MINUTES = 30


EMAIL_PATTERN = re.compile(
    r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
)


class PublicCreateOrderRequest(
    BaseModel
):
    customer_name: str = Field(
        min_length=2,
        max_length=150,
    )

    customer_email: str = Field(
        min_length=5,
        max_length=320,
    )

    photo_ids: list[UUID] = Field(
        min_length=1,
        max_length=
            MAX_CART_PHOTOS,
    )


    @field_validator(
        "customer_name"
    )
    @classmethod
    def validate_customer_name(
        cls,
        value: str,
    ) -> str:
        cleaned = " ".join(
            value
            .strip()
            .split()
        )

        if len(cleaned) < 2:
            raise ValueError(
                "Enter your name."
            )

        return cleaned


    @field_validator(
        "customer_email"
    )
    @classmethod
    def validate_customer_email(
        cls,
        value: str,
    ) -> str:
        cleaned = (
            value
            .strip()
            .lower()
        )

        if not EMAIL_PATTERN.match(
            cleaned
        ):
            raise ValueError(
                "Enter a valid email address."
            )

        return cleaned


def cents_to_rm(
    value: int,
) -> float:
    return round(
        value / 100,
        2,
    )


def generate_order_number(
    db: Session,
) -> str:
    date_part = (
        datetime.now(
            timezone.utc
        )
        .strftime(
            "%Y%m%d"
        )
    )

    for _ in range(
        10
    ):
        random_part = (
            secrets
            .token_hex(
                4
            )
            .upper()
        )

        order_number = (
            f"EZF-{date_part}-{random_part}"
        )

        existing = db.scalar(
            select(
                EventOrder.id
            ).where(
                EventOrder.order_number
                == order_number
            )
        )

        if existing is None:
            return order_number

    raise RuntimeError(
        "Unable to generate a unique order number."
    )


@router.post(
    "/{workspace_slug}/{event_slug}/orders",
    status_code=
        status.HTTP_201_CREATED,
)
def create_public_event_order(
    workspace_slug: str,
    event_slug: str,
    payload: PublicCreateOrderRequest,

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


    try:
        order_number = (
            generate_order_number(
                db
            )
        )

        now = datetime.now(
            timezone.utc
        )

        expires_at = (
            now
            + timedelta(
                minutes=
                    ORDER_EXPIRY_MINUTES
            )
        )

        order = EventOrder(
            workspace_id=
                workspace.id,

            event_id=
                event.id,

            order_number=
                order_number,

            customer_name=
                payload.customer_name,

            customer_email=
                payload.customer_email,

            status=
                "PENDING_PAYMENT",

            currency=
                event.currency,

            item_count=
                quote.selected_count,

            unit_price_cents=
                quote.unit_price_cents,

            regular_subtotal_cents=
                quote.regular_subtotal_cents,

            discount_cents=
                quote.discount_cents,

            total_cents=
                quote.total_cents,

            bundle_quantity=
                quote.bundle_quantity,

            bundle_price_cents=
                quote.bundle_price_cents,

            bundle_count=
                quote.bundle_count,

            expires_at=
                expires_at,
        )

        db.add(
            order
        )

        db.flush()


        access_token = (
            create_event_order_access_token(
                order.id
            )
        )


        for photo in quote.photos:
            db.add(
                EventOrderItem(
                    workspace_id=
                        workspace.id,

                    event_id=
                        event.id,

                    order_id=
                        order.id,

                    photo_id=
                        photo.id,

                    unit_price_cents=
                        quote.unit_price_cents,
                )
            )


        db.commit()

        db.refresh(
            order
        )


    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=
                status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "Unable to create the order."
            ),
        )


    return {
        "order": {
            "id":
                str(order.id),

            "order_number":
                order.order_number,

            "status":
                order.status,

            "customer_name":
                order.customer_name,

            "customer_email":
                order.customer_email,

            "currency":
                order.currency,

            "item_count":
                order.item_count,

            "created_at":
                order.created_at,

            "expires_at":
                order.expires_at,
        },

        "access": {
            "token":
                access_token,
        },

        "pricing": {
            "regular_subtotal_cents":
                order.regular_subtotal_cents,

            "regular_subtotal_rm":
                cents_to_rm(
                    order.regular_subtotal_cents
                ),

            "discount_cents":
                order.discount_cents,

            "discount_rm":
                cents_to_rm(
                    order.discount_cents
                ),

            "total_cents":
                order.total_cents,

            "total_rm":
                cents_to_rm(
                    order.total_cents
                ),
        },

        "payment": {
            "required":
                True,

            "ready":
                True,

            "provider":
                "CHIP_FPX",

            "message":
                "FPX payment is ready.",
        },
    }