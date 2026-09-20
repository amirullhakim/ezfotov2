from __future__ import annotations

import urllib.error
import urllib.request

from datetime import (
    datetime,
    timezone,
)

from sqlalchemy import (
    delete,
    select,
)

from sqlalchemy.orm import (
    Session,
)

from app.db.session import (
    engine,
)

from app.models import (
    EventBibDetection,
    EventFaceEmbedding,
    EventGallery,
    EventPhoto,
    EventProcessingJob,
    Workspace,
)

from app.services.event_bib_recognition import (
    recognize_bibs,
)

from app.services.event_face_recognition import (
    recognize_faces,
)

from app.services.event_watermark import (
    create_professional_watermarked_preview,
)

from app.services.private_storage import (
    PrivateStorageError,
    generate_private_upload_url,
    generate_private_view_url,
)


PREVIEW_CONTENT_TYPE = (
    "image/jpeg"
)

SIGNED_URL_EXPIRES_SECONDS = 900

NETWORK_TIMEOUT_SECONDS = 120


# --------------------------------------------------
# TIME
# --------------------------------------------------


def utc_now() -> datetime:
    return datetime.now(
        timezone.utc
    )


# --------------------------------------------------
# PRIVATE R2
# --------------------------------------------------


def download_private_object(
    object_key: str,
) -> bytes:
    try:
        url = (
            generate_private_view_url(
                object_key=
                    object_key,
                expires_seconds=
                    SIGNED_URL_EXPIRES_SECONDS,
            )
        )

    except PrivateStorageError as exc:
        raise RuntimeError(
            "Unable to prepare private original download."
        ) from exc


    request = urllib.request.Request(
        url=url,
        method="GET",
    )


    try:
        with urllib.request.urlopen(
            request,
            timeout=
                NETWORK_TIMEOUT_SECONDS,
        ) as response:
            return response.read()

    except (
        urllib.error.HTTPError,
        urllib.error.URLError,
        TimeoutError,
    ) as exc:
        raise RuntimeError(
            "Unable to download the private "
            "original from storage."
        ) from exc


def upload_private_preview(
    object_key: str,
    content: bytes,
) -> None:
    try:
        url = (
            generate_private_upload_url(
                object_key=
                    object_key,
                content_type=
                    PREVIEW_CONTENT_TYPE,
                expires_seconds=
                    SIGNED_URL_EXPIRES_SECONDS,
            )
        )

    except PrivateStorageError as exc:
        raise RuntimeError(
            "Unable to prepare private preview upload."
        ) from exc


    request = urllib.request.Request(
        url=url,
        data=content,
        method="PUT",
        headers={
            "Content-Type":
                PREVIEW_CONTENT_TYPE,
        },
    )


    try:
        with urllib.request.urlopen(
            request,
            timeout=
                NETWORK_TIMEOUT_SECONDS,
        ) as response:
            response_status = getattr(
                response,
                "status",
                200,
            )

            if not (
                200
                <= response_status
                < 300
            ):
                raise RuntimeError(
                    "Private preview upload "
                    "was rejected."
                )

    except (
        urllib.error.HTTPError,
        urllib.error.URLError,
        TimeoutError,
    ) as exc:
        raise RuntimeError(
            "Unable to upload the generated preview."
        ) from exc


# --------------------------------------------------
# OBJECT KEY
# --------------------------------------------------


def preview_object_key(
    photo: EventPhoto,
) -> str:
    return (
        f"workspaces/"
        f"{photo.workspace_id}/"
        f"events/"
        f"{photo.event_id}/"
        f"previews/"
        f"{photo.id}.jpg"
    )


# --------------------------------------------------
# PHOTO PIPELINE
# --------------------------------------------------


def process_photo_assets(
    photo: EventPhoto,
    brand_name: str,
    enable_bib_search: bool,
    enable_face_search: bool,
) -> tuple[
    str,
    list[dict],
    list[dict],
]:
    """
    Event photograph processing pipeline.

    Current stages:

    1. Download private original.
    2. YOLO bib detection.
    3. EasyOCR bib recognition.
    4. Face detection.
    5. ArcFace embeddings.
    6. Generate protected preview.
    7. Upload protected preview.
    """

    original = (
        download_private_object(
            photo.original_object_key
        )
    )


    if enable_bib_search:
        bib_detections = recognize_bibs(
            original
        )

    else:
        bib_detections = []


    if enable_face_search:
        face_embeddings = recognize_faces(
            original
        )

    else:
        face_embeddings = []


    preview = (
        create_professional_watermarked_preview(
            original_bytes=
                original,

            brand_name=
                brand_name,
        )
    )


    object_key = preview_object_key(
        photo
    )


    upload_private_preview(
        object_key=
            object_key,

        content=
            preview,
    )


    return (
        object_key,
        bib_detections,
        face_embeddings,
    )


# --------------------------------------------------
# JOB CLAIMING
# --------------------------------------------------


def claim_next_job(
    db: Session,
) -> EventProcessingJob | None:
    job = db.scalar(
        select(
            EventProcessingJob
        )
        .where(
            EventProcessingJob.status
            == "QUEUED"
        )
        .order_by(
            EventProcessingJob
            .created_at
            .asc()
        )
        .limit(
            1
        )
        .with_for_update(
            skip_locked=True
        )
    )


    if not job:
        db.rollback()
        return None


    job.status = (
        "PROCESSING"
    )

    job.started_at = (
        utc_now()
    )

    job.completed_at = (
        None
    )

    job.current_photo_id = (
        None
    )

    job.current_filename = (
        None
    )

    job.message = (
        "AI worker started. "
        "Preparing event photos."
    )


    db.commit()

    db.refresh(
        job
    )


    return job


def get_job_photos(
    db: Session,
    job: EventProcessingJob,
) -> list[EventPhoto]:
    return list(
        db.scalars(
            select(
                EventPhoto
            )
            .where(
                EventPhoto.workspace_id
                == job.workspace_id,

                EventPhoto.event_id
                == job.event_id,

                EventPhoto.deleted_at
                .is_(
                    None
                ),

                EventPhoto.status.in_(
                    [
                        "UPLOADED",
                        "FAILED",
                    ]
                ),

                EventPhoto.created_at
                <= job.created_at,
            )
            .order_by(
                EventPhoto
                .sort_order
                .asc(),

                EventPhoto
                .created_at
                .asc(),
            )
            .limit(
                int(
                    job.total_files
                    or 0
                )
            )
        )
    )


def get_workspace_brand(
    db: Session,
    workspace_id,
) -> str:
    workspace = db.get(
        Workspace,
        workspace_id,
    )


    if (
        workspace
        and workspace.name
    ):
        return (
            workspace.name
            .strip()
            or "EZFOTOO"
        )


    return "EZFOTOO"


# --------------------------------------------------
# JOB STATUS
# --------------------------------------------------


def mark_job_cancelled(
    db: Session,
    job: EventProcessingJob,
) -> None:
    job.status = (
        "CANCELLED"
    )

    job.current_photo_id = (
        None
    )

    job.current_filename = (
        None
    )

    job.completed_at = (
        utc_now()
    )

    job.message = (
        "AI processing was cancelled. "
        f"{job.processed_files} of "
        f"{job.total_files} photos "
        "were processed."
    )


    db.commit()


def mark_job_fatal_error(
    db: Session,
    job: EventProcessingJob,
    message: str,
) -> None:
    job.status = (
        "FAILED"
    )

    job.current_photo_id = (
        None
    )

    job.current_filename = (
        None
    )

    job.completed_at = (
        utc_now()
    )

    job.message = (
        message[:1000]
    )


    db.commit()


# --------------------------------------------------
# PROCESS JOB
# --------------------------------------------------


def process_claimed_job(
    db: Session,
    job: EventProcessingJob,
) -> None:
    photos = get_job_photos(
        db,
        job,
    )


    event = db.get(
        EventGallery,
        job.event_id,
    )


    if event is None:
        job.status = (
            "FAILED"
        )

        job.message = (
            "The event linked to this "
            "processing job no longer exists."
        )

        job.completed_at = (
            utc_now()
        )

        db.commit()

        return


    brand_name = get_workspace_brand(
        db,
        job.workspace_id,
    )


    enable_bib_search = bool(
        event.allow_bib_search
    )

    enable_face_search = bool(
        event.allow_face_search
    )


    job.total_files = len(
        photos
    )

    job.processed_files = 0
    job.ready_files = 0
    job.failed_files = 0


    if not photos:
        job.status = (
            "FAILED"
        )

        job.message = (
            "No processable photos remained "
            "when the worker started."
        )

        job.completed_at = (
            utc_now()
        )

        db.commit()

        return


    db.commit()


    total = len(
        photos
    )


    for (
        index,
        photo,
    ) in enumerate(
        photos,
        start=1,
    ):
        db.refresh(
            job
        )


        if job.cancel_requested:
            mark_job_cancelled(
                db,
                job,
            )

            return


        db.refresh(
            photo
        )


        if (
            photo.deleted_at
            is not None
            or photo.status
            == "DELETED"
        ):
            job.total_files = max(
                job.processed_files,
                job.total_files - 1,
            )

            db.commit()

            continue


        job.current_photo_id = (
            photo.id
        )

        job.current_filename = (
            photo.original_filename
        )

        job.message = (
            f"Processing photo "
            f"{index} of {total}: "
            f"{photo.original_filename}"
        )


        photo.status = (
            "PROCESSING"
        )

        photo.processing_error = (
            None
        )


        db.commit()


        try:
            (
                preview_key,
                bib_detections,
                face_embeddings,
            ) = process_photo_assets(
                photo=
                    photo,

                brand_name=
                    brand_name,

                enable_bib_search=
                    enable_bib_search,

                enable_face_search=
                    enable_face_search,
            )


            # ------------------------------------------
            # CLEAR OLD AI RECORDS
            # ------------------------------------------

            db.execute(
                delete(
                    EventBibDetection
                ).where(
                    EventBibDetection.photo_id
                    == photo.id
                )
            )


            db.execute(
                delete(
                    EventFaceEmbedding
                ).where(
                    EventFaceEmbedding.photo_id
                    == photo.id
                )
            )


            # ------------------------------------------
            # BIB DETECTIONS
            # ------------------------------------------

            for detection in bib_detections:
                db.add(
                    EventBibDetection(
                        workspace_id=
                            photo.workspace_id,

                        event_id=
                            photo.event_id,

                        photo_id=
                            photo.id,

                        bib_number=
                            detection[
                                "bib_number"
                            ],

                        raw_text=
                            detection[
                                "raw_text"
                            ],

                        detection_confidence=
                            detection[
                                "detection_confidence"
                            ],

                        ocr_confidence=
                            detection[
                                "ocr_confidence"
                            ],

                        bbox_x1=
                            detection[
                                "bbox_x1"
                            ],

                        bbox_y1=
                            detection[
                                "bbox_y1"
                            ],

                        bbox_x2=
                            detection[
                                "bbox_x2"
                            ],

                        bbox_y2=
                            detection[
                                "bbox_y2"
                            ],
                    )
                )


            # ------------------------------------------
            # FACE EMBEDDINGS
            # ------------------------------------------

            for face in face_embeddings:
                db.add(
                    EventFaceEmbedding(
                        workspace_id=
                            photo.workspace_id,

                        event_id=
                            photo.event_id,

                        photo_id=
                            photo.id,

                        face_index=
                            face[
                                "face_index"
                            ],

                        embedding=
                            face[
                                "embedding"
                            ],

                        detection_confidence=
                            face[
                                "detection_confidence"
                            ],

                        bbox_x1=
                            face[
                                "bbox_x1"
                            ],

                        bbox_y1=
                            face[
                                "bbox_y1"
                            ],

                        bbox_x2=
                            face[
                                "bbox_x2"
                            ],

                        bbox_y2=
                            face[
                                "bbox_y2"
                            ],
                    )
                )


            # ------------------------------------------
            # PHOTO READY
            # ------------------------------------------

            photo.preview_object_key = (
                preview_key
            )

            photo.status = (
                "READY"
            )

            photo.processing_error = (
                None
            )

            photo.processed_at = (
                utc_now()
            )


            job.processed_files += 1
            job.ready_files += 1


            bib_count = len(
                bib_detections
            )

            face_count = len(
                face_embeddings
            )


            job.message = (
                f"Finished "
                f"{photo.original_filename}. "
                f"{bib_count} bib"
                f"{'' if bib_count == 1 else 's'} "
                f"and {face_count} face"
                f"{'' if face_count == 1 else 's'} "
                "indexed."
            )


            db.commit()


        except Exception as exc:
            db.rollback()


            job = db.get(
                EventProcessingJob,
                job.id,
            )

            photo = db.get(
                EventPhoto,
                photo.id,
            )


            if (
                job is None
                or photo is None
            ):
                raise


            photo.status = (
                "FAILED"
            )

            photo.processing_error = (
                str(exc)[:1500]
            )

            photo.processed_at = (
                utc_now()
            )


            job.processed_files += 1
            job.failed_files += 1


            job.message = (
                f"Failed to process "
                f"{photo.original_filename}. "
                "Continuing with the remaining photos."
            )


            db.commit()


    db.refresh(
        job
    )


    if job.cancel_requested:
        mark_job_cancelled(
            db,
            job,
        )

        return


    job.current_photo_id = (
        None
    )

    job.current_filename = (
        None
    )

    job.completed_at = (
        utc_now()
    )


    if (
        job.failed_files
        >= job.total_files
        and job.total_files > 0
    ):
        job.status = (
            "FAILED"
        )

        job.message = (
            "AI processing finished, "
            "but every photo failed."
        )

    else:
        job.status = (
            "COMPLETED"
        )


        if job.failed_files > 0:
            job.message = (
                "AI processing completed "
                f"with {job.ready_files} ready "
                f"and {job.failed_files} failed."
            )

        else:
            job.message = (
                "AI processing completed successfully. "
                f"{job.ready_files} photos are ready."
            )


    db.commit()


# --------------------------------------------------
# WORKER ENTRY
# --------------------------------------------------


def run_next_processing_job() -> bool:
    with Session(
        engine
    ) as db:
        job = claim_next_job(
            db
        )


        if not job:
            return False


        print(
            (
                "[AI Worker] "
                f"Claimed job {job.id} "
                f"for event {job.event_id}."
            ),
            flush=True,
        )


        try:
            process_claimed_job(
                db,
                job,
            )

        except Exception as exc:
            db.rollback()


            failed_job = db.get(
                EventProcessingJob,
                job.id,
            )


            if failed_job:
                mark_job_fatal_error(
                    db,
                    failed_job,
                    (
                        "AI worker encountered "
                        "a fatal processing error: "
                        f"{exc}"
                    ),
                )


            print(
                (
                    "[AI Worker] "
                    f"Job {job.id} failed: "
                    f"{exc}"
                ),
                flush=True,
            )


        else:
            db.refresh(
                job
            )


            print(
                (
                    "[AI Worker] "
                    f"Job {job.id} finished "
                    f"with status {job.status}. "
                    f"Ready={job.ready_files}, "
                    f"Failed={job.failed_files}."
                ),
                flush=True,
            )


        return True