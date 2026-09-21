"""add event sales orders

Revision ID: 0cf2520f7654
Revises: 76781d38e2dc
Create Date: 2026-09-21 11:30:21.441711
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0cf2520f7654"

down_revision: Union[
    str,
    Sequence[str],
    None,
] = "76781d38e2dc"

branch_labels: Union[
    str,
    Sequence[str],
    None,
] = None

depends_on: Union[
    str,
    Sequence[str],
    None,
] = None


def upgrade() -> None:
    # --------------------------------------------------
    # EVENT ORDERS
    # --------------------------------------------------

    op.create_table(
        "event_orders",

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
            "order_number",
            sa.String(
                length=40
            ),
            nullable=False,
        ),

        sa.Column(
            "customer_name",
            sa.String(
                length=150
            ),
            nullable=False,
        ),

        sa.Column(
            "customer_email",
            sa.String(
                length=320
            ),
            nullable=False,
        ),

        sa.Column(
            "status",
            sa.String(
                length=30
            ),
            nullable=False,
        ),

        sa.Column(
            "currency",
            sa.String(
                length=3
            ),
            nullable=False,
        ),

        sa.Column(
            "item_count",
            sa.Integer(),
            nullable=False,
        ),

        sa.Column(
            "unit_price_cents",
            sa.Integer(),
            nullable=False,
        ),

        sa.Column(
            "regular_subtotal_cents",
            sa.Integer(),
            nullable=False,
        ),

        sa.Column(
            "discount_cents",
            sa.Integer(),
            nullable=False,
        ),

        sa.Column(
            "total_cents",
            sa.Integer(),
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
            "bundle_count",
            sa.Integer(),
            nullable=False,
        ),

        sa.Column(
            "payment_provider",
            sa.String(
                length=50
            ),
            nullable=True,
        ),

        sa.Column(
            "payment_reference",
            sa.String(
                length=255
            ),
            nullable=True,
        ),

        sa.Column(
            "provider_transaction_id",
            sa.String(
                length=255
            ),
            nullable=True,
        ),

        sa.Column(
            "paid_at",
            sa.DateTime(
                timezone=True
            ),
            nullable=True,
        ),

        sa.Column(
            "expires_at",
            sa.DateTime(
                timezone=True
            ),
            nullable=True,
        ),

        sa.Column(
            "created_at",
            sa.DateTime(
                timezone=True
            ),
            nullable=False,
        ),

        sa.Column(
            "updated_at",
            sa.DateTime(
                timezone=True
            ),
            nullable=False,
        ),

        sa.CheckConstraint(
            (
                "status IN ("
                "'PENDING_PAYMENT', "
                "'PAID', "
                "'PAYMENT_FAILED', "
                "'CANCELLED', "
                "'EXPIRED', "
                "'REFUNDED'"
                ")"
            ),
            name=
                "ck_event_orders_status",
        ),

        sa.CheckConstraint(
            "bundle_count >= 0",
            name=(
                "ck_event_orders_"
                "bundle_count_nonnegative"
            ),
        ),

        sa.CheckConstraint(
            "bundle_price_cents >= 0",
            name=(
                "ck_event_orders_"
                "bundle_price_nonnegative"
            ),
        ),

        sa.CheckConstraint(
            "bundle_quantity >= 0",
            name=(
                "ck_event_orders_"
                "bundle_quantity_nonnegative"
            ),
        ),

        sa.CheckConstraint(
            "discount_cents >= 0",
            name=(
                "ck_event_orders_"
                "discount_nonnegative"
            ),
        ),

        sa.CheckConstraint(
            "item_count > 0",
            name=(
                "ck_event_orders_"
                "item_count_positive"
            ),
        ),

        sa.CheckConstraint(
            "regular_subtotal_cents >= 0",
            name=(
                "ck_event_orders_"
                "subtotal_nonnegative"
            ),
        ),

        sa.CheckConstraint(
            "total_cents >= 0",
            name=(
                "ck_event_orders_"
                "total_nonnegative"
            ),
        ),

        sa.CheckConstraint(
            "unit_price_cents >= 0",
            name=(
                "ck_event_orders_"
                "unit_price_nonnegative"
            ),
        ),

        sa.ForeignKeyConstraint(
            [
                "event_id",
            ],
            [
                "event_galleries.id",
            ],
            ondelete="RESTRICT",
        ),

        sa.ForeignKeyConstraint(
            [
                "workspace_id",
            ],
            [
                "workspaces.id",
            ],
            ondelete="CASCADE",
        ),

        sa.PrimaryKeyConstraint(
            "id"
        ),
    )


    op.create_index(
        op.f(
            "ix_event_orders_customer_email"
        ),
        "event_orders",
        [
            "customer_email",
        ],
        unique=False,
    )


    op.create_index(
        op.f(
            "ix_event_orders_event_id"
        ),
        "event_orders",
        [
            "event_id",
        ],
        unique=False,
    )


    op.create_index(
        op.f(
            "ix_event_orders_expires_at"
        ),
        "event_orders",
        [
            "expires_at",
        ],
        unique=False,
    )


    op.create_index(
        op.f(
            "ix_event_orders_order_number"
        ),
        "event_orders",
        [
            "order_number",
        ],
        unique=True,
    )


    op.create_index(
        op.f(
            "ix_event_orders_paid_at"
        ),
        "event_orders",
        [
            "paid_at",
        ],
        unique=False,
    )


    op.create_index(
        op.f(
            "ix_event_orders_payment_reference"
        ),
        "event_orders",
        [
            "payment_reference",
        ],
        unique=False,
    )


    op.create_index(
        op.f(
            "ix_event_orders_provider_transaction_id"
        ),
        "event_orders",
        [
            "provider_transaction_id",
        ],
        unique=False,
    )


    op.create_index(
        op.f(
            "ix_event_orders_status"
        ),
        "event_orders",
        [
            "status",
        ],
        unique=False,
    )


    op.create_index(
        op.f(
            "ix_event_orders_workspace_id"
        ),
        "event_orders",
        [
            "workspace_id",
        ],
        unique=False,
    )


    # --------------------------------------------------
    # EVENT ORDER ITEMS
    # --------------------------------------------------

    op.create_table(
        "event_order_items",

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
            "order_id",
            sa.UUID(),
            nullable=False,
        ),

        sa.Column(
            "photo_id",
            sa.UUID(),
            nullable=False,
        ),

        sa.Column(
            "unit_price_cents",
            sa.Integer(),
            nullable=False,
        ),

        sa.Column(
            "created_at",
            sa.DateTime(
                timezone=True
            ),
            nullable=False,
        ),

        sa.Column(
            "updated_at",
            sa.DateTime(
                timezone=True
            ),
            nullable=False,
        ),

        sa.CheckConstraint(
            "unit_price_cents >= 0",
            name=(
                "ck_event_order_items_"
                "unit_price_nonnegative"
            ),
        ),

        sa.ForeignKeyConstraint(
            [
                "event_id",
            ],
            [
                "event_galleries.id",
            ],
            ondelete="RESTRICT",
        ),

        sa.ForeignKeyConstraint(
            [
                "order_id",
            ],
            [
                "event_orders.id",
            ],
            ondelete="CASCADE",
        ),

        sa.ForeignKeyConstraint(
            [
                "photo_id",
            ],
            [
                "event_photos.id",
            ],
            ondelete="RESTRICT",
        ),

        sa.ForeignKeyConstraint(
            [
                "workspace_id",
            ],
            [
                "workspaces.id",
            ],
            ondelete="CASCADE",
        ),

        sa.PrimaryKeyConstraint(
            "id"
        ),

        sa.UniqueConstraint(
            "order_id",
            "photo_id",
            name=(
                "uq_event_order_items_"
                "order_photo"
            ),
        ),
    )


    op.create_index(
        op.f(
            "ix_event_order_items_event_id"
        ),
        "event_order_items",
        [
            "event_id",
        ],
        unique=False,
    )


    op.create_index(
        op.f(
            "ix_event_order_items_order_id"
        ),
        "event_order_items",
        [
            "order_id",
        ],
        unique=False,
    )


    op.create_index(
        op.f(
            "ix_event_order_items_photo_id"
        ),
        "event_order_items",
        [
            "photo_id",
        ],
        unique=False,
    )


    op.create_index(
        op.f(
            "ix_event_order_items_workspace_id"
        ),
        "event_order_items",
        [
            "workspace_id",
        ],
        unique=False,
    )


    # --------------------------------------------------
    # SUPABASE SECURITY
    # --------------------------------------------------
    #
    # Browser clients must never directly read or
    # modify commercial order records.
    #
    # All order operations go through FastAPI.
    #

    op.execute(
        """
        ALTER TABLE event_orders
        ENABLE ROW LEVEL SECURITY
        """
    )


    op.execute(
        """
        ALTER TABLE event_order_items
        ENABLE ROW LEVEL SECURITY
        """
    )


    op.execute(
        """
        REVOKE ALL PRIVILEGES
        ON TABLE event_orders
        FROM anon, authenticated
        """
    )


    op.execute(
        """
        REVOKE ALL PRIVILEGES
        ON TABLE event_order_items
        FROM anon, authenticated
        """
    )


def downgrade() -> None:
    # --------------------------------------------------
    # EVENT ORDER ITEMS
    # --------------------------------------------------

    op.drop_index(
        op.f(
            "ix_event_order_items_workspace_id"
        ),
        table_name=
            "event_order_items",
    )


    op.drop_index(
        op.f(
            "ix_event_order_items_photo_id"
        ),
        table_name=
            "event_order_items",
    )


    op.drop_index(
        op.f(
            "ix_event_order_items_order_id"
        ),
        table_name=
            "event_order_items",
    )


    op.drop_index(
        op.f(
            "ix_event_order_items_event_id"
        ),
        table_name=
            "event_order_items",
    )


    op.drop_table(
        "event_order_items"
    )


    # --------------------------------------------------
    # EVENT ORDERS
    # --------------------------------------------------

    op.drop_index(
        op.f(
            "ix_event_orders_workspace_id"
        ),
        table_name=
            "event_orders",
    )


    op.drop_index(
        op.f(
            "ix_event_orders_status"
        ),
        table_name=
            "event_orders",
    )


    op.drop_index(
        op.f(
            "ix_event_orders_provider_transaction_id"
        ),
        table_name=
            "event_orders",
    )


    op.drop_index(
        op.f(
            "ix_event_orders_payment_reference"
        ),
        table_name=
            "event_orders",
    )


    op.drop_index(
        op.f(
            "ix_event_orders_paid_at"
        ),
        table_name=
            "event_orders",
    )


    op.drop_index(
        op.f(
            "ix_event_orders_order_number"
        ),
        table_name=
            "event_orders",
    )


    op.drop_index(
        op.f(
            "ix_event_orders_expires_at"
        ),
        table_name=
            "event_orders",
    )


    op.drop_index(
        op.f(
            "ix_event_orders_event_id"
        ),
        table_name=
            "event_orders",
    )


    op.drop_index(
        op.f(
            "ix_event_orders_customer_email"
        ),
        table_name=
            "event_orders",
    )


    op.drop_table(
        "event_orders"
    )