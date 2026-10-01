"""Clean abandoned photo uploads: python -m app.workers.storage_cleanup.

Run periodically in deployment. Presign requests also clean expired uploads
for their workspace. This worker does not remove registered customer photos.
"""
import logging
from datetime import datetime, timezone

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models import PhotoUploadReservation
from app.services.workspace_storage import cleanup_expired_upload_reservations, lock_storage_workspace


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    with SessionLocal() as db:
        workspace_ids = db.scalars(select(PhotoUploadReservation.workspace_id).where(
            PhotoUploadReservation.status == "PENDING",
            PhotoUploadReservation.expires_at <= datetime.now(timezone.utc),
        ).distinct().limit(100)).all()
    released = failed = 0
    for workspace_id in workspace_ids:
        with SessionLocal() as db:
            try:
                lock_storage_workspace(workspace_id, db, require_active=False)
                result = cleanup_expired_upload_reservations(workspace_id, db, limit=100)
                db.commit()
                released += result["released"]
                failed += result["failed"]
            except Exception:
                db.rollback()
                logging.exception("Storage cleanup failed for workspace %s", workspace_id)
                failed += 1
    print(f"Abandoned uploads released: {released}")
    print(f"Cleanup failures: {failed}")


if __name__ == "__main__":
    main()