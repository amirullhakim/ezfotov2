import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Workspace, WorkspaceMember


def get_user_workspace(
    user_id: str,
    db: Session,
) -> tuple[Workspace, WorkspaceMember]:

    try:
        parsed_user_id = uuid.UUID(user_id)

    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authenticated user.",
        )

    membership = db.scalar(
        select(WorkspaceMember).where(
            WorkspaceMember.profile_id
            == parsed_user_id,
            WorkspaceMember.status
            == "ACTIVE",
        )
    )

    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No active workspace found.",
        )

    workspace = db.get(
        Workspace,
        membership.workspace_id,
    )

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found.",
        )

    return workspace, membership