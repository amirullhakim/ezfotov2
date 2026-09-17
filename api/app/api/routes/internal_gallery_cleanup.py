import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import (
    APIRouter,
    Depends,
    Header,
    HTTPException,
    status,
)
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import (
    ClientGallery,
    GalleryPhoto,
)
from app.services.private_storage import (
    PrivateStorageError,
    delete_private_object,
)


router = APIRouter(
    prefix="/internal/gallery-trash",
)


TRASH_RETENTION_DAYS = 30

# Prevent one cleanup request from becoming
# extremely long in the future.
PURGE_BATCH_SIZE = 100


# --------------------------------------------------
# SECURITY
# --------------------------------------------------


def require_cleanup_key(
    x_cleanup_key: str | None = Header(
        default=None,
        alias="X-Cleanup-Key",
    ),
):
    expected_key = os.getenv(
        "GALLERY_CLEANUP_SECRET"
    )


    if not expected_key:
        raise HTTPException(
            status_code=
                status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Gallery cleanup is not configured."
            ),
        )


    if (
        not x_cleanup_key
        or not secrets.compare_digest(
            x_cleanup_key,
            expected_key,
        )
    ):
        raise HTTPException(
            status_code=
                status.HTTP_401_UNAUTHORIZED,
            detail=
                "Invalid cleanup key.",
        )


# --------------------------------------------------
# AUTOMATIC PURGE
# --------------------------------------------------


@router.post(
    "/purge-expired",
    include_in_schema=False,
)
def purge_expired_gallery_trash(
    _: None = Depends(
        require_cleanup_key
    ),
    db: Session = Depends(
        get_db
    ),
):
    now = datetime.now(
        timezone.utc
    )

    cutoff = (
        now
        - timedelta(
            days=
                TRASH_RETENTION_DAYS
        )
    )


    # --------------------------------------------------
    # GET CANDIDATES
    # --------------------------------------------------
    #
    # Only galleries that have been in Trash
    # for MORE THAN 30 days are candidates.
    #
    candidate_ids = list(
        db.scalars(
            select(
                ClientGallery.id
            )
            .where(
                ClientGallery.deleted_at.is_not(
                    None
                ),

                ClientGallery.deleted_at
                < cutoff,
            )
            .order_by(
                ClientGallery.deleted_at.asc()
            )
            .limit(
                PURGE_BATCH_SIZE
            )
        ).all()
    )


    purged = []
    failed = []

    total_deleted_photos = 0


    # --------------------------------------------------
    # PURGE EACH GALLERY
    # --------------------------------------------------

    for gallery_id in candidate_ids:
        try:
            # Re-read and lock the gallery.
            #
            # This helps prevent a restore request
            # from changing the row while automatic
            # deletion is processing it.
            gallery = db.scalar(
                select(
                    ClientGallery
                )
                .where(
                    ClientGallery.id
                    == gallery_id,

                    ClientGallery.deleted_at.is_not(
                        None
                    ),

                    ClientGallery.deleted_at
                    < cutoff,
                )
                .with_for_update()
            )


            # It may have been restored after the
            # original candidate query.
            if not gallery:
                db.commit()
                continue


            gallery_id_text = str(
                gallery.id
            )

            gallery_title = (
                gallery.title
            )

            deleted_at = (
                gallery.deleted_at
            )


            photos = db.scalars(
                select(
                    GalleryPhoto
                ).where(
                    GalleryPhoto.gallery_id
                    == gallery.id,

                    GalleryPhoto.workspace_id
                    == gallery.workspace_id,

                    GalleryPhoto.status
                    != "DELETED",
                )
            ).all()


            # --------------------------------------------------
            # DELETE PRIVATE R2 OBJECTS
            # --------------------------------------------------
            #
            # R2 cleanup happens BEFORE deleting
            # the database row.
            #
            # If R2 fails, the gallery remains in
            # the database so cleanup can retry
            # tomorrow.
            #
            for photo in photos:
                delete_private_object(
                    photo.object_key
                )


            photo_count = len(
                photos
            )


            # --------------------------------------------------
            # DELETE DATABASE GALLERY
            # --------------------------------------------------
            #
            # gallery_photos and favourites are
            # removed by the existing FK cascades.
            #
            db.delete(
                gallery
            )

            db.commit()


            total_deleted_photos += (
                photo_count
            )


            purged.append({
                "gallery_id":
                    gallery_id_text,

                "title":
                    gallery_title,

                "photos_deleted":
                    photo_count,

                "deleted_at": (
                    deleted_at.isoformat()
                    if deleted_at
                    else None
                ),
            })


        except PrivateStorageError as exc:
            db.rollback()


            print(
                "Gallery trash cleanup "
                f"failed for {gallery_id}: "
                f"{exc}"
            )


            failed.append({
                "gallery_id":
                    str(gallery_id),

                "reason":
                    "private_storage_cleanup_failed",
            })


        except Exception as exc:
            db.rollback()


            print(
                "Unexpected gallery trash "
                f"cleanup failure for "
                f"{gallery_id}: {exc}"
            )


            failed.append({
                "gallery_id":
                    str(gallery_id),

                "reason":
                    "cleanup_failed",
            })


    result = {
        "ok":
            len(failed) == 0,

        "retention_days":
            TRASH_RETENTION_DAYS,

        "cutoff":
            cutoff.isoformat(),

        "batch_limit":
            PURGE_BATCH_SIZE,

        "candidates":
            len(candidate_ids),

        "purged_galleries":
            len(purged),

        "purged_photos":
            total_deleted_photos,

        "failed_galleries":
            len(failed),

        "purged":
            purged,

        "failed":
            failed,
    }


    # Make the scheduler job fail visibly if
    # any gallery could not be cleaned.
    if failed:
        return JSONResponse(
            status_code=
                status.HTTP_502_BAD_GATEWAY,
            content=
                result,
        )


    return result