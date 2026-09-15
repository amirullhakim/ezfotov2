import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.auth import require_platform_admin
from app.db.session import get_db
from app.models import (
    Domain,
    Profile,
    Service,
    Workspace,
    WorkspaceMember,
    WorkspaceService,
)
from app.schemas.admin import UpdateWorkspaceServiceRequest


router = APIRouter(
    prefix="/admin",
    tags=["Platform Admin"],
    dependencies=[Depends(require_platform_admin)],
)


@router.get("/overview")
def get_admin_overview(
    db: Session = Depends(get_db),
):
    total_photographers = db.scalar(
        select(func.count(Profile.id)).where(
            Profile.is_platform_admin.is_(False)
        )
    ) or 0

    total_workspaces = db.scalar(
        select(func.count(Workspace.id))
    ) or 0

    active_workspaces = db.scalar(
        select(func.count(Workspace.id)).where(
            Workspace.status == "ACTIVE"
        )
    ) or 0

    active_services = db.scalar(
        select(func.count(WorkspaceService.id)).where(
            WorkspaceService.status == "ACTIVE"
        )
    ) or 0

    total_domains = db.scalar(
        select(func.count(Domain.id))
    ) or 0

    return {
        "photographers": {
            "total": total_photographers,
        },
        "workspaces": {
            "total": total_workspaces,
            "active": active_workspaces,
        },
        "services": {
            "active": active_services,
        },
        "domains": {
            "total": total_domains,
        },
        "commerce": {
            "available": False,
            "orders": None,
            "gross_sales_rm": None,
            "platform_revenue_rm": None,
        },
    }


@router.get("/workspaces")
def get_admin_workspaces(
    db: Session = Depends(get_db),
):
    workspaces = db.scalars(
        select(Workspace).order_by(
            Workspace.created_at.desc()
        )
    ).all()

    result = []

    for workspace in workspaces:

        owner_row = db.execute(
            select(
                Profile.full_name,
                Profile.email,
                WorkspaceMember.role,
            )
            .join(
                WorkspaceMember,
                WorkspaceMember.profile_id == Profile.id,
            )
            .where(
                WorkspaceMember.workspace_id == workspace.id,
                WorkspaceMember.role == "OWNER",
            )
        ).mappings().first()

        domain = db.scalar(
            select(Domain).where(
                Domain.workspace_id == workspace.id,
                Domain.is_primary.is_(True),
            )
        )

        service_rows = db.execute(
            select(
                Service.code,
                Service.name,
                WorkspaceService.status,
                WorkspaceService.activated_at,
                WorkspaceService.expires_at,
            )
            .join(
                WorkspaceService,
                WorkspaceService.service_id == Service.id,
            )
            .where(
                WorkspaceService.workspace_id == workspace.id
            )
            .order_by(Service.name)
        ).mappings().all()

        result.append(
            {
                "id": str(workspace.id),
                "name": workspace.name,
                "business_name": workspace.business_name,
                "slug": workspace.slug,
                "status": workspace.status,
                "created_at": workspace.created_at,
                "owner": {
                    "full_name": (
                        owner_row["full_name"]
                        if owner_row
                        else None
                    ),
                    "email": (
                        owner_row["email"]
                        if owner_row
                        else None
                    ),
                },
                "domain": (
                    {
                        "hostname": domain.hostname,
                        "verified": domain.is_verified,
                    }
                    if domain
                    else None
                ),
                "services": [
                    {
                        "code": row["code"],
                        "name": row["name"],
                        "status": row["status"],
                        "activated_at": row["activated_at"],
                        "expires_at": row["expires_at"],
                    }
                    for row in service_rows
                ],
            }
        )

    return {
        "workspaces": result,
        "count": len(result),
    }


@router.patch(
    "/workspaces/{workspace_id}/services/{service_code}"
)
def update_workspace_service(
    workspace_id: str,
    service_code: str,
    payload: UpdateWorkspaceServiceRequest,
    db: Session = Depends(get_db),
):
    try:
        parsed_workspace_id = uuid.UUID(
            workspace_id
        )

    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid workspace ID.",
        )

    workspace = db.get(
        Workspace,
        parsed_workspace_id,
    )

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found.",
        )

    service = db.scalar(
        select(Service).where(
            Service.code == service_code.upper()
        )
    )

    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service not found.",
        )

    workspace_service = db.scalar(
        select(WorkspaceService).where(
            WorkspaceService.workspace_id
            == workspace.id,
            WorkspaceService.service_id
            == service.id,
        )
    )

    if not workspace_service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace service record not found.",
        )

    workspace_service.status = payload.status

    if payload.status == "ACTIVE":
        if not workspace_service.activated_at:
            workspace_service.activated_at = (
                datetime.now(timezone.utc)
            )

    db.commit()
    db.refresh(workspace_service)

    return {
        "workspace_id": str(workspace.id),
        "service": {
            "code": service.code,
            "name": service.name,
            "status": workspace_service.status,
            "activated_at": (
                workspace_service.activated_at
            ),
        },
    }