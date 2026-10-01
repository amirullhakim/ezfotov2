"""Add subscription cancellation and refund tracking.

Revision ID: 9130d9009dff
Revises: 40881b06e191

Creates tracking records only. Does not cancel subscriptions, change paid
periods, mark orders refunded, or send money through CHIP.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "9130d9009dff"
down_revision = "40881b06e191"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Composite references prevent cross-workspace links.
    op.create_unique_constraint(
        "uq_sbo_id_workspace", "subscription_billing_orders",
        ["id", "workspace_id"], schema="public",
    )
    op.create_table(
        "subscription_refund_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("billing_order_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("requested_by_profile_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("amount_cents", sa.BigInteger(), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("status", sa.String(20), nullable=False,
                  server_default=sa.text("'REQUESTED'")),
        sa.Column("reviewed_by_profile_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("review_notes", sa.Text(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("provider_refund_reference", sa.String(255), nullable=True),
        sa.Column("provider_verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("refunded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["workspace_id"], ["public.workspaces.id"],
                                ondelete="RESTRICT", name="fk_srr_workspace"),
        sa.ForeignKeyConstraint(["billing_order_id", "workspace_id"],
                                ["public.subscription_billing_orders.id",
                                 "public.subscription_billing_orders.workspace_id"],
                                ondelete="RESTRICT", name="fk_srr_order_workspace"),
        sa.ForeignKeyConstraint(["requested_by_profile_id"], ["public.profiles.id"],
                                ondelete="RESTRICT", name="fk_srr_requester"),
        sa.ForeignKeyConstraint(["reviewed_by_profile_id"], ["public.profiles.id"],
                                ondelete="RESTRICT", name="fk_srr_reviewer"),
        sa.UniqueConstraint("billing_order_id", name="uq_srr_billing_order"),
        sa.UniqueConstraint("id", "workspace_id", name="uq_srr_id_workspace"),
        sa.CheckConstraint("length(trim(reason)) BETWEEN 10 AND 2000", name="ck_srr_reason"),
        sa.CheckConstraint("amount_cents > 0", name="ck_srr_amount"),
        sa.CheckConstraint("currency ~ '^[A-Z]{3}$'", name="ck_srr_currency"),
        sa.CheckConstraint(
            "status IN ('REQUESTED', 'APPROVED', 'REJECTED', 'PROCESSING', 'REFUNDED', 'FAILED')",
            name="ck_srr_status",
        ),
        sa.CheckConstraint(
            "(status = 'REQUESTED' AND reviewed_by_profile_id IS NULL AND reviewed_at IS NULL "
            "AND review_notes IS NULL) OR "
            "(status <> 'REQUESTED' AND reviewed_by_profile_id IS NOT NULL AND reviewed_at IS NOT NULL)",
            name="ck_srr_review_state",
        ),
        sa.CheckConstraint(
            "review_notes IS NULL OR length(trim(review_notes)) BETWEEN 1 AND 2000",
            name="ck_srr_review_notes",
        ),
        sa.CheckConstraint(
            "status <> 'REJECTED' OR (review_notes IS NOT NULL AND length(trim(review_notes)) > 0)",
            name="ck_srr_rejection_reason",
        ),
        sa.CheckConstraint(
            "provider_refund_reference IS NULL OR length(trim(provider_refund_reference)) > 0",
            name="ck_srr_provider_reference",
        ),
        sa.CheckConstraint(
            "(status = 'REFUNDED' AND provider_refund_reference IS NOT NULL "
            "AND provider_verified_at IS NOT NULL AND refunded_at IS NOT NULL) OR "
            "(status <> 'REFUNDED' AND provider_verified_at IS NULL AND refunded_at IS NULL)",
            name="ck_srr_refund_state",
        ),
        schema="public",
    )
    op.create_index("ix_srr_workspace_created", "subscription_refund_requests",
                    ["workspace_id", "created_at"], schema="public")
    op.create_index("ix_srr_status_created", "subscription_refund_requests",
                    ["status", "created_at"], schema="public")
    op.create_index("ix_srr_requester", "subscription_refund_requests",
                    ["requested_by_profile_id"], schema="public")
    op.create_index("ix_srr_reviewer", "subscription_refund_requests",
                    ["reviewed_by_profile_id"], schema="public")

    op.create_table(
        "subscription_management_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("service_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("subscription_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("billing_order_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("refund_request_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("actor_profile_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("action", sa.String(30), nullable=False),
        sa.Column("effective_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["workspace_id"], ["public.workspaces.id"],
                                ondelete="RESTRICT", name="fk_sme_workspace"),
        sa.ForeignKeyConstraint(["service_id"], ["public.services.id"],
                                ondelete="RESTRICT", name="fk_sme_service"),
        sa.ForeignKeyConstraint(["subscription_id", "workspace_id", "service_id"],
                                ["public.workspace_subscriptions.id",
                                 "public.workspace_subscriptions.workspace_id",
                                 "public.workspace_subscriptions.service_id"],
                                ondelete="RESTRICT", name="fk_sme_subscription_identity"),
        sa.ForeignKeyConstraint(["billing_order_id", "workspace_id"],
                                ["public.subscription_billing_orders.id",
                                 "public.subscription_billing_orders.workspace_id"],
                                ondelete="RESTRICT", name="fk_sme_order_workspace"),
        sa.ForeignKeyConstraint(["refund_request_id", "workspace_id"],
                                ["public.subscription_refund_requests.id",
                                 "public.subscription_refund_requests.workspace_id"],
                                ondelete="RESTRICT", name="fk_sme_refund_workspace"),
        sa.ForeignKeyConstraint(["actor_profile_id"], ["public.profiles.id"],
                                ondelete="RESTRICT", name="fk_sme_actor"),
        sa.CheckConstraint(
            "action IN ('CANCEL_SCHEDULED', 'CANCEL_REVOKED', 'REFUND_REQUESTED', "
            "'REFUND_APPROVED', 'REFUND_REJECTED', 'REFUND_PROCESSING', 'REFUND_COMPLETED', 'REFUND_FAILED')",
            name="ck_sme_action",
        ),
        sa.CheckConstraint(
            "(action IN ('CANCEL_SCHEDULED', 'CANCEL_REVOKED') AND subscription_id IS NOT NULL "
            "AND effective_at IS NOT NULL AND billing_order_id IS NULL AND refund_request_id IS NULL) OR "
            "(action LIKE 'REFUND_%' AND billing_order_id IS NOT NULL AND refund_request_id IS NOT NULL)",
            name="ck_sme_target",
        ),
        sa.CheckConstraint("notes IS NULL OR length(notes) <= 2000", name="ck_sme_notes"),
        schema="public",
    )
    op.create_index("ix_sme_workspace_created", "subscription_management_events",
                    ["workspace_id", "created_at"], schema="public")
    op.create_index("ix_sme_subscription", "subscription_management_events",
                    ["subscription_id"], schema="public")
    op.create_index("ix_sme_refund", "subscription_management_events",
                    ["refund_request_id"], schema="public")
    op.create_index("ix_sme_order", "subscription_management_events",
                    ["billing_order_id"], schema="public")
    op.create_index("ix_sme_actor", "subscription_management_events",
                    ["actor_profile_id"], schema="public")

    # No browser policies: authenticated backend routes enforce access.
    op.execute("ALTER TABLE public.subscription_refund_requests ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE public.subscription_management_events ENABLE ROW LEVEL SECURITY")
    op.execute("REVOKE ALL ON public.subscription_refund_requests FROM anon, authenticated")
    op.execute("REVOKE ALL ON public.subscription_management_events FROM anon, authenticated")

    op.execute("""
        CREATE FUNCTION public.protect_subscription_refund_request()
        RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
        DECLARE
            billing public.subscription_billing_orders%ROWTYPE;
        BEGIN
            IF TG_OP = 'DELETE' THEN
                RAISE EXCEPTION 'Subscription refund requests cannot be deleted.';
            END IF;
            IF TG_OP = 'INSERT' THEN
                IF NEW.status <> 'REQUESTED' THEN
                    RAISE EXCEPTION 'Refund requests must begin as REQUESTED.';
                END IF;
                SELECT * INTO billing FROM public.subscription_billing_orders
                WHERE id = NEW.billing_order_id AND workspace_id = NEW.workspace_id
                FOR SHARE;
                IF NOT FOUND OR billing.status <> 'PAID' OR billing.paid_at IS NULL THEN
                    RAISE EXCEPTION 'Refund requests require a verified paid billing order.';
                END IF;
                IF NEW.amount_cents <> billing.total_cents OR NEW.currency <> billing.currency THEN
                    RAISE EXCEPTION 'Refund amount and currency must match the paid order.';
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM public.workspace_members m
                    JOIN public.profiles p ON p.id = m.profile_id
                    WHERE m.workspace_id = NEW.workspace_id
                      AND m.profile_id = NEW.requested_by_profile_id
                      AND m.role = 'OWNER' AND m.status = 'ACTIVE' AND p.is_active
                ) THEN
                    RAISE EXCEPTION 'Only an active workspace owner can request a refund.';
                END IF;
                RETURN NEW;
            END IF;
            IF ROW(NEW.id, NEW.workspace_id, NEW.billing_order_id, NEW.requested_by_profile_id,
                   NEW.reason, NEW.amount_cents, NEW.currency, NEW.created_at)
                IS DISTINCT FROM
               ROW(OLD.id, OLD.workspace_id, OLD.billing_order_id, OLD.requested_by_profile_id,
                   OLD.reason, OLD.amount_cents, OLD.currency, OLD.created_at) THEN
                RAISE EXCEPTION 'Refund request identity and original terms are immutable.';
            END IF;
            IF OLD.status IN ('REJECTED', 'REFUNDED') THEN
                RAISE EXCEPTION 'Finalized refund requests cannot be changed.';
            END IF;
            IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
                (OLD.status = 'REQUESTED' AND NEW.status IN ('APPROVED', 'REJECTED')) OR
                (OLD.status = 'APPROVED' AND NEW.status IN ('PROCESSING', 'REFUNDED', 'FAILED')) OR
                (OLD.status = 'PROCESSING' AND NEW.status IN ('REFUNDED', 'FAILED')) OR
                (OLD.status = 'FAILED' AND NEW.status = 'PROCESSING')
            ) THEN
                RAISE EXCEPTION 'Invalid refund request status transition.';
            END IF;
            IF OLD.reviewed_at IS NOT NULL AND
               ROW(NEW.reviewed_by_profile_id, NEW.reviewed_at, NEW.review_notes) IS DISTINCT FROM
               ROW(OLD.reviewed_by_profile_id, OLD.reviewed_at, OLD.review_notes) THEN
                RAISE EXCEPTION 'Refund review decisions are immutable.';
            END IF;
            IF OLD.provider_refund_reference IS NOT NULL AND
               NEW.provider_refund_reference IS DISTINCT FROM OLD.provider_refund_reference THEN
                RAISE EXCEPTION 'Provider refund reference cannot be replaced.';
            END IF;
            IF OLD.reviewed_at IS NULL AND NEW.reviewed_at IS NOT NULL AND NOT EXISTS (
                SELECT 1 FROM public.profiles p
                WHERE p.id = NEW.reviewed_by_profile_id
                  AND p.is_platform_admin AND p.is_active
            ) THEN
                RAISE EXCEPTION 'Refund review requires an active platform administrator.';
            END IF;
            NEW.updated_at = now();
            RETURN NEW;
        END;
        $$;
        CREATE TRIGGER trg_srr_protect BEFORE INSERT OR UPDATE OR DELETE
        ON public.subscription_refund_requests FOR EACH ROW
        EXECUTE FUNCTION public.protect_subscription_refund_request();
    """)
    op.execute("""
        CREATE FUNCTION public.prevent_subscription_tracking_changes()
        RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            RAISE EXCEPTION 'Subscription tracking history cannot be deleted, updated or truncated.';
        END;
        $$;
        CREATE TRIGGER trg_sme_immutable BEFORE UPDATE OR DELETE OR TRUNCATE
        ON public.subscription_management_events FOR EACH STATEMENT
        EXECUTE FUNCTION public.prevent_subscription_tracking_changes();
        CREATE TRIGGER trg_srr_no_truncate BEFORE TRUNCATE
        ON public.subscription_refund_requests FOR EACH STATEMENT
        EXECUTE FUNCTION public.prevent_subscription_tracking_changes();
    """)
    op.execute("""
        CREATE FUNCTION public.validate_subscription_management_event()
        RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
        DECLARE
            billing public.subscription_billing_orders%ROWTYPE;
            request_record public.subscription_refund_requests%ROWTYPE;
        BEGIN
            IF NEW.action LIKE 'REFUND_%' THEN
                SELECT * INTO request_record FROM public.subscription_refund_requests
                WHERE id = NEW.refund_request_id AND workspace_id = NEW.workspace_id;
                IF NOT FOUND OR request_record.billing_order_id IS DISTINCT FROM NEW.billing_order_id THEN
                    RAISE EXCEPTION 'Refund event must reference the matching request and order.';
                END IF;
                SELECT * INTO billing FROM public.subscription_billing_orders
                WHERE id = NEW.billing_order_id AND workspace_id = NEW.workspace_id;
                IF NOT FOUND OR billing.service_id IS DISTINCT FROM NEW.service_id
                   OR billing.subscription_id IS DISTINCT FROM NEW.subscription_id THEN
                    RAISE EXCEPTION 'Refund event must match the order service and subscription.';
                END IF;
                IF (NEW.action = 'REFUND_REQUESTED' AND request_record.status <> 'REQUESTED') OR
                   (NEW.action = 'REFUND_APPROVED' AND request_record.status <> 'APPROVED') OR
                   (NEW.action = 'REFUND_REJECTED' AND request_record.status <> 'REJECTED') OR
                   (NEW.action = 'REFUND_PROCESSING' AND request_record.status <> 'PROCESSING') OR
                   (NEW.action = 'REFUND_COMPLETED' AND request_record.status <> 'REFUNDED') OR
                   (NEW.action = 'REFUND_FAILED' AND request_record.status <> 'FAILED') THEN
                    RAISE EXCEPTION 'Refund event action must match the request state.';
                END IF;
            END IF;
            RETURN NEW;
        END;
        $$;
        CREATE TRIGGER trg_sme_validate BEFORE INSERT
        ON public.subscription_management_events FOR EACH ROW
        EXECUTE FUNCTION public.validate_subscription_management_event();
    """)


def downgrade() -> None:
    # Refuse to silently erase real cancellation/refund history.
    op.execute("""
        DO $$ BEGIN
            IF EXISTS (SELECT 1 FROM public.subscription_management_events)
               OR EXISTS (SELECT 1 FROM public.subscription_refund_requests) THEN
                RAISE EXCEPTION 'Cannot downgrade while subscription tracking records exist.';
            END IF;
        END $$;
    """)
    op.drop_table("subscription_management_events", schema="public")
    op.drop_table("subscription_refund_requests", schema="public")
    op.execute("DROP FUNCTION public.validate_subscription_management_event()")
    op.execute("DROP FUNCTION public.prevent_subscription_tracking_changes()")
    op.execute("DROP FUNCTION public.protect_subscription_refund_request()")
    op.drop_constraint("uq_sbo_id_workspace", "subscription_billing_orders",
                       type_="unique", schema="public")