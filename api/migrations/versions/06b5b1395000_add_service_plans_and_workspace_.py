"""Add service plans and workspace subscriptions.

Revision ID: 06b5b1395000
Revises: 635b64bbfea1
"""

import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "06b5b1395000"
down_revision = "635b64bbfea1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    connection = op.get_bind()
    service_ids = dict(
        connection.execute(
            sa.text(
                "SELECT code, id FROM services "
                "WHERE code IN ('WEBSITE', 'CLIENT_GALLERY', 'EVENT_SALES')"
            )
        ).all()
    )

    missing = {"WEBSITE", "CLIENT_GALLERY", "EVENT_SALES"} - service_ids.keys()
    if missing:
        raise RuntimeError(f"Required services are missing: {sorted(missing)}")

    op.create_table(
        "service_plans",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("service_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("code", sa.String(80), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("price_cents", sa.BigInteger(), nullable=False),
        sa.Column("billing_interval_months", sa.SmallInteger(), nullable=False),
        sa.Column("commission_bps", sa.SmallInteger(), nullable=False),
        sa.Column("customer_service_fee_cents", sa.BigInteger(), nullable=False),
        sa.Column("storage_limit_bytes", sa.BigInteger(), nullable=True),
        sa.Column("active_event_limit", sa.Integer(), nullable=True),
        sa.Column(
            "includes_website",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column(
            "is_active",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
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
        sa.PrimaryKeyConstraint("id", name="pk_service_plans"),
        sa.ForeignKeyConstraint(
            ["service_id"],
            ["services.id"],
            ondelete="RESTRICT",
            name="fk_service_plans_service",
        ),
        sa.UniqueConstraint("code", name="uq_service_plans_code"),
        # The composite key prevents subscriptions using the wrong service.
        sa.UniqueConstraint(
            "id",
            "service_id",
            name="uq_service_plans_id_service",
        ),
        sa.CheckConstraint(
            "price_cents >= 0 AND customer_service_fee_cents >= 0",
            name="ck_service_plans_amounts",
        ),
        sa.CheckConstraint(
            "commission_bps BETWEEN 0 AND 10000",
            name="ck_service_plans_commission",
        ),
        sa.CheckConstraint(
            "billing_interval_months IN (1, 12)",
            name="ck_service_plans_interval",
        ),
        sa.CheckConstraint(
            "storage_limit_bytes IS NULL OR storage_limit_bytes > 0",
            name="ck_service_plans_storage",
        ),
        sa.CheckConstraint(
            "active_event_limit IS NULL OR active_event_limit > 0",
            name="ck_service_plans_event_limit",
        ),
        sa.CheckConstraint(
            "currency ~ '^[A-Z]{3}$'",
            name="ck_service_plans_currency",
        ),
        sa.CheckConstraint(
            "length(trim(code)) > 0 AND length(trim(name)) > 0",
            name="ck_service_plans_names",
        ),
    )

    op.create_index(
        "ix_service_plans_service_active",
        "service_plans",
        ["service_id", "is_active"],
    )

    op.create_table(
        "workspace_subscriptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("service_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "status",
            sa.String(20),
            server_default=sa.text("'PENDING'"),
            nullable=False,
        ),
        # Purchased terms remain separate from later catalogue changes.
        sa.Column("plan_code_snapshot", sa.String(80), nullable=False),
        sa.Column("plan_name_snapshot", sa.String(100), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("price_cents", sa.BigInteger(), nullable=False),
        sa.Column("billing_interval_months", sa.SmallInteger(), nullable=False),
        sa.Column("commission_bps", sa.SmallInteger(), nullable=False),
        sa.Column("customer_service_fee_cents", sa.BigInteger(), nullable=False),
        sa.Column("storage_limit_bytes", sa.BigInteger(), nullable=True),
        sa.Column("active_event_limit", sa.Integer(), nullable=True),
        sa.Column("includes_website", sa.Boolean(), nullable=False),
        sa.Column(
            "current_period_start",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "current_period_end",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "cancel_at_period_end",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column(
            "canceled_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
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
        sa.PrimaryKeyConstraint(
            "id",
            name="pk_workspace_subscriptions",
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id"],
            ["workspaces.id"],
            ondelete="RESTRICT",
            name="fk_workspace_subscriptions_workspace",
        ),
        sa.ForeignKeyConstraint(
            ["service_id"],
            ["services.id"],
            ondelete="RESTRICT",
            name="fk_workspace_subscriptions_service",
        ),
        sa.ForeignKeyConstraint(
            ["plan_id", "service_id"],
            ["service_plans.id", "service_plans.service_id"],
            ondelete="RESTRICT",
            name="fk_workspace_subscriptions_plan_service",
        ),
        # One current subscription per workspace/service.
        # Payment and renewal history will be stored separately.
        sa.UniqueConstraint(
            "workspace_id",
            "service_id",
            name="uq_workspace_subscriptions_workspace_service",
        ),
        sa.CheckConstraint(
            "status IN ('PENDING', 'ACTIVE', 'EXPIRED', 'CANCELED')",
            name="ck_workspace_subscriptions_status",
        ),
        sa.CheckConstraint(
            "price_cents >= 0 AND customer_service_fee_cents >= 0",
            name="ck_workspace_subscriptions_amounts",
        ),
        sa.CheckConstraint(
            "commission_bps BETWEEN 0 AND 10000",
            name="ck_workspace_subscriptions_commission",
        ),
        sa.CheckConstraint(
            "billing_interval_months IN (1, 12)",
            name="ck_workspace_subscriptions_interval",
        ),
        sa.CheckConstraint(
            "storage_limit_bytes IS NULL OR storage_limit_bytes > 0",
            name="ck_workspace_subscriptions_storage",
        ),
        sa.CheckConstraint(
            "active_event_limit IS NULL OR active_event_limit > 0",
            name="ck_workspace_subscriptions_event_limit",
        ),
        sa.CheckConstraint(
            "currency ~ '^[A-Z]{3}$'",
            name="ck_workspace_subscriptions_currency",
        ),
        sa.CheckConstraint(
            "length(trim(plan_code_snapshot)) > 0 "
            "AND length(trim(plan_name_snapshot)) > 0",
            name="ck_workspace_subscriptions_names",
        ),
        sa.CheckConstraint(
            "(current_period_start IS NULL AND current_period_end IS NULL) "
            "OR (current_period_start IS NOT NULL "
            "AND current_period_end IS NOT NULL "
            "AND current_period_end > current_period_start)",
            name="ck_workspace_subscriptions_period",
        ),
        sa.CheckConstraint(
            "status <> 'ACTIVE' OR "
            "(current_period_start IS NOT NULL "
            "AND current_period_end IS NOT NULL)",
            name="ck_workspace_subscriptions_active_period",
        ),
    )

    op.create_index(
        "ix_workspace_subscriptions_service",
        "workspace_subscriptions",
        ["service_id"],
    )
    op.create_index(
        "ix_workspace_subscriptions_plan_service",
        "workspace_subscriptions",
        ["plan_id", "service_id"],
    )
    op.create_index(
        "ix_workspace_subscriptions_status_end",
        "workspace_subscriptions",
        ["status", "current_period_end"],
    )

    # GB is decimal: 1 GB = 1,000,000,000 bytes.
    # service, code, name, cents, months, commission bps,
    # customer fee cents, storage GB, active events, included website
    definitions = [
        (
            "WEBSITE", "WEBSITE_MONTHLY", "Website Monthly",
            4900, 1, 0, 0, None, None, False,
        ),
        (
            "WEBSITE", "WEBSITE_YEARLY", "Website Yearly",
            49000, 12, 0, 0, None, None, False,
        ),
        (
            "CLIENT_GALLERY", "GALLERY_MONTHLY", "Client Gallery",
            7900, 1, 500, 200, 50, None, True,
        ),
        (
            "EVENT_SALES", "EVENT_STARTER_MONTHLY", "Starter",
            9900, 1, 1500, 200, 25, 1, True,
        ),
        (
            "EVENT_SALES", "EVENT_GROWTH_MONTHLY", "Growth",
            24900, 1, 1000, 200, 100, 5, True,
        ),
        (
            "EVENT_SALES", "EVENT_PRO_MONTHLY", "Pro",
            49900, 1, 700, 200, 300, 20, True,
        ),
    ]

    plan_table = sa.table(
        "service_plans",
        sa.column("id", postgresql.UUID(as_uuid=True)),
        sa.column("service_id", postgresql.UUID(as_uuid=True)),
        sa.column("code", sa.String(80)),
        sa.column("name", sa.String(100)),
        sa.column("currency", sa.String(3)),
        sa.column("price_cents", sa.BigInteger()),
        sa.column("billing_interval_months", sa.SmallInteger()),
        sa.column("commission_bps", sa.SmallInteger()),
        sa.column("customer_service_fee_cents", sa.BigInteger()),
        sa.column("storage_limit_bytes", sa.BigInteger()),
        sa.column("active_event_limit", sa.Integer()),
        sa.column("includes_website", sa.Boolean()),
        sa.column("is_active", sa.Boolean()),
    )

    rows = []
    for (
        service, code, name, price, months,
        bps, fee, gb, events, website
    ) in definitions:
        rows.append(
            {
                "id": uuid.uuid5(
                    uuid.NAMESPACE_URL,
                    f"https://ezfotoo.com/plans/{code}/v1",
                ),
                "service_id": service_ids[service],
                "code": code,
                "name": name,
                "currency": "MYR",
                "price_cents": price,
                "billing_interval_months": months,
                "commission_bps": bps,
                "customer_service_fee_cents": fee,
                "storage_limit_bytes": (
                    None if gb is None else gb * 1_000_000_000
                ),
                "active_event_limit": events,
                "includes_website": website,
                "is_active": True,
            }
        )

    op.bulk_insert(plan_table, rows)

    # Backend-only access; no direct browser table policies.
    op.execute("ALTER TABLE service_plans ENABLE ROW LEVEL SECURITY")
    op.execute(
        "ALTER TABLE workspace_subscriptions ENABLE ROW LEVEL SECURITY"
    )


def downgrade() -> None:
    op.drop_table("workspace_subscriptions")
    op.drop_table("service_plans")