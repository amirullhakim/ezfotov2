from __future__ import annotations

import io
import urllib.error
import urllib.request

from datetime import (
    datetime,
    timezone,
)

from PIL import (
    Image,
    ImageDraw,
    ImageFont,
    ImageOps,
)
from sqlalchemy import (
    select,
)
from sqlalchemy.orm import (
    Session,
)

from app.db.session import (
    engine,
)
from app.models import (
    EventPhoto,
    EventProcessingJob,
)
from app.services.private_storage import (
    PrivateStorageError,
    generate_private_upload_url,
    generate_private_view_url,
)


PREVIEW_CONTENT_TYPE = "image/jpeg"

PREVIEW_MAX_SIZE = (
    1800,
    1800,
)

PREVIEW_JPEG_QUALITY = 82

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
# R2 HTTP HELPERS
# --------------------------------------------------


def download_private_object(
    object_key: str,
) -> bytes:
    """
    Download a private R2 object through a
    short-lived presigned GET URL.
    """

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
            "Unable to prepare private "
            "original download."
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
            "Unable to download the "
            "private original from storage."
        ) from exc


def upload_private_preview(
    object_key: str,
    content: bytes,
) -> None:
    """
    Upload a generated JPEG preview through a
    short-lived presigned PUT URL.
    """

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
            "Unable to prepare private "
            "preview upload."
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
            status_code = getattr(
                response,
                "status",
                200,
            )

            if not (
                200
                <= status_code
                < 300
            ):
                raise RuntimeError(
                    "Private preview upload "
                    "was rejected by storage."
                )

    except (
        urllib.error.HTTPError,
        urllib.error.URLError,
        TimeoutError,
    ) as exc:
        raise RuntimeError(
            "Unable to upload the generated "
            "preview to private storage."
        ) from exc


# --------------------------------------------------
# WATERMARK
# --------------------------------------------------


def load_watermark_font(
    size: int,
):
    """
    Use a common system font when available.
    Fall back safely if unavailable.
    """

    candidates = [
        # Windows
        r"C:\Windows\Fonts\arialbd.ttf",

        # Typical Linux / Render image
        (
            "/usr/share/fonts/truetype/"
            "dejavu/DejaVuSans-Bold.ttf"
        ),
    ]


    for path in candidates:
        try:
            return ImageFont.truetype(
                path,
                size=size,
            )

        except OSError:
            continue


    return ImageFont.load_default()


def create_watermarked_preview(
    original_bytes: bytes,
) -> bytes:
    """
    Create a resized, protected JPEG preview.

    Originals are never modified.
    """

    try:
        source = Image.open(
            io.BytesIO(
                original_bytes
            )
        )

        source = (
            ImageOps.exif_transpose(
                source
            )
        )

        source.load()

    except Exception as exc:
        raise RuntimeError(
            "The original image could not "
            "be decoded."
        ) from exc


    # Convert transparency / palette formats safely.
    if source.mode != "RGB":
        if (
            "A" in source.getbands()
        ):
            background = Image.new(
                "RGB",
                source.size,
                "white",
            )

            rgba = source.convert(
                "RGBA"
            )

            background.paste(
                rgba,
                mask=
                    rgba.getchannel(
                        "A"
                    ),
            )

            source = background

        else:
            source = source.convert(
                "RGB"
            )


    source.thumbnail(
        PREVIEW_MAX_SIZE,
        Image.Resampling.LANCZOS,
    )


    canvas = source.convert(
        "RGBA"
    )


    watermark = Image.new(
        "RGBA",
        canvas.size,
        (
            0,
            0,
            0,
            0,
        ),
    )


    draw = ImageDraw.Draw(
        watermark
    )


    width, height = (
        canvas.size
    )


    font_size = max(
        24,
        int(
            width / 24
        ),
    )


    font = load_watermark_font(
        font_size
    )


    text = (
        "EZFOTOO PREVIEW"
    )


    try:
        box = draw.textbbox(
            (
                0,
                0,
            ),
            text,
            font=font,
        )

        text_width = max(
            box[2] - box[0],
            120,
        )

        text_height = max(
            box[3] - box[1],
            30,
        )

    except Exception:
        text_width = 220
        text_height = 40


    x_step = (
        text_width
        + max(
            80,
            int(
                width * 0.05
            ),
        )
    )

    y_step = (
        text_height
        + max(
            90,
            int(
                height * 0.08
            ),
        )
    )


    row = 0

    y = int(
        -y_step / 2
    )


    while y < height:
        offset = (
            int(
                -x_step / 2
            )
            if row % 2 == 0
            else 0
        )

        x = offset

        while x < width:
            # subtle shadow
            draw.text(
                (
                    x + 2,
                    y + 2,
                ),
                text,
                font=font,
                fill=(
                    0,
                    0,
                    0,
                    55,
                ),
            )

            # visible watermark
            draw.text(
                (
                    x,
                    y,
                ),
                text,
                font=font,
                fill=(
                    255,
                    255,
                    255,
                    92,
                ),
            )

            x += x_step

        y += y_step
        row += 1


    # Additional protected lower banner.
    banner_height = max(
        38,
        int(
            height * 0.055
        ),
    )


    draw.rectangle(
        (
            0,
            height
            - banner_height,
            width,
            height,
        ),
        fill=(
            5,
            40,
            50,
            145,
        ),
    )


    banner_text = (
        "EZFOTOO • PROTECTED PREVIEW"
    )


    banner_font = (
        load_watermark_font(
            max(
                16,
                int(
                    banner_height
                    * 0.38
                ),
            )
        )
    )


    try:
        banner_box = (
            draw.textbbox(
                (
                    0,
                    0,
                ),
                banner_text,
                font=
                    banner_font,
            )
        )

        banner_width = (
            banner_box[2]
            - banner_box[0]
        )

        banner_text_height = (
            banner_box[3]
            - banner_box[1]
        )

    except Exception:
        banner_width = 200
        banner_text_height = 20


    draw.text(
        (
            max(
                12,
                (
                    width
                    - banner_width
                )
                // 2,
            ),
            (
                height
                - banner_height
                + (
                    banner_height
                    - banner_text_height
                )
                // 2
            ),
        ),
        banner_text,
        font=
            banner_font,
        fill=(
            255,
            255,
            255,
            220,
        ),
    )


    protected = (
        Image.alpha_composite(
            canvas,
            watermark,
        )
        .convert(
            "RGB"
        )
    )


    output = io.BytesIO()


    protected.save(
        output,
        format="JPEG",
        quality=
            PREVIEW_JPEG_QUALITY,
        optimize=True,
    )


    return output.getvalue()


# --------------------------------------------------
# PREVIEW OBJECT KEY
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
# PROCESS ONE PHOTO
# --------------------------------------------------


def process_photo_preview(
    photo: EventPhoto,
) -> str:
    """
    First Phase 3C processing stage.

    Currently:
    - download original
    - generate watermark
    - upload protected preview

    YOLO/OCR/ArcFace are added after this
    worker foundation is verified.
    """

    original = (
        download_private_object(
            photo.original_object_key
        )
    )


    preview = (
        create_watermarked_preview(
            original
        )
    )


    object_key = (
        preview_object_key(
            photo
        )
    )


    upload_private_preview(
        object_key=
            object_key,
        content=
            preview,
    )


    return object_key


# --------------------------------------------------
# JOB HELPERS
# --------------------------------------------------


def claim_next_job(
    db: Session,
) -> EventProcessingJob | None:
    """
    Atomically claim the oldest QUEUED job.

    SKIP LOCKED allows multiple worker instances
    later without processing the same queued job.
    """

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
    """
    Snapshot semantics:

    only process photos that existed when the
    job was created. Photos uploaded afterward
    wait for the next job.
    """

    photos = list(
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


    return photos


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
# PROCESS CLAIMED JOB
# --------------------------------------------------


def process_claimed_job(
    db: Session,
    job: EventProcessingJob,
) -> None:
    photos = (
        get_job_photos(
            db,
            job,
        )
    )


    # A photo might have been deleted between
    # creating and starting the job.
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
        # Pull fresh cancel status from DB because
        # FastAPI may have changed it in another
        # database session.
        db.refresh(
            job
        )


        if (
            job.cancel_requested
        ):
            mark_job_cancelled(
                db,
                job,
            )

            return


        db.refresh(
            photo
        )


        # Photo may have been deleted while waiting.
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
            preview_key = (
                process_photo_preview(
                    photo
                )
            )


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

            job.message = (
                f"Finished "
                f"{photo.original_filename}."
            )


            db.commit()


        except Exception as exc:
            db.rollback()


            # Re-fetch because rollback expires
            # pending ORM state.
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
                str(exc)[
                    :1500
                ]
            )

            photo.processed_at = (
                utc_now()
            )


            job.processed_files += 1
            job.failed_files += 1

            job.message = (
                f"Failed to process "
                f"{photo.original_filename}. "
                "Continuing with the "
                "remaining photos."
            )


            db.commit()


    db.refresh(
        job
    )


    if (
        job.cancel_requested
    ):
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

        if (
            job.failed_files > 0
        ):
            job.message = (
                "AI processing completed "
                f"with {job.ready_files} ready "
                f"and {job.failed_files} failed."
            )

        else:
            job.message = (
                "AI processing completed "
                "successfully. "
                f"{job.ready_files} photos "
                "are ready."
            )


    db.commit()


# --------------------------------------------------
# WORKER ENTRY FOR ONE JOB
# --------------------------------------------------


def run_next_processing_job() -> bool:
    """
    Claim and process one queued job.

    Returns:
        True  -> a job was claimed
        False -> queue was empty
    """

    with Session(
        engine
    ) as db:
        job = (
            claim_next_job(
                db
            )
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