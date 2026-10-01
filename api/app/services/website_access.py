from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Service, WebsiteSettings, Workspace, WorkspaceService
from app.services.workspace_billing import get_workspace_billing


def require_website_draft_access(workspace: Workspace, db: Session) -> None:
    if workspace.status != "ACTIVE":
        raise HTTPException(403, "This workspace is not active.")
    service = db.scalar(select(Service).where(Service.code == "WEBSITE"))
    if service is None or not service.is_active:
        raise HTTPException(403, "Website service is currently unavailable.")
    configured = db.scalar(select(WorkspaceService).where(
        WorkspaceService.workspace_id == workspace.id,
        WorkspaceService.service_id == service.id,
    ))
    # Missing/INACTIVE configuration must not prevent free draft editing.
    # Explicit administrative suspensions still apply.
    if configured and configured.status in {"SUSPENDED", "DISABLED"}:
        raise HTTPException(403, "Website service is suspended for this workspace.")


def get_website_publication_access(workspace: Workspace, db: Session) -> dict:
    access = {"can_publish": False, "publication_expires_at": None}
    if workspace.status != "ACTIVE":
        return access
    configured = db.scalar(select(WorkspaceService).join(
        Service, Service.id == WorkspaceService.service_id,
    ).where(
        WorkspaceService.workspace_id == workspace.id,
        WorkspaceService.status == "ACTIVE",
        Service.code == "WEBSITE", Service.is_active.is_(True),
    ))
    if configured is None:
        return access
    entitlement = get_workspace_billing(workspace, db)["subscription_entitlements"]["WEBSITE"]
    if entitlement["eligible"]:
        access["can_publish"] = True
        access["publication_expires_at"] = entitlement["expires_at"]
    return access


def require_website_publication(workspace: Workspace, db: Session) -> None:
    if not get_website_publication_access(workspace, db)["can_publish"]:
        raise HTTPException(
            403,
            "An active Website plan, or a Gallery or Event Sales plan that includes Website, is required to publish. Choose a plan in Billing.",
        )


def website_settings_response(
    settings: WebsiteSettings, workspace: Workspace, db: Session,
) -> dict:
    access = get_website_publication_access(workspace, db)
    values = {
        column.name: getattr(settings, column.name)
        for column in WebsiteSettings.__table__.columns
    }
    # Return effective visibility so an expired account can keep saving
    # drafts. Preserve stored publication intent until an explicit save.
    values["is_published"] = bool(settings.is_published and access["can_publish"])
    return {**values, **access}
