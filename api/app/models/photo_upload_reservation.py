import uuid
from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKeyConstraint, Index, PrimaryKeyConstraint, String, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import utc_now


class PhotoUploadReservation(Base):
    __tablename__ = "photo_upload_reservations"
    __table_args__ = (
        PrimaryKeyConstraint("id", name="pk_photo_upload_reservations"),
        ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE", name="fk_pur_workspace"),
        ForeignKeyConstraint(["service_code"], ["services.code"], ondelete="RESTRICT", name="fk_pur_service_code"),
        UniqueConstraint("object_key", name="uq_pur_object_key"),
        CheckConstraint("service_code IN ('CLIENT_GALLERY', 'EVENT_SALES')", name="ck_pur_service"),
        CheckConstraint("status IN ('PENDING', 'COMPLETED', 'RELEASED')", name="ck_pur_status"),
        CheckConstraint("reserved_bytes > 0 AND ((service_code = 'CLIENT_GALLERY' AND reserved_bytes <= 15728640) OR (service_code = 'EVENT_SALES' AND reserved_bytes <= 31457280))", name="ck_pur_size"),
        CheckConstraint("content_type IN ('image/jpeg', 'image/png', 'image/webp')", name="ck_pur_content_type"),
        CheckConstraint("expires_at > created_at", name="ck_pur_expiry"),
        CheckConstraint("(status = 'COMPLETED' AND completed_at IS NOT NULL) OR (status <> 'COMPLETED' AND completed_at IS NULL)", name="ck_pur_completion"),
        Index("ix_pur_workspace_service_status", "workspace_id", "service_code", "status"),
        Index("ix_pur_status_expiry", "status", "expires_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), default=uuid.uuid4, nullable=False)
    workspace_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    service_code: Mapped[str] = mapped_column(String(50), nullable=False)
    # Resource IDs are polymorphic. The authenticated route verifies that the
    # gallery/event belongs to this workspace before creating a reservation.
    # Keep the record after a resource is deleted so orphan cleanup can run.
    resource_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    object_key: Mapped[str] = mapped_column(String(1500), nullable=False)
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    reserved_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="PENDING", server_default=text("'PENDING'"), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, server_default=text("now()"), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, server_default=text("now()"), nullable=False)