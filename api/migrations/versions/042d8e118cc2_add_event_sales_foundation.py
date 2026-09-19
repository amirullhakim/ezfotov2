"""add event sales foundation

Revision ID: 042d8e118cc2
Revises: 2bf2a2e15e2a
Create Date: 2026-09-18 21:06:45.336463

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "042d8e118cc2"
down_revision: Union[str, Sequence[str], None] = "2bf2a2e15e2a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""

    # --------------------------------------------------
    # EVENT GALLERIES
    # --------------------------------------------------

    op.create_table(
        "event_galleries",

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
            "title",
            sa.String(length=255),
            nullable=False,
        ),

        sa.Column(
            "slug",
            sa.String(length=120),
            nullable=False,
        ),

        sa.Column(
            "description",
            sa.Text(),
            nullable=True,
        ),

        sa.Column(
            "event_date",
            sa.Date(),
            nullable=True,
        ),

        sa.Column(
            "location",
            sa.String(length=255),
            nullable=True,
        ),

        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
        ),

        sa.Column(
            "allow_browse",
            sa.Boolean(),
            nullable=False,
        ),

        sa.Column(
            "allow_bib_search",
            sa.Boolean(),
            nullable=False,
        ),

        sa.Column(
            "allow_face_search",
            sa.Boolean(),
            nullable=False,
        ),

        sa.Column(
            "price_per_photo_cents",
            sa.Integer(),
            nullable=False,
        ),

        sa.Column(
            "currency",
            sa.String(length=3),
            nullable=False,
        ),

        sa.Column(
            "bundle_enabled",
            sa.Boolean(),
            nullable=False,
        ),

        sa.Column(
            "bundle_quantity",
            sa.Integer(),
            nullable=False,
        ),

        sa.Column(
            "bundle_price_cents",
            sa.Integer(),
            nullable=False,
        ),

        sa.Column(
            "sales_end_at",
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
                "status IN "
                "('DRAFT', 'LIVE', 'CLOSED')"
            ),
            name="ck_event_galleries_status",
        ),

        sa.CheckConstraint(
            "bundle_price_cents >= 0",
            name=(
                "ck_event_galleries_"
                "bundle_price_nonnegative"
            ),
        ),

        sa.CheckConstraint(
            "bundle_quantity > 0",
            name=(
                "ck_event_galleries_"
                "bundle_quantity_positive"
            ),
        ),

        sa.CheckConstraint(
            "price_per_photo_cents >= 0",
            name=(
                "ck_event_galleries_"
                "price_nonnegative"
            ),
        ),

        sa.ForeignKeyConstraint(
            ["workspace_id"],
            ["workspaces.id"],
            ondelete="CASCADE",
        ),

        sa.PrimaryKeyConstraint(
            "id"
        ),

        sa.UniqueConstraint(
            "workspace_id",
            "slug",
            name=(
                "uq_event_galleries_"
                "workspace_slug"
            ),
        ),
    )


    op.create_index(
        op.f(
            "ix_event_galleries_event_date"
        ),
        "event_galleries",
        ["event_date"],
        unique=False,
    )

    op.create_index(
        op.f(
            "ix_event_galleries_sales_end_at"
        ),
        "event_galleries",
        ["sales_end_at"],
        unique=False,
    )

    op.create_index(
        op.f(
            "ix_event_galleries_slug"
        ),
        "event_galleries",
        ["slug"],
        unique=False,
    )

    op.create_index(
        op.f(
            "ix_event_galleries_status"
        ),
        "event_galleries",
        ["status"],
        unique=False,
    )

    op.create_index(
        op.f(
            "ix_event_galleries_workspace_id"
        ),
        "event_galleries",
        ["workspace_id"],
        unique=False,
    )


    # --------------------------------------------------
    # EVENT PHOTOS
    # --------------------------------------------------

    op.create_table(
        "event_photos",

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
            "original_object_key",
            sa.String(length=1500),
            nullable=False,
        ),

        sa.Column(
            "original_filename",
            sa.String(length=255),
            nullable=False,
        ),

        sa.Column(
            "content_type",
            sa.String(length=100),
            nullable=False,
        ),

        sa.Column(
            "size_bytes",
            sa.BigInteger(),
            nullable=False,
        ),

        sa.Column(
            "width",
            sa.Integer(),
            nullable=True,
        ),

        sa.Column(
            "height",
            sa.Integer(),
            nullable=True,
        ),

        sa.Column(
            "preview_object_key",
            sa.String(length=1500),
            nullable=True,
        ),

        sa.Column(
            "sort_order",
            sa.Integer(),
            nullable=False,
        ),

        sa.Column(
            "is_visible",
            sa.Boolean(),
            nullable=False,
        ),

        sa.Column(
            "status",
            sa.String(length=30),
            nullable=False,
        ),

        sa.Column(
            "processing_error",
            sa.Text(),
            nullable=True,
        ),

        sa.Column(
            "processed_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),

        sa.Column(
            "deleted_at",
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
                "'UPLOADED', "
                "'PROCESSING', "
                "'READY', "
                "'FAILED', "
                "'DELETED'"
                ")"
            ),
            name="ck_event_photos_status",
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
            "ix_event_photos_deleted_at"
        ),
        "event_photos",
        ["deleted_at"],
        unique=False,
    )

    op.create_index(
        op.f(
            "ix_event_photos_event_id"
        ),
        "event_photos",
        ["event_id"],
        unique=False,
    )

    op.create_index(
        op.f(
            "ix_event_photos_original_object_key"
        ),
        "event_photos",
        ["original_object_key"],
        unique=True,
    )

    op.create_index(
        op.f(
            "ix_event_photos_preview_object_key"
        ),
        "event_photos",
        ["preview_object_key"],
        unique=True,
    )

    op.create_index(
        op.f(
            "ix_event_photos_processed_at"
        ),
        "event_photos",
        ["processed_at"],
        unique=False,
    )

    op.create_index(
        op.f(
            "ix_event_photos_status"
        ),
        "event_photos",
        ["status"],
        unique=False,
    )

    op.create_index(
        op.f(
            "ix_event_photos_workspace_id"
        ),
        "event_photos",
        ["workspace_id"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""

    # --------------------------------------------------
    # EVENT PHOTOS
    # --------------------------------------------------

    op.drop_index(
        op.f(
            "ix_event_photos_workspace_id"
        ),
        table_name="event_photos",
    )

    op.drop_index(
        op.f(
            "ix_event_photos_status"
        ),
        table_name="event_photos",
    )

    op.drop_index(
        op.f(
            "ix_event_photos_processed_at"
        ),
        table_name="event_photos",
    )

    op.drop_index(
        op.f(
            "ix_event_photos_preview_object_key"
        ),
        table_name="event_photos",
    )

    op.drop_index(
        op.f(
            "ix_event_photos_original_object_key"
        ),
        table_name="event_photos",
    )

    op.drop_index(
        op.f(
            "ix_event_photos_event_id"
        ),
        table_name="event_photos",
    )

    op.drop_index(
        op.f(
            "ix_event_photos_deleted_at"
        ),
        table_name="event_photos",
    )

    op.drop_table(
        "event_photos"
    )


    # --------------------------------------------------
    # EVENT GALLERIES
    # --------------------------------------------------

    op.drop_index(
        op.f(
            "ix_event_galleries_workspace_id"
        ),
        table_name="event_galleries",
    )

    op.drop_index(
        op.f(
            "ix_event_galleries_status"
        ),
        table_name="event_galleries",
    )

    op.drop_index(
        op.f(
            "ix_event_galleries_slug"
        ),
        table_name="event_galleries",
    )

    op.drop_index(
        op.f(
            "ix_event_galleries_sales_end_at"
        ),
        table_name="event_galleries",
    )

    op.drop_index(
        op.f(
            "ix_event_galleries_event_date"
        ),
        table_name="event_galleries",
    )

    op.drop_table(
        "event_galleries"
    )