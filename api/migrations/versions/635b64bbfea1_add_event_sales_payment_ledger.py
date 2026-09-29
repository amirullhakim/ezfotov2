"""Add event sales payment ledger.

Revision ID: 635b64bbfea1
Revises: f50da38a7154
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "635b64bbfea1"
down_revision = "f50da38a7154"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "event_sales_payment_ledger",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "order_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "workspace_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column("order_number", sa.String(40), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("payment_provider", sa.String(50), nullable=False),
        sa.Column("payment_reference", sa.String(255), nullable=False),
        sa.Column(
            "provider_transaction_id",
            sa.String(255),
            nullable=True,
        ),
        sa.Column("photo_subtotal_cents", sa.BigInteger(), nullable=False),
        sa.Column("service_fee_cents", sa.BigInteger(), nullable=False),
        sa.Column("total_cents", sa.BigInteger(), nullable=False),
        sa.Column(
            "paid_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "recorded_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("source", sa.String(20), nullable=False),
        sa.PrimaryKeyConstraint(
            "id",
            name="pk_event_sales_payment_ledger",
        ),
        sa.ForeignKeyConstraint(
            ["order_id"],
            ["event_orders.id"],
            ondelete="RESTRICT",
            name="fk_espl_order",
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id"],
            ["workspaces.id"],
            ondelete="RESTRICT",
            name="fk_espl_workspace",
        ),
        sa.UniqueConstraint(
            "order_id",
            name="uq_espl_order",
        ),
        sa.UniqueConstraint(
            "payment_provider",
            "payment_reference",
            name="uq_espl_provider_reference",
        ),
        sa.CheckConstraint(
            "photo_subtotal_cents >= 0 AND service_fee_cents >= 0 "
            "AND total_cents >= 0",
            name="ck_espl_amounts_nonnegative",
        ),
        sa.CheckConstraint(
            "total_cents = photo_subtotal_cents + service_fee_cents",
            name="ck_espl_total_matches_breakdown",
        ),
        sa.CheckConstraint(
            "currency ~ '^[A-Z]{3}$'",
            name="ck_espl_currency",
        ),
        sa.CheckConstraint(
            "length(trim(payment_provider)) > 0 "
            "AND length(trim(payment_reference)) > 0 "
            "AND length(trim(order_number)) > 0",
            name="ck_espl_references_nonempty",
        ),
        sa.CheckConstraint(
            "source IN ('WEBHOOK', 'RECONCILIATION', 'BACKFILL')",
            name="ck_espl_source",
        ),
    )

    op.create_index(
        "ix_espl_workspace_paid_at",
        "event_sales_payment_ledger",
        ["workspace_id", "paid_at"],
    )

    op.create_index(
        "ix_espl_paid_at",
        "event_sales_payment_ledger",
        ["paid_at"],
    )

    # No browser-facing policies: access goes through the backend.
    op.execute(
        "ALTER TABLE event_sales_payment_ledger ENABLE ROW LEVEL SECURITY"
    )

    # Corrections/refunds must use separate records, not rewrite receipts.
    op.execute(
        """
        CREATE FUNCTION prevent_event_sales_payment_ledger_changes()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
            RAISE EXCEPTION 'Event sales payment ledger records are immutable.';
            RETURN NULL;
        END;
        $$;
        """
    )

    op.execute(
        """
        CREATE TRIGGER trg_espl_immutable
        BEFORE UPDATE OR DELETE OR TRUNCATE ON event_sales_payment_ledger
        FOR EACH STATEMENT
        EXECUTE FUNCTION prevent_event_sales_payment_ledger_changes();
        """
    )


def downgrade() -> None:
    op.execute(
        "DROP TRIGGER trg_espl_immutable ON event_sales_payment_ledger"
    )

    op.execute(
        "DROP FUNCTION prevent_event_sales_payment_ledger_changes()"
    )

    op.drop_index(
        "ix_espl_paid_at",
        table_name="event_sales_payment_ledger",
    )

    op.drop_index(
        "ix_espl_workspace_paid_at",
        table_name="event_sales_payment_ledger",
    )

    op.drop_table("event_sales_payment_ledger")