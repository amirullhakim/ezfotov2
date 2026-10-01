"""Repair the commission schema expected by cc094a4a167e.

Revision ID: 27b98893dcca
Revises: cc094a4a167e

Existing sales retain their original values. No historical commission is inferred.
This migration requires a live PostgreSQL connection.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "27b98893dcca"
down_revision = "cc094a4a167e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    tables = ("event_orders", "event_sales_payment_ledger")
    columns = {
        table: {column["name"]: column for column in inspector.get_columns(table)}
        for table in tables
    }
    checks = {
        table: {item["name"] for item in inspector.get_check_constraints(table)}
        for table in tables
    }
    foreign_keys = {
        table: {item["name"] for item in inspector.get_foreign_keys(table)}
        for table in tables
    }

    def add_missing_column(table: str, column: sa.Column) -> None:
        existing = columns[table].get(column.name)
        if existing is None:
            op.add_column(table, column)
            return
        actual_type = existing["type"].compile(dialect=op.get_bind().dialect)
        expected_type = column.type.compile(dialect=op.get_bind().dialect)
        if actual_type != expected_type or existing["nullable"] != column.nullable:
            raise RuntimeError(
                f"Unexpected definition for {table}.{column.name}: "
                f"{actual_type}, nullable={existing['nullable']}. "
                "Inspect this column before changing its definition."
            )

    add_missing_column("event_orders", sa.Column("pricing_subscription_id", postgresql.UUID(as_uuid=True), nullable=True))
    add_missing_column("event_orders", sa.Column("pricing_plan_code", sa.String(80), nullable=True))
    add_missing_column("event_orders", sa.Column("pricing_plan_name", sa.String(100), nullable=True))
    add_missing_column("event_orders", sa.Column("commission_bps", sa.SmallInteger(), nullable=True))
    add_missing_column("event_orders", sa.Column("commission_cents", sa.BigInteger(), nullable=True))
    add_missing_column("event_orders", sa.Column("photographer_share_cents", sa.BigInteger(), nullable=True))
    add_missing_column("event_orders", sa.Column("platform_share_cents", sa.BigInteger(), nullable=True))
    if 'fk_eo_pricing_subscription' in foreign_keys['event_orders']:
        op.drop_constraint('fk_eo_pricing_subscription', 'event_orders', type_='foreignkey')
    op.create_foreign_key("fk_eo_pricing_subscription", "event_orders", "workspace_subscriptions", ["pricing_subscription_id"], ["id"], ondelete="RESTRICT")
    if 'ck_eo_commission_snapshot' in checks['event_orders']:
        op.drop_constraint('ck_eo_commission_snapshot', 'event_orders', type_='check')
    op.create_check_constraint("ck_eo_commission_snapshot", "event_orders", '(pricing_subscription_id IS NULL AND pricing_plan_code IS NULL AND pricing_plan_name IS NULL AND commission_bps IS NULL AND commission_cents IS NULL AND photographer_share_cents IS NULL AND platform_share_cents IS NULL) OR (pricing_subscription_id IS NOT NULL AND pricing_plan_code IS NOT NULL AND pricing_plan_name IS NOT NULL AND commission_bps IS NOT NULL AND commission_cents IS NOT NULL AND photographer_share_cents IS NOT NULL AND platform_share_cents IS NOT NULL AND length(trim(pricing_plan_code)) > 0 AND length(trim(pricing_plan_name)) > 0 AND commission_bps BETWEEN 0 AND 10000 AND commission_cents >= 0 AND photographer_share_cents >= 0 AND platform_share_cents >= 0 AND commission_cents = floor((photo_subtotal_cents::numeric * commission_bps + 5000) / 10000) AND photographer_share_cents = photo_subtotal_cents - commission_cents AND platform_share_cents = commission_cents + service_fee_cents AND photographer_share_cents + platform_share_cents = total_cents)')
    add_missing_column("event_sales_payment_ledger", sa.Column("pricing_subscription_id", postgresql.UUID(as_uuid=True), nullable=True))
    add_missing_column("event_sales_payment_ledger", sa.Column("pricing_plan_code", sa.String(80), nullable=True))
    add_missing_column("event_sales_payment_ledger", sa.Column("pricing_plan_name", sa.String(100), nullable=True))
    add_missing_column("event_sales_payment_ledger", sa.Column("commission_bps", sa.SmallInteger(), nullable=True))
    add_missing_column("event_sales_payment_ledger", sa.Column("commission_cents", sa.BigInteger(), nullable=True))
    add_missing_column("event_sales_payment_ledger", sa.Column("photographer_share_cents", sa.BigInteger(), nullable=True))
    add_missing_column("event_sales_payment_ledger", sa.Column("platform_share_cents", sa.BigInteger(), nullable=True))
    if 'fk_espl_pricing_subscription' in foreign_keys['event_sales_payment_ledger']:
        op.drop_constraint('fk_espl_pricing_subscription', 'event_sales_payment_ledger', type_='foreignkey')
    op.create_foreign_key("fk_espl_pricing_subscription", "event_sales_payment_ledger", "workspace_subscriptions", ["pricing_subscription_id"], ["id"], ondelete="RESTRICT")
    if 'ck_espl_commission_snapshot' in checks['event_sales_payment_ledger']:
        op.drop_constraint('ck_espl_commission_snapshot', 'event_sales_payment_ledger', type_='check')
    op.create_check_constraint("ck_espl_commission_snapshot", "event_sales_payment_ledger", '(pricing_subscription_id IS NULL AND pricing_plan_code IS NULL AND pricing_plan_name IS NULL AND commission_bps IS NULL AND commission_cents IS NULL AND photographer_share_cents IS NULL AND platform_share_cents IS NULL) OR (pricing_subscription_id IS NOT NULL AND pricing_plan_code IS NOT NULL AND pricing_plan_name IS NOT NULL AND commission_bps IS NOT NULL AND commission_cents IS NOT NULL AND photographer_share_cents IS NOT NULL AND platform_share_cents IS NOT NULL AND length(trim(pricing_plan_code)) > 0 AND length(trim(pricing_plan_name)) > 0 AND commission_bps BETWEEN 0 AND 10000 AND commission_cents >= 0 AND photographer_share_cents >= 0 AND platform_share_cents >= 0 AND commission_cents = floor((photo_subtotal_cents::numeric * commission_bps + 5000) / 10000) AND photographer_share_cents = photo_subtotal_cents - commission_cents AND platform_share_cents = commission_cents + service_fee_cents AND photographer_share_cents + platform_share_cents = total_cents)')
    op.execute("""
CREATE OR REPLACE FUNCTION protect_event_order_pricing_snapshot()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    purchased RECORD;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF ROW(NEW.id, NEW.workspace_id, NEW.event_id, NEW.order_number, NEW.currency, NEW.item_count, NEW.unit_price_cents, NEW.regular_subtotal_cents, NEW.discount_cents, NEW.photo_subtotal_cents, NEW.service_fee_cents, NEW.total_cents, NEW.bundle_quantity, NEW.bundle_price_cents, NEW.bundle_count, NEW.pricing_subscription_id, NEW.pricing_plan_code, NEW.pricing_plan_name, NEW.commission_bps, NEW.commission_cents, NEW.photographer_share_cents, NEW.platform_share_cents) IS DISTINCT FROM ROW(OLD.id, OLD.workspace_id, OLD.event_id, OLD.order_number, OLD.currency, OLD.item_count, OLD.unit_price_cents, OLD.regular_subtotal_cents, OLD.discount_cents, OLD.photo_subtotal_cents, OLD.service_fee_cents, OLD.total_cents, OLD.bundle_quantity, OLD.bundle_price_cents, OLD.bundle_count, OLD.pricing_subscription_id, OLD.pricing_plan_code, OLD.pricing_plan_name, OLD.commission_bps, OLD.commission_cents, OLD.photographer_share_cents, OLD.platform_share_cents) THEN
            RAISE EXCEPTION 'Event order pricing and commission snapshots are immutable.';
        END IF;
        RETURN NEW;
    END IF;

    IF NEW.pricing_subscription_id IS NULL THEN
        RAISE EXCEPTION 'New event orders require a purchased plan snapshot.';
    END IF;
    SELECT s.* INTO purchased
    FROM workspace_subscriptions s
    JOIN services svc ON svc.id = s.service_id
    JOIN workspace_services ws ON ws.workspace_id = s.workspace_id AND ws.service_id = s.service_id
    JOIN workspaces w ON w.id = s.workspace_id
    WHERE s.id = NEW.pricing_subscription_id
      AND s.workspace_id = NEW.workspace_id
      AND svc.code = 'EVENT_SALES' AND svc.is_active
      AND w.status = 'ACTIVE' AND ws.status = 'ACTIVE'
      AND s.status = 'ACTIVE'
      AND s.current_period_start <= clock_timestamp()
      AND s.current_period_end > clock_timestamp();
    IF NOT FOUND THEN
        RAISE EXCEPTION 'An active Event Sales subscription is required for a new order.';
    END IF;
    IF ROW(NEW.pricing_plan_code, NEW.pricing_plan_name, NEW.commission_bps, NEW.service_fee_cents, NEW.currency)
       IS DISTINCT FROM ROW(purchased.plan_code_snapshot, purchased.plan_name_snapshot, purchased.commission_bps, purchased.customer_service_fee_cents, purchased.currency) THEN
        RAISE EXCEPTION 'Event order terms do not match the purchased subscription.';
    END IF;
    RETURN NEW;
END;
$$;
""")
    op.execute("DROP TRIGGER IF EXISTS trg_event_order_pricing_snapshot ON event_orders")
    op.execute('CREATE TRIGGER trg_event_order_pricing_snapshot BEFORE INSERT OR UPDATE ON event_orders FOR EACH ROW EXECUTE FUNCTION protect_event_order_pricing_snapshot()')
    op.execute("""
CREATE OR REPLACE FUNCTION validate_event_sales_ledger_snapshot()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    paid_order RECORD;
BEGIN
    SELECT * INTO paid_order FROM event_orders WHERE id = NEW.order_id FOR KEY SHARE;
    IF NOT FOUND OR paid_order.status <> 'PAID' THEN
        RAISE EXCEPTION 'A verified paid order is required for a ledger receipt.';
    END IF;
    IF ROW(NEW.order_id, NEW.workspace_id, NEW.order_number, NEW.currency, NEW.payment_provider, NEW.payment_reference, NEW.photo_subtotal_cents, NEW.service_fee_cents, NEW.total_cents, NEW.paid_at, NEW.pricing_subscription_id, NEW.pricing_plan_code, NEW.pricing_plan_name, NEW.commission_bps, NEW.commission_cents, NEW.photographer_share_cents, NEW.platform_share_cents) IS DISTINCT FROM ROW(paid_order.id, paid_order.workspace_id, paid_order.order_number, paid_order.currency, paid_order.payment_provider, paid_order.payment_reference, paid_order.photo_subtotal_cents, paid_order.service_fee_cents, paid_order.total_cents, paid_order.paid_at, paid_order.pricing_subscription_id, paid_order.pricing_plan_code, paid_order.pricing_plan_name, paid_order.commission_bps, paid_order.commission_cents, paid_order.photographer_share_cents, paid_order.platform_share_cents) THEN
        RAISE EXCEPTION 'Ledger receipt differs from the saved paid order.';
    END IF;
    RETURN NEW;
END;
$$;
""")
    op.execute("DROP TRIGGER IF EXISTS trg_espl_validate_snapshot ON event_sales_payment_ledger")
    op.execute('CREATE TRIGGER trg_espl_validate_snapshot BEFORE INSERT ON event_sales_payment_ledger FOR EACH ROW EXECUTE FUNCTION validate_event_sales_ledger_snapshot()')


def downgrade() -> None:
    # The parent revision already expects this schema. Keep the repaired schema
    # when returning to that revision, preserving all financial snapshots.
    pass