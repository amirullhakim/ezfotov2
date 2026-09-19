from datetime import datetime
from typing import Literal

from pydantic import BaseModel


ProcessingJobStatus = Literal[
    "QUEUED",
    "PROCESSING",
    "COMPLETED",
    "FAILED",
    "CANCELLED",
]


class EventProcessingJobResponse(BaseModel):
    has_job: bool

    job_id: str | None = None
    event_id: str | None = None

    status: ProcessingJobStatus | None = None

    total_files: int = 0
    processed_files: int = 0
    ready_files: int = 0
    failed_files: int = 0

    pending_files: int = 0

    progress_percentage: int = 0

    current_photo_id: str | None = None
    current_filename: str | None = None

    message: str | None = None

    cancel_requested: bool = False
    is_running: bool = False

    started_at: datetime | None = None
    completed_at: datetime | None = None

    created_at: datetime | None = None
    updated_at: datetime | None = None