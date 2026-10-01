from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models import EventGallery, Workspace
from app.services.subscription_access import require_paid_workspace_service


def lock_event_workspace(workspace_id, db: Session) -> None:
    # Keep this lock until the event write commits or rolls back. All event
    # create/update requests use the same lock as subscription activation.
    workspace = db.scalar(select(Workspace).where(
        Workspace.id == workspace_id,
    ).with_for_update().execution_options(populate_existing=True))
    if workspace is None or workspace.status != "ACTIVE":
        raise HTTPException(403, "This workspace is not active.")


def is_active_selling_event(status: str, sales_end_at: datetime | None, now: datetime) -> bool:
    return status == "LIVE" and (sales_end_at is None or sales_end_at > now)


def count_active_selling_events(workspace_id, db: Session, *, exclude_event_id=None) -> int:
    now = datetime.now(timezone.utc)
    statement = select(func.count(EventGallery.id)).where(
        EventGallery.workspace_id == workspace_id,
        EventGallery.status == "LIVE",
        or_(EventGallery.sales_end_at.is_(None), EventGallery.sales_end_at > now),
    )
    if exclude_event_id is not None:
        statement = statement.where(EventGallery.id != exclude_event_id)
    return int(db.scalar(statement) or 0)


def require_active_event_capacity(workspace_id, db: Session, *, exclude_event_id=None) -> None:
    lock_event_workspace(workspace_id, db)
    subscription = require_paid_workspace_service(workspace_id, "EVENT_SALES", db)
    # A checkout may have renewed/replaced the subscription while this
    # request waited for the workspace lock. Read the current snapshot.
    db.refresh(subscription)
    limit = subscription.active_event_limit
    if limit is None:
        return
    count = count_active_selling_events(workspace_id, db, exclude_event_id=exclude_event_id)
    if count >= limit:
        noun = "event" if limit == 1 else "events"
        raise HTTPException(
            409,
            f"Your {subscription.plan_name_snapshot} plan allows {limit} active selling {noun}. Close another live event before publishing this one.",
        )
