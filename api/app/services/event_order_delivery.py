from __future__ import annotations

import logging
import uuid

from datetime import datetime, timedelta, timezone
from urllib.parse import quote

from sqlalchemy import select

from app.core.config import settings
from app.db.session import SessionLocal
from app.models import EventOrder
from app.services.email_service import send_transactional_email
from app.services.event_order_access import (
    create_event_order_access_token,
)
from app.services.event_order_email import render_paid_order_email


logger = logging.getLogger(__name__)

CLAIM_TIMEOUT = timedelta(minutes=30)


def _claim_paid_order(order_id: uuid.UUID) -> tuple[EventOrder, datetime] | None:
    with SessionLocal() as db:
        order = db.scalar(
            select(EventOrder)
            .where(EventOrder.id == order_id)
            .with_for_update()
        )

        if order is None or order.status != "PAID":
            return None

        if order.confirmation_email_sent_at is not None:
            return None

        now = datetime.now(timezone.utc)
        claimed_at = order.confirmation_email_claimed_at

        if claimed_at is not None:
            if claimed_at.tzinfo is None:
                claimed_at = claimed_at.replace(tzinfo=timezone.utc)

            if now - claimed_at < CLAIM_TIMEOUT:
                return None

        order.confirmation_email_claimed_at = now
        order.confirmation_email_attempts += 1

        db.commit()
        return order, now


def _finish_attempt(
    *,
    order_id: uuid.UUID,
    claimed_at: datetime,
    sent: bool,
) -> None:
    with SessionLocal() as db:
        order = db.scalar(
            select(EventOrder)
            .where(EventOrder.id == order_id)
            .with_for_update()
        )

        if order is None:
            return

        # A newer attempt may have replaced this claim.
        if order.confirmation_email_claimed_at != claimed_at:
            return

        if sent:
            order.confirmation_email_sent_at = datetime.now(timezone.utc)

        order.confirmation_email_claimed_at = None
        db.commit()


def _delivery_url(order: EventOrder) -> str:
    frontend_url = settings.frontend_url.rstrip("/")

    if not frontend_url:
        raise ValueError("FRONTEND_URL is not configured.")

    order_number = quote(order.order_number, safe="")
    token = create_event_order_access_token(order.id)

    return (
        f"{frontend_url}/order/{order_number}"
        f"#access={token}"
    )


async def send_paid_order_confirmation(order_id: uuid.UUID) -> None:
    """Send a verified paid order's receipt, with database retry tracking."""

    try:
        claimed = _claim_paid_order(order_id)
    except Exception:
        logger.exception(
            "Could not claim confirmation email for order %s",
            order_id,
        )
        return

    if claimed is None:
        return

    order, claimed_at = claimed
    sent = False

    try:
        email = render_paid_order_email(
            order=order,
            delivery_url=_delivery_url(order),
            reply_to="ezfotoo@gmail.com",
        )

        response = await send_transactional_email(
            to_email=email.to_email,
            subject=email.subject,
            html=email.html,
            text=email.text,
            reply_to=email.reply_to,
            idempotency_key=f"event-order-paid/{order.id}",
        )

        if not response.get("id"):
            raise RuntimeError("Resend did not return an email ID.")

        sent = True

    except Exception:
        logger.exception(
            "Could not send confirmation email for order %s",
            order_id,
        )

    try:
        _finish_attempt(
            order_id=order_id,
            claimed_at=claimed_at,
            sent=sent,
        )
    except Exception:
        logger.exception(
            "Could not save confirmation email result for order %s",
            order_id,
        )