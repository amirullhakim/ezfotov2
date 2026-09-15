from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Service, WorkspaceService


def require_workspace_service(
    workspace_id,
    service_code: str,
    db: Session,
) -> WorkspaceService:

    workspace_service = db.scalar(
        select(WorkspaceService)
        .join(
            Service,
            Service.id
            == WorkspaceService.service_id,
        )
        .where(
            WorkspaceService.workspace_id
            == workspace_id,
            Service.code
            == service_code,
        )
    )

    if not workspace_service:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Service is not configured for this workspace.",
        )

    if workspace_service.status != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"{service_code} service is not active.",
        )

    return workspace_service