"""Remove subscription cancellation and refund tracking.

Revision ID: 312aed2e396c
Revises: 9130d9009dff

Deletes the retired tracking data. Preserves billing orders, subscriptions,
paid periods, service plans and payment-ledger protections.

Downgrade recreates empty tracking tables using the original migration;
it cannot recover deleted tracking records or previous cancellation flags.
"""
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

from alembic import op
import sqlalchemy as sa

revision = "312aed2e396c"
down_revision = "9130d9009dff"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Remove only scheduling flags. Paid status and period dates are untouched.
    op.execute(sa.text("""
        UPDATE public.workspace_subscriptions
        SET cancel_at_period_end = FALSE,
            canceled_at = NULL,
            updated_at = now()
        WHERE cancel_at_period_end IS DISTINCT FROM FALSE
           OR canceled_at IS NOT NULL
    """))

    # Drop in dependency order. DROP TABLE does not fire row/statement
    # DELETE or TRUNCATE triggers. No guards need to be disabled.
    # No CASCADE: unexpected external dependencies must stop the migration.
    op.drop_table("subscription_management_events", schema="public")
    op.drop_table("subscription_refund_requests", schema="public")

    op.execute("DROP FUNCTION public.validate_subscription_management_event()")
    op.execute("DROP FUNCTION public.prevent_subscription_tracking_changes()")
    op.execute("DROP FUNCTION public.protect_subscription_refund_request()")

    # This composite key was introduced solely for the retired tracking tables.
    op.drop_constraint(
        "uq_sbo_id_workspace", "subscription_billing_orders",
        type_="unique", schema="public",
    )


def downgrade() -> None:
    # Reuse the exact original definitions instead of maintaining a second
    # copy. Keep the previous migration file in migrations/versions.
    original_path = Path(__file__).with_name(
        "9130d9009dff_add_subscription_cancellation_and_.py"
    )
    spec = spec_from_file_location("ezfotoo_restore_subscription_tracking", original_path)
    if spec is None or spec.loader is None:
        raise RuntimeError("Unable to load the original subscription tracking migration.")
    original = module_from_spec(spec)
    spec.loader.exec_module(original)
    if original.revision != down_revision or original.down_revision != "40881b06e191":
        raise RuntimeError("Unexpected subscription tracking migration identity.")
    original.upgrade()