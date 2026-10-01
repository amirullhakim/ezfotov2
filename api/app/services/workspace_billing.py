from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Service,
    ServicePlan,
    Workspace,
    WorkspaceService,
    WorkspaceSubscription,
)


BILLING_SERVICE_CODES = (
    "WEBSITE",
    "CLIENT_GALLERY",
    "EVENT_SALES",
)


def _terms(record: ServicePlan | WorkspaceSubscription) -> dict:
    return {
        "currency": record.currency,
        "price_cents": record.price_cents,
        "billing_interval_months": record.billing_interval_months,
        "commission_bps": record.commission_bps,
        "customer_service_fee_cents": record.customer_service_fee_cents,
        "storage_limit_bytes": record.storage_limit_bytes,
        "active_event_limit": record.active_event_limit,
        "includes_website": record.includes_website,
    }


def list_available_plans(
    db: Session,
    service_code: str | None = None,
) -> list[dict]:
    statement = (
        select(ServicePlan, Service)
        .join(Service, Service.id == ServicePlan.service_id)
        .where(
            ServicePlan.is_active.is_(True),
            Service.is_active.is_(True),
            Service.code.in_(BILLING_SERVICE_CODES),
        )
        .order_by(
            Service.code,
            ServicePlan.price_cents,
            ServicePlan.code,
        )
    )

    if service_code is not None:
        statement = statement.where(Service.code == service_code)

    return [
        {
            "id": str(plan.id),
            "code": plan.code,
            "name": plan.name,
            "service_code": service.code,
            "service_name": service.name,
            **_terms(plan),
        }
        for plan, service in db.execute(statement).all()
    ]


def effective_subscription_status(
    subscription: WorkspaceSubscription,
    now: datetime,
) -> str:
    if subscription.status != "ACTIVE":
        return subscription.status

    start = subscription.current_period_start
    end = subscription.current_period_end

    if start is None or end is None or end <= start:
        return "INVALID"

    if now >= end:
        return "EXPIRED"

    if now < start:
        return "SCHEDULED"

    return "ACTIVE"


def get_workspace_billing(
    workspace: Workspace,
    db: Session,
) -> dict:
    now = datetime.now(timezone.utc)

    services = db.scalars(
        select(Service).where(
            Service.code.in_(BILLING_SERVICE_CODES)
        )
    ).all()

    enabled_services = {
        service.code
        for service in services
        if service.is_active
    }

    rows = db.execute(
        select(WorkspaceSubscription, Service)
        .join(
            Service,
            Service.id == WorkspaceSubscription.service_id,
        )
        .where(
            WorkspaceSubscription.workspace_id == workspace.id,
            Service.code.in_(BILLING_SERVICE_CODES),
        )
        .order_by(Service.code)
    ).all()

    configured_statuses = dict(
        db.execute(
            select(Service.code, WorkspaceService.status)
            .join(
                WorkspaceService,
                WorkspaceService.service_id == Service.id,
            )
            .where(
                WorkspaceService.workspace_id == workspace.id,
                Service.code.in_(BILLING_SERVICE_CODES),
            )
        ).all()
    )

    # Subscription entitlements are separate from the existing route-level
    # service-access checks. Legacy activation flags are not proof of payment.
    entitlements = {
        code: {
            "eligible": False,
            "sources": [],
            "expires_at": None,
            "configured_service_status": configured_statuses.get(code),
        }
        for code in BILLING_SERVICE_CODES
    }

    subscriptions = []

    def grant(
        code: str,
        subscription: WorkspaceSubscription,
        source: str,
    ) -> None:
        entitlement = entitlements[code]
        entitlement["eligible"] = True
        entitlement["sources"].append(
            {
                "subscription_id": str(subscription.id),
                "service_code": source,
                "plan_code": subscription.plan_code_snapshot,
                "included": source != code,
                "expires_at": subscription.current_period_end,
            }
        )

        expiry = entitlement["expires_at"]
        if expiry is None or subscription.current_period_end > expiry:
            entitlement["expires_at"] = subscription.current_period_end

    for subscription, service in rows:
        effective_status = effective_subscription_status(
            subscription,
            now,
        )

        eligible = (
            effective_status == "ACTIVE"
            and workspace.status == "ACTIVE"
            and service.code in enabled_services
        )

        subscriptions.append(
            {
                "id": str(subscription.id),
                "service_code": service.code,
                "plan_id": str(subscription.plan_id),
                "plan_code": subscription.plan_code_snapshot,
                "plan_name": subscription.plan_name_snapshot,
                "stored_status": subscription.status,
                "effective_status": effective_status,
                "eligible": eligible,
                "current_period_start": subscription.current_period_start,
                "current_period_end": subscription.current_period_end,
                "cancel_at_period_end": subscription.cancel_at_period_end,
                "canceled_at": subscription.canceled_at,
                **_terms(subscription),
            }
        )

        if eligible:
            grant(service.code, subscription, service.code)

            if (
                subscription.includes_website
                and service.code in ("CLIENT_GALLERY", "EVENT_SALES")
                and "WEBSITE" in enabled_services
            ):
                grant("WEBSITE", subscription, service.code)

    return {
        "workspace_id": str(workspace.id),
        "workspace_name": workspace.name,
        "workspace_status": workspace.status,
        "as_of": now,
        "subscriptions": subscriptions,
        "subscription_entitlements": entitlements,
    }