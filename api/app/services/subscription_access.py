from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Service, Workspace, WorkspaceService, WorkspaceSubscription


PAID_CONTENT_SERVICES = {"CLIENT_GALLERY", "EVENT_SALES"}
SERVICE_LABELS = {"CLIENT_GALLERY": "Client Gallery", "EVENT_SALES": "Event Sales"}


def require_workspace_service_management(
    workspace_id, service_code: str, db: Session,
) -> WorkspaceService:
    """Allow owners to inspect and clean up configured services after expiry.

    Caller must first verify workspace membership. An expired subscription
    does not remove access to owned records, but administrative suspensions do.
    """
    if service_code not in PAID_CONTENT_SERVICES:
        raise HTTPException(403, "Invalid content service.")
    workspace = db.get(Workspace, workspace_id)
    if workspace is None or workspace.status != "ACTIVE":
        raise HTTPException(403, "This workspace is not active.")
    row = db.execute(select(WorkspaceService, Service).join(
        Service, Service.id == WorkspaceService.service_id,
    ).where(
        WorkspaceService.workspace_id == workspace_id,
        Service.code == service_code,
    )).first()
    if row is None:
        raise HTTPException(403, f"{SERVICE_LABELS[service_code]} is not configured. Choose a plan in Billing.")
    configured, service = row
    if not service.is_active:
        raise HTTPException(403, f"{SERVICE_LABELS[service_code]} is currently unavailable.")
    if configured.status not in {"ACTIVE", "INACTIVE", "EXPIRED"}:
        raise HTTPException(403, f"{SERVICE_LABELS[service_code]} is not available for this workspace.")
    return configured


def require_paid_workspace_service(
    workspace_id, service_code: str, db: Session,
) -> WorkspaceSubscription:
    """Require this service's own current paid subscription for new work.

    Website inclusion does not grant Gallery/Event Sales access. Terms come
    from the purchased subscription snapshot, not today's plan catalogue.
    """
    configured = require_workspace_service_management(workspace_id, service_code, db)
    now = datetime.now(timezone.utc)
    subscription = db.scalar(select(WorkspaceSubscription).where(
        WorkspaceSubscription.workspace_id == workspace_id,
        WorkspaceSubscription.service_id == configured.service_id,
        WorkspaceSubscription.status == "ACTIVE",
        WorkspaceSubscription.current_period_start <= now,
        WorkspaceSubscription.current_period_end > now,
    ))
    if configured.status != "ACTIVE" or subscription is None:
        raise HTTPException(
            403,
            f"An active {SERVICE_LABELS[service_code]} subscription is required for this action. Choose or renew your plan in Billing.",
        )
    return subscription
