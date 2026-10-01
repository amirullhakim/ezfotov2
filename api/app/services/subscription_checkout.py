from __future__ import annotations

import calendar
import logging
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from urllib.parse import quote, urlparse

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import (
    Service, ServicePlan, SubscriptionBillingOrder, Workspace,
    WorkspaceMember, WorkspaceService, WorkspaceSubscription,
)
from app.services.chip_payments import (
    ChipPaymentError, _get_chip_config, _request_chip, get_chip_purchase,
)
from app.services.workspace_billing import BILLING_SERVICE_CODES


logger = logging.getLogger(__name__)
TERM_FIELDS = (
    "currency", "price_cents", "billing_interval_months", "commission_bps",
    "customer_service_fee_cents", "storage_limit_bytes", "active_event_limit",
    "includes_website",
)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def add_months(value: datetime, months: int) -> datetime:
    month_index = value.year * 12 + value.month - 1 + months
    year, zero_month = divmod(month_index, 12)
    month = zero_month + 1
    day = min(value.day, calendar.monthrange(year, month)[1])
    return value.replace(year=year, month=month, day=day)


def integer(value: object) -> int | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        number = Decimal(str(value))
        if not number.is_finite() or number != number.to_integral_value():
            return None
        return int(number)
    except (InvalidOperation, ValueError, OverflowError):
        return None


def validate_purchase(order: SubscriptionBillingOrder, purchase: dict) -> str:
    purchase_id = str(purchase.get("id") or "").strip()
    try:
        uuid.UUID(purchase_id)
    except ValueError:
        raise HTTPException(409, "Invalid CHIP purchase ID.")
    if order.payment_reference and order.payment_reference != purchase_id:
        raise HTTPException(409, "CHIP purchase reference mismatch.")
    if str(purchase.get("reference") or "") != order.order_number:
        raise HTTPException(409, "CHIP billing order reference mismatch.")
    brand = str(purchase.get("brand_id") or "").strip()
    if not brand or brand != (settings.chip_brand_id or "").strip():
        raise HTTPException(409, "CHIP brand mismatch.")
    details = purchase.get("purchase")
    if not isinstance(details, dict):
        raise HTTPException(409, "Missing CHIP purchase details.")
    if str(details.get("currency") or "").upper() != order.currency:
        raise HTTPException(409, "CHIP currency mismatch.")
    if integer(details.get("total")) != order.total_cents:
        raise HTTPException(409, "CHIP billing amount mismatch.")
    return purchase_id


def order_response(order: SubscriptionBillingOrder) -> dict:
    return {
        "order_number": order.order_number,
        "plan_code": order.plan_code_snapshot,
        "plan_name": order.plan_name_snapshot,
        "currency": order.currency,
        "total_cents": order.total_cents,
        "status": order.status,
        "checkout_url": order.checkout_url,
        "expires_at": order.expires_at,
        "paid_at": order.paid_at,
        "activated_at": order.activated_at,
        "subscription_id": str(order.subscription_id) if order.subscription_id else None,
        "period_start": order.period_start,
        "period_end": order.period_end,
        "activation_pending": order.status == "PAID" and order.activated_at is None,
    }


def lock_workspace(db: Session, workspace_id: uuid.UUID) -> Workspace:
    workspace = db.scalar(
        select(Workspace).where(Workspace.id == workspace_id)
        .with_for_update().execution_options(populate_existing=True)
    )
    if workspace is None:
        raise HTTPException(404, "Workspace not found.")
    return workspace


def active_period(subscription: WorkspaceSubscription | None, now: datetime) -> bool:
    return bool(
        subscription and subscription.status == "ACTIVE"
        and subscription.current_period_start and subscription.current_period_end
        and subscription.current_period_end > now
    )


def sync_workspace_services(db: Session, workspace_id: uuid.UUID, now: datetime) -> None:
    # Merge website access from all paid subscriptions; renewing one service
    # must not shorten website access supplied by another service.
    db.flush()
    subscriptions = db.scalars(select(WorkspaceSubscription).where(
        WorkspaceSubscription.workspace_id == workspace_id,
        WorkspaceSubscription.status == "ACTIVE",
        WorkspaceSubscription.current_period_start <= now,
        WorkspaceSubscription.current_period_end > now,
    )).all()
    services = db.scalars(select(Service).where(
        Service.code.in_(BILLING_SERVICE_CODES), Service.is_active.is_(True),
    )).all()
    website = next((s for s in services if s.code == "WEBSITE"), None)
    expiries: dict[uuid.UUID, datetime] = {}
    for subscription in subscriptions:
        end = subscription.current_period_end
        expiries[subscription.service_id] = max(
            end, expiries.get(subscription.service_id, end),
        )
        if website and subscription.includes_website:
            expiries[website.id] = max(end, expiries.get(website.id, end))
    for service in services:
        expiry = expiries.get(service.id)
        if expiry is None:
            continue
        configured = db.scalar(select(WorkspaceService).where(
            WorkspaceService.workspace_id == workspace_id,
            WorkspaceService.service_id == service.id,
        ))
        if configured is None:
            configured = WorkspaceService(workspace_id=workspace_id, service_id=service.id)
            db.add(configured)
        # Preserve a service suspension imposed by platform administration.
        if configured.status in {"SUSPENDED", "DISABLED"}:
            continue
        configured.status = "ACTIVE"
        configured.activated_at = configured.activated_at or now
        configured.expires_at = expiry


def apply_purchase(db: Session, order_id: uuid.UUID, purchase: dict) -> dict:
    order = db.get(SubscriptionBillingOrder, order_id)
    if order is None:
        raise HTTPException(404, "Billing order not found.")
    workspace = lock_workspace(db, order.workspace_id)
    order = db.scalar(select(SubscriptionBillingOrder).where(
        SubscriptionBillingOrder.id == order_id,
    ).with_for_update().execution_options(populate_existing=True))
    purchase_id = validate_purchase(order, purchase)
    chip_status = str(purchase.get("status") or "").lower()
    now = utc_now()

    # The payment reference can also be recovered from a verified callback
    # when CHIP created a purchase but its creation response was interrupted.
    order.payment_reference = purchase_id
    if chip_status == "paid" and order.status != "REFUNDED":
        order.status = "PAID"
        order.paid_at = order.paid_at or now
        if order.activated_at is None:
            subscription = db.scalar(select(WorkspaceSubscription).where(
                WorkspaceSubscription.workspace_id == order.workspace_id,
                WorkspaceSubscription.service_id == order.service_id,
            ).with_for_update())
            ongoing = active_period(subscription, now)
            same_terms = bool(subscription) and (
                subscription.plan_id == order.plan_id
                and all(getattr(subscription, field) == getattr(order, field) for field in TERM_FIELDS)
            )
            # A late payment for an incompatible plan needs review rather
            # than silently overwriting an already-paid active contract.
            if ongoing and not same_terms:
                logger.error("Subscription activation needs review: %s", order.order_number)
            elif workspace.status != "ACTIVE":
                logger.error("Paid billing order belongs to inactive workspace: %s", order.order_number)
            else:
                start = subscription.current_period_end if ongoing else now
                end = add_months(start, order.billing_interval_months)
                if subscription is None:
                    subscription = WorkspaceSubscription(
                        id=uuid.uuid4(), workspace_id=order.workspace_id,
                        service_id=order.service_id,
                    )
                    db.add(subscription)
                subscription.plan_id = order.plan_id
                subscription.plan_code_snapshot = order.plan_code_snapshot
                subscription.plan_name_snapshot = order.plan_name_snapshot
                for field in TERM_FIELDS:
                    setattr(subscription, field, getattr(order, field))
                subscription.status = "ACTIVE"
                if not ongoing:
                    subscription.current_period_start = start
                subscription.current_period_end = end
                subscription.cancel_at_period_end = False
                subscription.canceled_at = None
                # Flush the subscription before assigning its composite FK.
                db.flush()
                order.subscription_id = subscription.id
                order.period_start = start
                order.period_end = end
                order.activated_at = now
                sync_workspace_services(db, order.workspace_id, now)
    elif order.paid_at is None:
        statuses = {
            "cancelled": "CANCELLED", "canceled": "CANCELLED",
            "error": "PAYMENT_FAILED", "failed": "PAYMENT_FAILED",
            "failure": "PAYMENT_FAILED", "expired": "EXPIRED",
        }
        if chip_status in statuses:
            order.status = statuses[chip_status]
    db.commit()
    return order_response(order)


def reconcile_billing_order(db: Session, order: SubscriptionBillingOrder) -> dict:
    if order.activated_at or order.status == "REFUNDED" or not order.payment_reference:
        return order_response(order)
    order_id, purchase_id = order.id, order.payment_reference
    # Release read transactions before waiting on the provider.
    db.rollback()
    try:
        purchase = get_chip_purchase(purchase_id)
    except ChipPaymentError as exc:
        raise HTTPException(502, "Unable to verify your payment with CHIP. Please refresh shortly.") from exc
    return apply_purchase(db, order_id, purchase)


def handle_billing_callback(db: Session, purchase_id: str, reference: str) -> dict | None:
    try:
        uuid.UUID(purchase_id)
    except ValueError:
        return None
    order = db.scalar(select(SubscriptionBillingOrder).where(
        SubscriptionBillingOrder.payment_provider == "CHIP",
        SubscriptionBillingOrder.payment_reference == purchase_id,
    ))
    if order is None and reference.startswith("EZB-"):
        order = db.scalar(select(SubscriptionBillingOrder).where(
            SubscriptionBillingOrder.order_number == reference,
            SubscriptionBillingOrder.payment_provider == "CHIP",
        ))
    if order is None:
        db.rollback()
        return None
    order_id = order.id
    db.rollback()
    try:
        purchase = get_chip_purchase(purchase_id)
    except ChipPaymentError as exc:
        raise HTTPException(502, "Unable to verify CHIP subscription payment.") from exc
    return apply_purchase(db, order_id, purchase)


def create_purchase(order: SubscriptionBillingOrder) -> dict:
    _, brand_id, _ = _get_chip_config()
    frontend = settings.frontend_url.rstrip("/")
    encoded = quote(order.order_number, safe="")
    callback = (settings.chip_callback_url or "").strip()
    if not callback or urlparse(callback).scheme != "https":
        raise ChipPaymentError("Configure a public HTTPS CHIP_CALLBACK_URL before checkout.")
    return _request_chip(method="POST", path="/purchases/", json_payload={
        "brand_id": brand_id,
        "client": {"email": order.payer_email},
        "purchase": {
            "currency": order.currency, "language": "en", "due_strict": True,
            "products": [{"name": f"EZFOTOO {order.plan_name_snapshot}",
                          "price": order.total_cents, "quantity": "1"}],
            "notes": f"{order.billing_interval_months}-month subscription | {order.order_number}",
        },
        "reference": order.order_number,
        "due": int(order.expires_at.timestamp()),
        "payment_method_whitelist": ["fpx"], "send_receipt": False,
        "success_callback": callback,
        "success_redirect": f"{frontend}/dashboard/billing?billing_order={encoded}&result=success",
        "failure_redirect": f"{frontend}/dashboard/billing?billing_order={encoded}&result=failure",
        "cancel_redirect": f"{frontend}/dashboard/billing?billing_order={encoded}&result=cancelled",
    })


def start_checkout(
    db: Session, *, workspace_id: uuid.UUID, profile_id: uuid.UUID,
    email: str, plan_code: str, idempotency_key: uuid.UUID,
) -> dict:
    workspace = lock_workspace(db, workspace_id)
    membership = db.scalar(select(WorkspaceMember).where(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.profile_id == profile_id,
        WorkspaceMember.status == "ACTIVE", WorkspaceMember.role == "OWNER",
    ))
    if membership is None:
        raise HTTPException(403, "Only the workspace owner can purchase a plan.")
    if workspace.status != "ACTIVE":
        raise HTTPException(403, "This workspace cannot purchase a plan.")
    if not email or len(email) > 320 or "@" not in email:
        raise HTTPException(422, "Your authenticated account needs a valid email address.")
    # Check configuration before saving an order.
    try:
        _get_chip_config()
        callback = (settings.chip_callback_url or "").strip()
        if not callback or urlparse(callback).scheme != "https":
            raise ChipPaymentError("Missing public HTTPS callback URL.")
    except ChipPaymentError as exc:
        raise HTTPException(503, "Subscription payments are not configured yet.") from exc

    existing = db.scalar(select(SubscriptionBillingOrder).where(
        SubscriptionBillingOrder.workspace_id == workspace_id,
        SubscriptionBillingOrder.idempotency_key == idempotency_key,
    ))
    if existing:
        if existing.plan_code_snapshot != plan_code:
            raise HTTPException(409, "This checkout request already belongs to another plan.")
        return order_response(existing)
    row = db.execute(select(ServicePlan, Service).join(
        Service, Service.id == ServicePlan.service_id,
    ).where(
        ServicePlan.code == plan_code, ServicePlan.is_active.is_(True),
        Service.is_active.is_(True), Service.code.in_(BILLING_SERVICE_CODES),
    )).first()
    if row is None:
        raise HTTPException(404, "This plan is not available.")
    plan, service = row
    now = utc_now()
    current = db.scalar(select(WorkspaceSubscription).where(
        WorkspaceSubscription.workspace_id == workspace_id,
        WorkspaceSubscription.service_id == service.id,
    ))
    if active_period(current, now) and (
        current.plan_id != plan.id or any(
            getattr(current, field) != getattr(plan, field) for field in TERM_FIELDS
        )
    ):
        raise HTTPException(409, "You can renew your current plan. Plan changes are available after its period ends.")
    if service.code == "WEBSITE":
        included = db.scalar(select(WorkspaceSubscription.id).where(
            WorkspaceSubscription.workspace_id == workspace_id,
            WorkspaceSubscription.status == "ACTIVE",
            WorkspaceSubscription.includes_website.is_(True),
            WorkspaceSubscription.current_period_start <= now,
            WorkspaceSubscription.current_period_end > now,
        ))
        if included:
            raise HTTPException(409, "Website publishing is already included in your active plan.")
    pending = db.scalar(select(SubscriptionBillingOrder).where(
        SubscriptionBillingOrder.workspace_id == workspace_id,
        SubscriptionBillingOrder.service_id == service.id,
        SubscriptionBillingOrder.status.in_(["PENDING_PAYMENT", "PAYMENT_FAILED"]),
        SubscriptionBillingOrder.expires_at > now,
    ).order_by(SubscriptionBillingOrder.created_at.desc()))
    if pending and (pending.status == "PENDING_PAYMENT" or pending.payment_reference):
        if pending.plan_id != plan.id:
            raise HTTPException(409, "Complete the existing checkout for this service, or wait until it expires.")
        return order_response(pending)
    if plan.price_cents <= 0:
        raise HTTPException(409, "This plan cannot be purchased through checkout.")
    order = SubscriptionBillingOrder(
        id=uuid.uuid4(), workspace_id=workspace_id, service_id=service.id,
        plan_id=plan.id, created_by_profile_id=profile_id,
        idempotency_key=idempotency_key,
        order_number=f"EZB-{now:%Y%m%d}-{uuid.uuid4().hex[:16].upper()}",
        payer_email=email, plan_code_snapshot=plan.code,
        plan_name_snapshot=plan.name, status="PENDING_PAYMENT",
        total_cents=plan.price_cents, payment_provider="CHIP",
        expires_at=now + timedelta(minutes=30),
        **{field: getattr(plan, field) for field in TERM_FIELDS},
    )
    db.add(order)
    # Persist the intent before calling CHIP. A repeated request never makes
    # a second provider purchase for an existing billing order.
    db.commit()
    order_id = order.id
    lock_workspace(db, workspace_id)
    order = db.scalar(select(SubscriptionBillingOrder).where(
        SubscriptionBillingOrder.id == order_id,
    ).with_for_update().execution_options(populate_existing=True))
    if order.payment_reference or order.paid_at:
        return order_response(order)
    try:
        purchase = create_purchase(order)
        purchase_id = validate_purchase(order, purchase)
        checkout_url = str(purchase.get("checkout_url") or "").strip()
        parsed = urlparse(checkout_url)
        if parsed.scheme != "https" or not parsed.netloc or parsed.username:
            raise ChipPaymentError("CHIP did not return a valid HTTPS checkout URL.")
        order.payment_reference = purchase_id
        order.checkout_url = checkout_url
        db.commit()
    except (ChipPaymentError, HTTPException) as exc:
        order.status = "PAYMENT_FAILED"
        db.commit()
        logger.warning("Unable to prepare subscription checkout %s", order.order_number)
        raise HTTPException(502, "Unable to prepare CHIP checkout. Refresh Billing and try again.") from exc
    return order_response(order)
