import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.session import get_db
from app.models import (
    Domain,
    Service,
    Workspace,
    WorkspaceMember,
    WorkspaceService,
)


router = APIRouter(
    prefix="/workspaces",
    tags=["Workspaces"],
)


@router.get("/me")
def get_my_workspace(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        auth_user_id = uuid.UUID(current_user["id"])
    except (KeyError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authenticated user.",
        )

    membership = db.scalar(
        select(WorkspaceMember).where(
            WorkspaceMember.profile_id == auth_user_id,
            WorkspaceMember.status == "ACTIVE",
        )
    )

    if not membership:
        return {
            "onboarded": False,
            "workspace": None,
        }

    workspace = db.get(
        Workspace,
        membership.workspace_id,
    )

    if not workspace:
        return {
            "onboarded": False,
            "workspace": None,
        }

    service_rows = (
        db.execute(
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
        )
        .mappings()
        .all()
    )

    primary_domain = db.scalar(
        select(Domain)
        .where(
            Domain.workspace_id == workspace.id,
            Domain.is_primary.is_(True),
        )
    )

    return {
        "onboarded": True,
        "workspace": {
            "id": str(workspace.id),
            "name": workspace.name,
            "business_name": workspace.business_name,
            "slug": workspace.slug,
            "status": workspace.status,
            "is_onboarded": workspace.is_onboarded,
            "role": membership.role,
            "domain": {
                "hostname": primary_domain.hostname,
                "type": primary_domain.domain_type,
                "verified": primary_domain.is_verified,
            }
            if primary_domain
            else None,
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
        },
    }