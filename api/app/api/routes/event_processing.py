import uuid
from datetime import datetime, timezone

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from sqlalchemy import (
    func,
    select,
)
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.session import get_db

from app.models import (
    EventGallery,
    EventPhoto,
    EventProcessingJob,
)

from app.schemas.event_processing import (
    EventProcessingJobResponse,
)

from app.services.service_access import (
    require_workspace_service,
)

from app.services.workspace_access import (
    get_user_workspace,
)


router = APIRouter(
    prefix="/event-sales/events",
    tags=["Event AI Processing"],
)


# --------------------------------------------------
# WORKSPACE / SERVICE ACCESS
# --------------------------------------------------


def get_event_sales_workspace(
    current_user: dict,
    db: Session,
):
    workspace, membership = (
        get_user_workspace(
            current_user["id"],
            db,
        )
    )

    require_workspace_service(
        workspace.id,
        "EVENT_SALES",
        db,
    )

    return workspace, membership


# --------------------------------------------------
# EVENT LOOKUP
# --------------------------------------------------


def parse_event_id(
    event_id: str,
) -> uuid.UUID:
    try:
        return uuid.UUID(
            event_id
        )

    except ValueError:
        raise HTTPException(
            status_code=
                status.HTTP_400_BAD_REQUEST,
            detail="Invalid event ID.",
        )


def get_workspace_event(
    db: Session,
    workspace_id: uuid.UUID,
    event_id: str,
) -> EventGallery:
    parsed_event_id = (
        parse_event_id(
            event_id
        )
    )

    event = db.scalar(
        select(
            EventGallery
        ).where(
            EventGallery.id
            == parsed_event_id,

            EventGallery.workspace_id
            == workspace_id,
        )
    )

    if not event:
        raise HTTPException(
            status_code=
                status.HTTP_404_NOT_FOUND,
            detail="Event not found.",
        )

    return event


# --------------------------------------------------
# JOB LOOKUP
# --------------------------------------------------


def get_active_job(
    db: Session,
    workspace_id: uuid.UUID,
    event_id: uuid.UUID,
) -> EventProcessingJob | None:
    return db.scalar(
        select(
            EventProcessingJob
        )
        .where(
            EventProcessingJob.workspace_id
            == workspace_id,

            EventProcessingJob.event_id
            == event_id,

            EventProcessingJob.status.in_(
                [
                    "QUEUED",
                    "PROCESSING",
                ]
            ),
        )
        .order_by(
            EventProcessingJob.created_at.desc()
        )
    )


def get_latest_job(
    db: Session,
    workspace_id: uuid.UUID,
    event_id: uuid.UUID,
) -> EventProcessingJob | None:
    return db.scalar(
        select(
            EventProcessingJob
        )
        .where(
            EventProcessingJob.workspace_id
            == workspace_id,

            EventProcessingJob.event_id
            == event_id,
        )
        .order_by(
            EventProcessingJob.created_at.desc()
        )
    )


# --------------------------------------------------
# PHOTO COUNTS
# --------------------------------------------------


def count_processable_photos(
    db: Session,
    workspace_id: uuid.UUID,
    event_id: uuid.UUID,
) -> int:
    value = db.scalar(
        select(
            func.count(
                EventPhoto.id
            )
        ).where(
            EventPhoto.workspace_id
            == workspace_id,

            EventPhoto.event_id
            == event_id,

            EventPhoto.status.in_(
                [
                    "UPLOADED",
                    "FAILED",
                ]
            ),

            EventPhoto.deleted_at.is_(
                None
            ),
        )
    )

    return int(
        value or 0
    )


# --------------------------------------------------
# RESPONSE
# --------------------------------------------------


def processing_job_response(
    job: EventProcessingJob | None,
) -> dict:
    if not job:
        return {
            "has_job":
                False,

            "job_id":
                None,

            "event_id":
                None,

            "status":
                None,

            "total_files":
                0,

            "processed_files":
                0,

            "ready_files":
                0,

            "failed_files":
                0,

            "pending_files":
                0,

            "progress_percentage":
                0,

            "current_photo_id":
                None,

            "current_filename":
                None,

            "message":
                (
                    "No AI processing job "
                    "has been started yet."
                ),

            "cancel_requested":
                False,

            "is_running":
                False,

            "started_at":
                None,

            "completed_at":
                None,

            "created_at":
                None,

            "updated_at":
                None,
        }


    total_files = int(
        job.total_files or 0
    )

    processed_files = int(
        job.processed_files or 0
    )

    ready_files = int(
        job.ready_files or 0
    )

    failed_files = int(
        job.failed_files or 0
    )


    pending_files = max(
        total_files
        - processed_files,
        0,
    )


    if total_files > 0:
        progress_percentage = min(
            100,
            round(
                (
                    processed_files
                    / total_files
                )
                * 100
            ),
        )

    else:
        progress_percentage = 0


    return {
        "has_job":
            True,

        "job_id":
            str(job.id),

        "event_id":
            str(job.event_id),

        "status":
            job.status,

        "total_files":
            total_files,

        "processed_files":
            processed_files,

        "ready_files":
            ready_files,

        "failed_files":
            failed_files,

        "pending_files":
            pending_files,

        "progress_percentage":
            progress_percentage,

        "current_photo_id": (
            str(
                job.current_photo_id
            )
            if job.current_photo_id
            else None
        ),

        "current_filename":
            job.current_filename,

        "message":
            job.message,

        "cancel_requested":
            bool(
                job.cancel_requested
            ),

        "is_running":
            job.status
            in {
                "QUEUED",
                "PROCESSING",
            },

        "started_at":
            job.started_at,

        "completed_at":
            job.completed_at,

        "created_at":
            job.created_at,

        "updated_at":
            job.updated_at,
    }


# --------------------------------------------------
# GET PROCESSING STATUS
# --------------------------------------------------


@router.get(
    "/{event_id}/processing",
    response_model=
        EventProcessingJobResponse,
)
def get_processing_status(
    event_id: str,
    current_user: dict = Depends(
        get_current_user
    ),
    db: Session = Depends(
        get_db
    ),
):
    workspace, _ = (
        get_event_sales_workspace(
            current_user,
            db,
        )
    )


    event = (
        get_workspace_event(
            db=db,
            workspace_id=
                workspace.id,
            event_id=
                event_id,
        )
    )


    job = get_active_job(
        db=db,
        workspace_id=
            workspace.id,
        event_id=
            event.id,
    )


    if not job:
        job = get_latest_job(
            db=db,
            workspace_id=
                workspace.id,
            event_id=
                event.id,
        )


    return processing_job_response(
        job
    )


# --------------------------------------------------
# START PROCESSING
# --------------------------------------------------


@router.post(
    "/{event_id}/processing/start",
    response_model=
        EventProcessingJobResponse,
    status_code=
        status.HTTP_201_CREATED,
)
def start_processing(
    event_id: str,
    current_user: dict = Depends(
        get_current_user
    ),
    db: Session = Depends(
        get_db
    ),
):
    workspace, _ = (
        get_event_sales_workspace(
            current_user,
            db,
        )
    )


    event = (
        get_workspace_event(
            db=db,
            workspace_id=
                workspace.id,
            event_id=
                event_id,
        )
    )


    if (
        event.status
        == "CLOSED"
    ):
        raise HTTPException(
            status_code=
                status.HTTP_409_CONFLICT,
            detail=(
                "AI processing cannot be "
                "started for a CLOSED event. "
                "Reopen the event as a draft first."
            ),
        )


    active_job = get_active_job(
        db=db,
        workspace_id=
            workspace.id,
        event_id=
            event.id,
    )


    if active_job:
        raise HTTPException(
            status_code=
                status.HTTP_409_CONFLICT,
            detail=(
                "This event already has "
                "an active AI processing job."
            ),
        )


    processable_count = (
        count_processable_photos(
            db=db,
            workspace_id=
                workspace.id,
            event_id=
                event.id,
        )
    )


    if processable_count <= 0:
        raise HTTPException(
            status_code=
                status.HTTP_409_CONFLICT,
            detail=(
                "There are no uploaded or "
                "failed photos waiting for "
                "AI processing."
            ),
        )


    job = EventProcessingJob(
        workspace_id=
            workspace.id,

        event_id=
            event.id,

        status=
            "QUEUED",

        total_files=
            processable_count,

        processed_files=
            0,

        ready_files=
            0,

        failed_files=
            0,

        current_photo_id=
            None,

        current_filename=
            None,

        message=(
            "AI processing is queued "
            "and waiting for a worker."
        ),

        cancel_requested=
            False,

        started_at=
            None,

        completed_at=
            None,
    )


    db.add(
        job
    )


    try:
        db.commit()

        db.refresh(
            job
        )

    except IntegrityError as exc:
        db.rollback()

        raise HTTPException(
            status_code=
                status.HTTP_409_CONFLICT,
            detail=(
                "This event already has "
                "an active AI processing job."
            ),
        ) from exc


    return processing_job_response(
        job
    )


# --------------------------------------------------
# CANCEL PROCESSING
# --------------------------------------------------


@router.post(
    "/{event_id}/processing/cancel",
    response_model=
        EventProcessingJobResponse,
)
def cancel_processing(
    event_id: str,
    current_user: dict = Depends(
        get_current_user
    ),
    db: Session = Depends(
        get_db
    ),
):
    workspace, _ = (
        get_event_sales_workspace(
            current_user,
            db,
        )
    )


    event = (
        get_workspace_event(
            db=db,
            workspace_id=
                workspace.id,
            event_id=
                event_id,
        )
    )


    job = get_active_job(
        db=db,
        workspace_id=
            workspace.id,
        event_id=
            event.id,
    )


    if not job:
        latest_job = (
            get_latest_job(
                db=db,
                workspace_id=
                    workspace.id,
                event_id=
                    event.id,
            )
        )


        if latest_job:
            return (
                processing_job_response(
                    latest_job
                )
            )


        raise HTTPException(
            status_code=
                status.HTTP_404_NOT_FOUND,
            detail=(
                "No AI processing job "
                "exists for this event."
            ),
        )


    now = datetime.now(
        timezone.utc
    )


    job.cancel_requested = (
        True
    )


    # If a worker has not started yet,
    # cancelling is immediate.
    if (
        job.status
        == "QUEUED"
    ):
        job.status = (
            "CANCELLED"
        )

        job.completed_at = (
            now
        )

        job.current_photo_id = (
            None
        )

        job.current_filename = (
            None
        )

        job.message = (
            "AI processing was cancelled "
            "before the worker started."
        )


    # If the worker is already processing,
    # the worker will check cancel_requested
    # between photos and stop safely.
    elif (
        job.status
        == "PROCESSING"
    ):
        job.message = (
            "Cancellation requested. "
            "The AI worker will stop "
            "after the current photo."
        )


    db.commit()

    db.refresh(
        job
    )


    return processing_job_response(
        job
    )