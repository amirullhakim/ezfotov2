from __future__ import annotations

from datetime import (
    datetime,
    timezone,
)

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Request,
    status,
)

from pydantic import (
    BaseModel,
    Field,
)

from urllib.parse import urlsplit

from app.core.config import settings

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.routes.public_event_sales import (
    get_public_event_workspace,
)

from app.db.session import get_db

from app.models import (
    Domain,
    EventGallery,
    EventOrder,
)

from app.services.chip_payments import (
    ChipPaymentError,
    ChipPurchaseNotFound,
    create_chip_fpx_purchase,
    build_event_payment_redirects,
    get_chip_purchase,
)

from app.services.event_order_access import (
    verify_event_order_access_token,
)


router = APIRouter(
    prefix="/public/events",
    tags=["Public Event Payments"],
)


class StartEventPaymentRequest(
    BaseModel
):
    access_token: str = Field(
        min_length=32,
        max_length=200,
    )
    return_origin: str | None = Field(default=None, min_length=1, max_length=2048)



def _normalize_return_origin(value: str) -> str:
    try:
        parsed = urlsplit(value)
        if (
            not value or value != value.strip()
            or any(ord(char) <= 32 or ord(char) == 127 for char in value)
            or "\\" in value
            or parsed.scheme not in {"http", "https"}
            or not parsed.hostname or parsed.username is not None
            or parsed.password is not None or parsed.path not in {"", "/"}
            or parsed.query or parsed.fragment
        ):
            raise ValueError("Invalid origin")
        port = parsed.port
        host = parsed.hostname.lower()
        if ":" in host:
            host = f"[{host}]"
        if port is not None and port != (443 if parsed.scheme == "https" else 80):
            host += f":{port}"
        return f"{parsed.scheme}://{host}"
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Invalid payment return address.") from exc


def _resolve_payment_return_origin(*, payload, request, workspace, db) -> str:
    browser_origin = request.headers.get("origin")
    candidate = _normalize_return_origin(
        payload.return_origin or browser_origin or settings.frontend_url
    )
    if browser_origin and candidate != _normalize_return_origin(browser_origin):
        raise HTTPException(status_code=422, detail="Payment return address must match this browser's origin.")

    frontend = _normalize_return_origin(settings.frontend_url)
    if candidate == frontend:
        return candidate

    root_domain = settings.vercel_root_domain.strip().lower().rstrip(".")
    tenant = f"https://{workspace.slug}.{root_domain}"
    if candidate == tenant:
        return candidate

    parsed = urlsplit(candidate)
    # Custom addresses must be verified and belong to this exact workspace.
    if parsed.scheme == "https" and parsed.port is None:
        domain = db.scalar(
            select(Domain).where(
                Domain.workspace_id == workspace.id,
                Domain.hostname == parsed.hostname,
                Domain.is_verified.is_(True),
            )
        )
        if domain is not None:
            return candidate

    raise HTTPException(status_code=422, detail="This payment return address is not configured for this workspace.")


def _payment_response(
    *,
    order: EventOrder,
    purchase_id: str,
    checkout_url: str,
    reused: bool,
):
    return {
        "order": {
            "order_number":
                order.order_number,

            "status":
                order.status,

            "currency":
                order.currency,

            "total_cents":
                order.total_cents,

            "total_rm":
                round(
                    order.total_cents
                    / 100,
                    2,
                ),
        },

        "payment": {
            "provider":
                "CHIP_FPX",

            "purchase_id":
                purchase_id,

            "checkout_url":
                checkout_url,

            "reused":
                reused,

            "mode":
                "test",
        },
    }


@router.post(
    (
        "/{workspace_slug}/"
        "{event_slug}/"
        "orders/{order_number}/payment"
    )
)
def start_event_fpx_payment(
    workspace_slug: str,
    event_slug: str,
    order_number: str,
    payload: StartEventPaymentRequest,
    request: Request,

    db: Session = Depends(
        get_db
    ),
):
    # --------------------------------------------------
    # WORKSPACE
    # --------------------------------------------------

    workspace = (
        get_public_event_workspace(
            db=db,
            workspace_slug=
                workspace_slug,
        )
    )


    # --------------------------------------------------
    # EVENT
    # --------------------------------------------------
    #
    # We intentionally do not require the event to
    # still be LIVE here.
    #
    # A customer may already have created a valid
    # pending order just before the event closes.
    # That order can still be paid until expires_at.
    #

    event = db.scalar(
        select(
            EventGallery
        ).where(
            EventGallery.workspace_id
            == workspace.id,

            EventGallery.slug
            == event_slug,
        )
    )


    if event is None:
        raise HTTPException(
            status_code=
                status.HTTP_404_NOT_FOUND,
            detail=
                "Event not found.",
        )


    # --------------------------------------------------
    # LOCK ORDER
    # --------------------------------------------------
    #
    # FOR UPDATE prevents two rapid clicks from
    # creating two CHIP purchases for the same order.
    #

    order = db.scalar(
        select(
            EventOrder
        )
        .where(
            EventOrder.workspace_id
            == workspace.id,

            EventOrder.event_id
            == event.id,

            EventOrder.order_number
            == order_number,
        )
        .with_for_update()
    )


    if order is None:
        raise HTTPException(
            status_code=
                status.HTTP_404_NOT_FOUND,
            detail=
                "Order not found.",
        )


    # --------------------------------------------------
    # ACCESS TOKEN
    # --------------------------------------------------

    if not verify_event_order_access_token(
        order_id=
            order.id,

        token=
            payload.access_token,
    ):
        db.rollback()

        raise HTTPException(
            status_code=
                status.HTTP_404_NOT_FOUND,
            detail=
                "Order not found.",
        )


    return_origin = _resolve_payment_return_origin(
        payload=payload, request=request, workspace=workspace, db=db,
    )
    expected_redirects = build_event_payment_redirects(
        order_number=order.order_number, return_origin=return_origin,
    )

    # --------------------------------------------------
    # STATUS
    # --------------------------------------------------

    if order.status == "PAID":
        db.rollback()

        raise HTTPException(
            status_code=
                status.HTTP_409_CONFLICT,
            detail=
                "This order has already been paid.",
        )


    if order.status != "PENDING_PAYMENT":
        db.rollback()

        raise HTTPException(
            status_code=
                status.HTTP_409_CONFLICT,
            detail=(
                "This order is no longer "
                "available for payment."
            ),
        )


    now = datetime.now(
        timezone.utc
    )


    if (
        order.expires_at
        and order.expires_at <= now
    ):
        order.status = "EXPIRED"

        db.commit()

        raise HTTPException(
            status_code=
                status.HTTP_409_CONFLICT,
            detail=
                "This order has expired.",
        )


    if order.currency.upper() != "MYR":
        db.rollback()

        raise HTTPException(
            status_code=
                status.HTTP_409_CONFLICT,
            detail=
                "FPX requires an MYR order.",
        )


    if order.total_cents <= 0:
        db.rollback()

        raise HTTPException(
            status_code=
                status.HTTP_409_CONFLICT,
            detail=
                "This order has no payable amount.",
        )


    # --------------------------------------------------
    # REUSE EXISTING CHIP PURCHASE
    # --------------------------------------------------

    if order.payment_reference:
        if (
            order.payment_provider
            != "CHIP_FPX"
        ):
            db.rollback()

            raise HTTPException(
                status_code=
                    status.HTTP_409_CONFLICT,
                detail=(
                    "This order already has "
                    "another payment provider."
                ),
            )


        try:
            existing_purchase = (
                get_chip_purchase(
                    order.payment_reference
                )
            )

        except ChipPurchaseNotFound:
            # Purchase no longer exists at CHIP.
            # Safe to create a replacement.
            order.payment_reference = None
            order.payment_provider = None

            db.flush()

        except ChipPaymentError as exc:
            db.rollback()

            raise HTTPException(
                status_code=
                    status.HTTP_502_BAD_GATEWAY,
                detail=(
                    "Unable to check the existing "
                    "FPX payment. Please try again."
                ),
            ) from exc

        else:
            checkout_url = (
                existing_purchase.get(
                    "checkout_url"
                )
            )

            if checkout_url and any(
                existing_purchase.get(key) != value
                for key, value in expected_redirects.items()
            ):
                db.rollback()
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "This payment was started from another website address. "
                        "Check the existing order's payment status before starting a new order."
                    ),
                )

            if checkout_url:
                db.commit()

                return _payment_response(
                    order=
                        order,

                    purchase_id=
                        order.payment_reference,

                    checkout_url=
                        str(checkout_url),

                    reused=
                        True,
                )


            db.rollback()

            raise HTTPException(
                status_code=
                    status.HTTP_409_CONFLICT,
                detail=(
                    "An FPX payment already exists "
                    "for this order and is being "
                    "processed."
                ),
            )


    # --------------------------------------------------
    # CREATE CHIP PURCHASE
    # --------------------------------------------------

    try:
        purchase = (
            create_chip_fpx_purchase(
                order=
                    order,
                return_origin=return_origin,
            )
        )

    except ChipPaymentError as exc:
        db.rollback()

        raise HTTPException(
            status_code=
                status.HTTP_502_BAD_GATEWAY,
            detail=(
                "Unable to start FPX payment. "
                "Please try again."
            ),
        ) from exc


    purchase_id = str(
        purchase.get(
            "id"
        )
        or ""
    ).strip()


    checkout_url = str(
        purchase.get(
            "checkout_url"
        )
        or ""
    ).strip()


    if (
        not purchase_id
        or not checkout_url
    ):
        db.rollback()

        raise HTTPException(
            status_code=
                status.HTTP_502_BAD_GATEWAY,
            detail=(
                "CHIP did not return a valid "
                "payment checkout."
            ),
        )


    # --------------------------------------------------
    # SAVE PROVIDER REFERENCE
    # --------------------------------------------------

    order.payment_provider = (
        "CHIP_FPX"
    )

    order.payment_reference = (
        purchase_id
    )


    db.commit()

    db.refresh(
        order
    )


    return _payment_response(
        order=
            order,

        purchase_id=
            purchase_id,

        checkout_url=
            checkout_url,

        reused=
            False,
    )