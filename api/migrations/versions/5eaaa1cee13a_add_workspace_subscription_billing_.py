"""Add workspace subscription billing orders.

Revision ID: 5eaaa1cee13a
Revises: 2288c338d7d0
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "5eaaa1cee13a"
down_revision = "2288c338d7d0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_ws_subscription_identity",
        "workspace_subscriptions",
        ["id", "workspace_id", "service_id"],
    )

    op.create_table(
        "subscription_billing_orders",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("service_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("subscription_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_by_profile_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "idempotency_key",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column("order_number", sa.String(40), nullable=False),
        sa.Column(
            "status",
            sa.String(30),
            server_default=sa.text("'PENDING_PAYMENT'"),
            nullable=False,
        ),
        sa.Column("payer_email", sa.String(320), nullable=False),
        sa.Column("plan_code_snapshot", sa.String(80), nullable=False),
        sa.Column("plan_name_snapshot", sa.String(100), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("price_cents", sa.BigInteger(), nullable=False),
        sa.Column("total_cents", sa.BigInteger(), nullable=False),
        sa.Column("billing_interval_months", sa.SmallInteger(), nullable=False),
        sa.Column("commission_bps", sa.SmallInteger(), nullable=False),
        sa.Column("customer_service_fee_cents", sa.BigInteger(), nullable=False),
        sa.Column("storage_limit_bytes", sa.BigInteger(), nullable=True),
        sa.Column("active_event_limit", sa.Integer(), nullable=True),
        sa.Column("includes_website", sa.Boolean(), nullable=False),
        sa.Column(
            "payment_provider",
            sa.String(50),
            server_default=sa.text("'CHIP'"),
            nullable=False,
        ),
        sa.Column("payment_reference", sa.String(255), nullable=True),
        sa.Column("checkout_url", sa.Text(), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("activated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("period_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("period_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name="pk_sbo"),
        sa.ForeignKeyConstraint(
            ["workspace_id"],
            ["workspaces.id"],
            ondelete="RESTRICT",
            name="fk_sbo_workspace",
        ),
        sa.ForeignKeyConstraint(
            ["service_id"],
            ["services.id"],
            ondelete="RESTRICT",
            name="fk_sbo_service",
        ),
        sa.ForeignKeyConstraint(
            ["plan_id", "service_id"],
            ["service_plans.id", "service_plans.service_id"],
            ondelete="RESTRICT",
            name="fk_sbo_plan_service",
        ),
        sa.ForeignKeyConstraint(
            ["subscription_id", "workspace_id", "service_id"],
            [
                "workspace_subscriptions.id",
                "workspace_subscriptions.workspace_id",
                "workspace_subscriptions.service_id",
            ],
            ondelete="RESTRICT",
            name="fk_sbo_subscription_identity",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_profile_id"],
            ["profiles.id"],
            ondelete="RESTRICT",
            name="fk_sbo_creator",
        ),
        sa.UniqueConstraint(
            "order_number",
            name="uq_sbo_order_number",
        ),
        sa.UniqueConstraint(
            "workspace_id", "idempotency_key",
            name="uq_sbo_idempotency",
        ),
        sa.UniqueConstraint(
            "payment_provider", "payment_reference",
            name="uq_sbo_provider_reference",
        ),
        sa.CheckConstraint(
            "status IN ('PENDING_PAYMENT', 'PAID', 'PAYMENT_FAILED', "
            "'CANCELLED', 'EXPIRED', 'REFUNDED')",
            name="ck_sbo_status",
        ),
        sa.CheckConstraint(
            "price_cents > 0 AND total_cents = price_cents "
            "AND customer_service_fee_cents >= 0",
            name="ck_sbo_amounts",
        ),
        sa.CheckConstraint(
            "commission_bps BETWEEN 0 AND 10000",
            name="ck_sbo_commission",
        ),
        sa.CheckConstraint(
            "billing_interval_months IN (1, 12)",
            name="ck_sbo_interval",
        ),
        sa.CheckConstraint(
            "currency ~ '^[A-Z]{3}$'",
            name="ck_sbo_currency",
        ),
        sa.CheckConstraint(
            "storage_limit_bytes IS NULL OR storage_limit_bytes > 0",
            name="ck_sbo_storage",
        ),
        sa.CheckConstraint(
            "active_event_limit IS NULL OR active_event_limit > 0",
            name="ck_sbo_event_limit",
        ),
        sa.CheckConstraint(
            "length(trim(order_number)) > 0 "
            "AND length(trim(payer_email)) > 0 "
            "AND length(trim(plan_code_snapshot)) > 0 "
            "AND length(trim(plan_name_snapshot)) > 0 "
            "AND length(trim(payment_provider)) > 0",
            name="ck_sbo_labels",
        ),
        sa.CheckConstraint(
            "payment_reference IS NULL "
            "OR length(trim(payment_reference)) > 0",
            name="ck_sbo_reference",
        ),
        sa.CheckConstraint(
            "expires_at > created_at",
            name="ck_sbo_expiry",
        ),
        sa.CheckConstraint(
            "(paid_at IS NULL AND status NOT IN ('PAID', 'REFUNDED')) "
            "OR (paid_at IS NOT NULL AND status IN ('PAID', 'REFUNDED') "
            "AND payment_reference IS NOT NULL)",
            name="ck_sbo_payment_state",
        ),
        sa.CheckConstraint(
            "(period_start IS NULL AND period_end IS NULL) "
            "OR (period_start IS NOT NULL AND period_end IS NOT NULL "
            "AND period_end > period_start)",
            name="ck_sbo_period",
        ),
        sa.CheckConstraint(
            "activated_at IS NULL OR "
            "(paid_at IS NOT NULL AND subscription_id IS NOT NULL "
            "AND period_start IS NOT NULL AND period_end IS NOT NULL)",
            name="ck_sbo_activation",
        ),
    )

    op.create_index(
        "ix_sbo_workspace_created",
        "subscription_billing_orders",
        ["workspace_id", "created_at"],
    )
    op.create_index(
        "ix_sbo_service",
        "subscription_billing_orders",
        ["service_id"],
    )
    op.create_index(
        "ix_sbo_plan_service",
        "subscription_billing_orders",
        ["plan_id", "service_id"],
    )
    op.create_index(
        "ix_sbo_subscription",
        "subscription_billing_orders",
        ["subscription_id"],
    )
    op.create_index(
        "ix_sbo_creator",
        "subscription_billing_orders",
        ["created_by_profile_id"],
    )
    op.create_index(
        "ix_sbo_status_expiry",
        "subscription_billing_orders",
        ["status", "expires_at"],
    )

    op.execute(
        "ALTER TABLE subscription_billing_orders "
        "ENABLE ROW LEVEL SECURITY"
    )

    op.execute(
        """
        CREATE FUNCTION protect_subscription_billing_order()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
            IF TG_OP = 'DELETE' THEN
                IF OLD.paid_at IS NOT NULL THEN
                    RAISE EXCEPTION
                        'Paid subscription billing orders cannot be deleted.';
                END IF;
                RETURN OLD;
            END IF;

            IF ROW(
                NEW.id, NEW.workspace_id, NEW.service_id, NEW.plan_id,
                NEW.created_by_profile_id, NEW.idempotency_key,
                NEW.order_number, NEW.payer_email,
                NEW.plan_code_snapshot, NEW.plan_name_snapshot,
                NEW.currency, NEW.price_cents, NEW.total_cents,
                NEW.billing_interval_months, NEW.commission_bps,
                NEW.customer_service_fee_cents, NEW.storage_limit_bytes,
                NEW.active_event_limit, NEW.includes_website,
                NEW.payment_provider, NEW.created_at, NEW.expires_at
            ) IS DISTINCT FROM ROW(
                OLD.id, OLD.workspace_id, OLD.service_id, OLD.plan_id,
                OLD.created_by_profile_id, OLD.idempotency_key,
                OLD.order_number, OLD.payer_email,
                OLD.plan_code_snapshot, OLD.plan_name_snapshot,
                OLD.currency, OLD.price_cents, OLD.total_cents,
                OLD.billing_interval_months, OLD.commission_bps,
                OLD.customer_service_fee_cents, OLD.storage_limit_bytes,
                OLD.active_event_limit, OLD.includes_website,
                OLD.payment_provider, OLD.created_at, OLD.expires_at
            ) THEN
                RAISE EXCEPTION
                    'Subscription billing order terms are immutable.';
            END IF;

            IF OLD.payment_reference IS NOT NULL
               AND NEW.payment_reference IS DISTINCT FROM
                   OLD.payment_reference THEN
                RAISE EXCEPTION
                    'Subscription payment reference cannot be replaced.';
            END IF;

            IF OLD.paid_at IS NOT NULL
               AND NEW.paid_at IS DISTINCT FROM OLD.paid_at THEN
                RAISE EXCEPTION
                    'Verified subscription payment time is immutable.';
            END IF;

            IF OLD.activated_at IS NOT NULL AND ROW(
                NEW.activated_at, NEW.subscription_id,
                NEW.period_start, NEW.period_end
            ) IS DISTINCT FROM ROW(
                OLD.activated_at, OLD.subscription_id,
                OLD.period_start, OLD.period_end
            ) THEN
                RAISE EXCEPTION
                    'Subscription activation record is immutable.';
            END IF;

            RETURN NEW;
        END;
        $$;
        """
    )

    op.execute(
        """
        CREATE TRIGGER trg_sbo_protect
        BEFORE UPDATE OR DELETE ON subscription_billing_orders
        FOR EACH ROW
        EXECUTE FUNCTION protect_subscription_billing_order();
        """
    )


def downgrade() -> None:
    op.execute(
        "DROP TRIGGER trg_sbo_protect "
        "ON subscription_billing_orders"
    )
    op.execute(
        "DROP FUNCTION protect_subscription_billing_order()"
    )
    op.drop_table("subscription_billing_orders")
    op.drop_constraint(
        "uq_ws_subscription_identity",
        "workspace_subscriptions",
        type_="unique",
    )