"""Add photo upload storage reservations.

Revision ID: 00bc81c5f163
Revises: 5eaaa1cee13a
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "00bc81c5f163"
down_revision = "5eaaa1cee13a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "photo_upload_reservations",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("service_code", sa.String(50), nullable=False),
        sa.Column("resource_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("object_key", sa.String(1500), nullable=False),
        sa.Column("content_type", sa.String(100), nullable=False),
        sa.Column("reserved_bytes", sa.BigInteger(), nullable=False),
        sa.Column("status", sa.String(20), server_default=sa.text("'PENDING'"), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_photo_upload_reservations"),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE", name="fk_pur_workspace"),
        sa.ForeignKeyConstraint(["service_code"], ["services.code"], ondelete="RESTRICT", name="fk_pur_service_code"),
        sa.UniqueConstraint("object_key", name="uq_pur_object_key"),
        sa.CheckConstraint("service_code IN ('CLIENT_GALLERY', 'EVENT_SALES')", name="ck_pur_service"),
        sa.CheckConstraint("status IN ('PENDING', 'COMPLETED', 'RELEASED')", name="ck_pur_status"),
        sa.CheckConstraint("reserved_bytes > 0 AND ((service_code = 'CLIENT_GALLERY' AND reserved_bytes <= 15728640) OR (service_code = 'EVENT_SALES' AND reserved_bytes <= 31457280))", name="ck_pur_size"),
        sa.CheckConstraint("content_type IN ('image/jpeg', 'image/png', 'image/webp')", name="ck_pur_content_type"),
        sa.CheckConstraint("expires_at > created_at", name="ck_pur_expiry"),
        sa.CheckConstraint("(status = 'COMPLETED' AND completed_at IS NOT NULL) OR (status <> 'COMPLETED' AND completed_at IS NULL)", name="ck_pur_completion"),
    )
    op.create_index("ix_pur_workspace_service_status", "photo_upload_reservations", ["workspace_id", "service_code", "status"])
    op.create_index("ix_pur_status_expiry", "photo_upload_reservations", ["status", "expires_at"])
    # Browser/Supabase clients have no direct policies. Access is through the
    # authenticated backend, using the same DB role as existing billing tables.
    op.execute("ALTER TABLE photo_upload_reservations ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    op.drop_table("photo_upload_reservations")