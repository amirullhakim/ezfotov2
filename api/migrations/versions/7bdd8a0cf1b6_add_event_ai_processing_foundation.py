"""add event ai processing foundation

Revision ID: 7bdd8a0cf1b6
Revises: 8d643c4834c5
Create Date: 2026-09-20 00:51:45.457072

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "7bdd8a0cf1b6"
down_revision: Union[str, Sequence[str], None] = "8d643c4834c5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""

    # --------------------------------------------------
    # EVENT BIB DETECTIONS
    # --------------------------------------------------

    op.create_table(
        "event_bib_detections",

        sa.Column(
            "id",
            sa.UUID(),
            nullable=False,
        ),

        sa.Column(
            "workspace_id",
            sa.UUID(),
            nullable=False,
        ),

        sa.Column(
            "event_id",
            sa.UUID(),
            nullable=False,
        ),

        sa.Column(
            "photo_id",
            sa.UUID(),
            nullable=False,
        ),

        sa.Column(
            "bib_number",
            sa.String(length=50),
            nullable=False,
        ),

        sa.Column(
            "raw_text",
            sa.String(length=100),
            nullable=True,
        ),

        sa.Column(
            "detection_confidence",
            sa.Float(),
            nullable=True,
        ),

        sa.Column(
            "ocr_confidence",
            sa.Float(),
            nullable=True,
        ),

        sa.Column(
            "bbox_x1",
            sa.Integer(),
            nullable=True,
        ),

        sa.Column(
            "bbox_y1",
            sa.Integer(),
            nullable=True,
        ),

        sa.Column(
            "bbox_x2",
            sa.Integer(),
            nullable=True,
        ),

        sa.Column(
            "bbox_y2",
            sa.Integer(),
            nullable=True,
        ),

        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),

        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),

        sa.CheckConstraint(
            (
                "detection_confidence IS NULL "
                "OR "
                "("
                "detection_confidence >= 0 "
                "AND "
                "detection_confidence <= 1"
                ")"
            ),
            name=(
                "ck_event_bib_detections_"
                "detection_confidence"
            ),
        ),

        sa.CheckConstraint(
            (
                "ocr_confidence IS NULL "
                "OR "
                "("
                "ocr_confidence >= 0 "
                "AND "
                "ocr_confidence <= 1"
                ")"
            ),
            name=(
                "ck_event_bib_detections_"
                "ocr_confidence"
            ),
        ),

        sa.ForeignKeyConstraint(
            ["event_id"],
            ["event_galleries.id"],
            ondelete="CASCADE",
        ),

        sa.ForeignKeyConstraint(
            ["photo_id"],
            ["event_photos.id"],
            ondelete="CASCADE",
        ),

        sa.ForeignKeyConstraint(
            ["workspace_id"],
            ["workspaces.id"],
            ondelete="CASCADE",
        ),

        sa.PrimaryKeyConstraint(
            "id"
        ),
    )


    op.create_index(
        op.f(
            "ix_event_bib_detections_bib_number"
        ),
        "event_bib_detections",
        ["bib_number"],
        unique=False,
    )

    op.create_index(
        "ix_event_bib_detections_event_bib",
        "event_bib_detections",
        [
            "event_id",
            "bib_number",
        ],
        unique=False,
    )

    op.create_index(
        op.f(
            "ix_event_bib_detections_event_id"
        ),
        "event_bib_detections",
        ["event_id"],
        unique=False,
    )

    op.create_index(
        "ix_event_bib_detections_photo_bib",
        "event_bib_detections",
        [
            "photo_id",
            "bib_number",
        ],
        unique=False,
    )

    op.create_index(
        op.f(
            "ix_event_bib_detections_photo_id"
        ),
        "event_bib_detections",
        ["photo_id"],
        unique=False,
    )

    op.create_index(
        op.f(
            "ix_event_bib_detections_workspace_id"
        ),
        "event_bib_detections",
        ["workspace_id"],
        unique=False,
    )


    # --------------------------------------------------
    # EVENT FACE EMBEDDINGS
    # --------------------------------------------------

    op.create_table(
        "event_face_embeddings",

        sa.Column(
            "id",
            sa.UUID(),
            nullable=False,
        ),

        sa.Column(
            "workspace_id",
            sa.UUID(),
            nullable=False,
        ),

        sa.Column(
            "event_id",
            sa.UUID(),
            nullable=False,
        ),

        sa.Column(
            "photo_id",
            sa.UUID(),
            nullable=False,
        ),

        sa.Column(
            "face_index",
            sa.Integer(),
            nullable=False,
        ),

        sa.Column(
            "embedding",
            sa.ARRAY(
                sa.Float()
            ),
            nullable=False,
        ),

        sa.Column(
            "detection_confidence",
            sa.Float(),
            nullable=True,
        ),

        sa.Column(
            "bbox_x1",
            sa.Integer(),
            nullable=True,
        ),

        sa.Column(
            "bbox_y1",
            sa.Integer(),
            nullable=True,
        ),

        sa.Column(
            "bbox_x2",
            sa.Integer(),
            nullable=True,
        ),

        sa.Column(
            "bbox_y2",
            sa.Integer(),
            nullable=True,
        ),

        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),

        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),

        sa.CheckConstraint(
            (
                "detection_confidence IS NULL "
                "OR "
                "("
                "detection_confidence >= 0 "
                "AND "
                "detection_confidence <= 1"
                ")"
            ),
            name=(
                "ck_event_face_embeddings_"
                "detection_confidence"
            ),
        ),

        sa.CheckConstraint(
            "face_index >= 0",
            name=(
                "ck_event_face_embeddings_"
                "face_index_nonnegative"
            ),
        ),

        sa.ForeignKeyConstraint(
            ["event_id"],
            ["event_galleries.id"],
            ondelete="CASCADE",
        ),

        sa.ForeignKeyConstraint(
            ["photo_id"],
            ["event_photos.id"],
            ondelete="CASCADE",
        ),

        sa.ForeignKeyConstraint(
            ["workspace_id"],
            ["workspaces.id"],
            ondelete="CASCADE",
        ),

        sa.PrimaryKeyConstraint(
            "id"
        ),
    )


    op.create_index(
        op.f(
            "ix_event_face_embeddings_event_id"
        ),
        "event_face_embeddings",
        ["event_id"],
        unique=False,
    )

    op.create_index(
        "ix_event_face_embeddings_event_photo",
        "event_face_embeddings",
        [
            "event_id",
            "photo_id",
        ],
        unique=False,
    )

    op.create_index(
        op.f(
            "ix_event_face_embeddings_photo_id"
        ),
        "event_face_embeddings",
        ["photo_id"],
        unique=False,
    )

    op.create_index(
        op.f(
            "ix_event_face_embeddings_workspace_id"
        ),
        "event_face_embeddings",
        ["workspace_id"],
        unique=False,
    )


    # --------------------------------------------------
    # EVENT PROCESSING JOBS
    # --------------------------------------------------

    op.create_table(
        "event_processing_jobs",

        sa.Column(
            "id",
            sa.UUID(),
            nullable=False,
        ),

        sa.Column(
            "workspace_id",
            sa.UUID(),
            nullable=False,
        ),

        sa.Column(
            "event_id",
            sa.UUID(),
            nullable=False,
        ),

        sa.Column(
            "status",
            sa.String(length=30),
            nullable=False,
        ),

        sa.Column(
            "total_files",
            sa.Integer(),
            nullable=False,
        ),

        sa.Column(
            "processed_files",
            sa.Integer(),
            nullable=False,
        ),

        sa.Column(
            "ready_files",
            sa.Integer(),
            nullable=False,
        ),

        sa.Column(
            "failed_files",
            sa.Integer(),
            nullable=False,
        ),

        sa.Column(
            "current_photo_id",
            sa.UUID(),
            nullable=True,
        ),

        sa.Column(
            "current_filename",
            sa.String(length=255),
            nullable=True,
        ),

        sa.Column(
            "message",
            sa.Text(),
            nullable=True,
        ),

        sa.Column(
            "cancel_requested",
            sa.Boolean(),
            nullable=False,
        ),

        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),

        sa.Column(
            "completed_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),

        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),

        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),

        sa.CheckConstraint(
            (
                "status IN ("
                "'QUEUED', "
                "'PROCESSING', "
                "'COMPLETED', "
                "'FAILED', "
                "'CANCELLED'"
                ")"
            ),
            name=(
                "ck_event_processing_jobs_status"
            ),
        ),

        sa.CheckConstraint(
            "failed_files >= 0",
            name=(
                "ck_event_processing_jobs_"
                "failed_files_nonnegative"
            ),
        ),

        sa.CheckConstraint(
            "processed_files >= 0",
            name=(
                "ck_event_processing_jobs_"
                "processed_files_nonnegative"
            ),
        ),

        sa.CheckConstraint(
            "ready_files >= 0",
            name=(
                "ck_event_processing_jobs_"
                "ready_files_nonnegative"
            ),
        ),

        sa.CheckConstraint(
            "total_files >= 0",
            name=(
                "ck_event_processing_jobs_"
                "total_files_nonnegative"
            ),
        ),

        sa.ForeignKeyConstraint(
            ["current_photo_id"],
            ["event_photos.id"],
            ondelete="SET NULL",
        ),

        sa.ForeignKeyConstraint(
            ["event_id"],
            ["event_galleries.id"],
            ondelete="CASCADE",
        ),

        sa.ForeignKeyConstraint(
            ["workspace_id"],
            ["workspaces.id"],
            ondelete="CASCADE",
        ),

        sa.PrimaryKeyConstraint(
            "id"
        ),
    )


    op.create_index(
        op.f(
            "ix_event_processing_jobs_completed_at"
        ),
        "event_processing_jobs",
        ["completed_at"],
        unique=False,
    )

    op.create_index(
        op.f(
            "ix_event_processing_jobs_current_photo_id"
        ),
        "event_processing_jobs",
        ["current_photo_id"],
        unique=False,
    )

    op.create_index(
        op.f(
            "ix_event_processing_jobs_event_id"
        ),
        "event_processing_jobs",
        ["event_id"],
        unique=False,
    )

    op.create_index(
        "ix_event_processing_jobs_event_status",
        "event_processing_jobs",
        [
            "event_id",
            "status",
        ],
        unique=False,
    )

    op.create_index(
        op.f(
            "ix_event_processing_jobs_started_at"
        ),
        "event_processing_jobs",
        ["started_at"],
        unique=False,
    )

    op.create_index(
        op.f(
            "ix_event_processing_jobs_status"
        ),
        "event_processing_jobs",
        ["status"],
        unique=False,
    )

    op.create_index(
        op.f(
            "ix_event_processing_jobs_workspace_id"
        ),
        "event_processing_jobs",
        ["workspace_id"],
        unique=False,
    )


    # Only one active AI job may exist per event.
    op.create_index(
        "uq_event_processing_jobs_active_event",
        "event_processing_jobs",
        ["event_id"],
        unique=True,
        postgresql_where=sa.text(
            "status IN ('QUEUED', 'PROCESSING')"
        ),
    )


    # --------------------------------------------------
    # SUPABASE / RLS SECURITY
    # --------------------------------------------------
    #
    # These are internal business/AI tables.
    #
    # Browser Supabase clients do not access them
    # directly. Access goes through FastAPI.
    #

    op.execute(
        """
        ALTER TABLE event_bib_detections
        ENABLE ROW LEVEL SECURITY;
        """
    )

    op.execute(
        """
        ALTER TABLE event_face_embeddings
        ENABLE ROW LEVEL SECURITY;
        """
    )

    op.execute(
        """
        ALTER TABLE event_processing_jobs
        ENABLE ROW LEVEL SECURITY;
        """
    )


    op.execute(
        """
        REVOKE ALL
        ON TABLE event_bib_detections
        FROM anon, authenticated;
        """
    )

    op.execute(
        """
        REVOKE ALL
        ON TABLE event_face_embeddings
        FROM anon, authenticated;
        """
    )

    op.execute(
        """
        REVOKE ALL
        ON TABLE event_processing_jobs
        FROM anon, authenticated;
        """
    )


def downgrade() -> None:
    """Downgrade schema."""

    # --------------------------------------------------
    # EVENT PROCESSING JOBS
    # --------------------------------------------------

    op.drop_index(
        "uq_event_processing_jobs_active_event",
        table_name="event_processing_jobs",
        postgresql_where=sa.text(
            "status IN ('QUEUED', 'PROCESSING')"
        ),
    )

    op.drop_index(
        op.f(
            "ix_event_processing_jobs_workspace_id"
        ),
        table_name="event_processing_jobs",
    )

    op.drop_index(
        op.f(
            "ix_event_processing_jobs_status"
        ),
        table_name="event_processing_jobs",
    )

    op.drop_index(
        op.f(
            "ix_event_processing_jobs_started_at"
        ),
        table_name="event_processing_jobs",
    )

    op.drop_index(
        "ix_event_processing_jobs_event_status",
        table_name="event_processing_jobs",
    )

    op.drop_index(
        op.f(
            "ix_event_processing_jobs_event_id"
        ),
        table_name="event_processing_jobs",
    )

    op.drop_index(
        op.f(
            "ix_event_processing_jobs_current_photo_id"
        ),
        table_name="event_processing_jobs",
    )

    op.drop_index(
        op.f(
            "ix_event_processing_jobs_completed_at"
        ),
        table_name="event_processing_jobs",
    )

    op.drop_table(
        "event_processing_jobs"
    )


    # --------------------------------------------------
    # EVENT FACE EMBEDDINGS
    # --------------------------------------------------

    op.drop_index(
        op.f(
            "ix_event_face_embeddings_workspace_id"
        ),
        table_name="event_face_embeddings",
    )

    op.drop_index(
        op.f(
            "ix_event_face_embeddings_photo_id"
        ),
        table_name="event_face_embeddings",
    )

    op.drop_index(
        "ix_event_face_embeddings_event_photo",
        table_name="event_face_embeddings",
    )

    op.drop_index(
        op.f(
            "ix_event_face_embeddings_event_id"
        ),
        table_name="event_face_embeddings",
    )

    op.drop_table(
        "event_face_embeddings"
    )


    # --------------------------------------------------
    # EVENT BIB DETECTIONS
    # --------------------------------------------------

    op.drop_index(
        op.f(
            "ix_event_bib_detections_workspace_id"
        ),
        table_name="event_bib_detections",
    )

    op.drop_index(
        op.f(
            "ix_event_bib_detections_photo_id"
        ),
        table_name="event_bib_detections",
    )

    op.drop_index(
        "ix_event_bib_detections_photo_bib",
        table_name="event_bib_detections",
    )

    op.drop_index(
        op.f(
            "ix_event_bib_detections_event_id"
        ),
        table_name="event_bib_detections",
    )

    op.drop_index(
        "ix_event_bib_detections_event_bib",
        table_name="event_bib_detections",
    )

    op.drop_index(
        op.f(
            "ix_event_bib_detections_bib_number"
        ),
        table_name="event_bib_detections",
    )

    op.drop_table(
        "event_bib_detections"
    )