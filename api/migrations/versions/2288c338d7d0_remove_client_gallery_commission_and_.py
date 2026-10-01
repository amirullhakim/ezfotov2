"""Remove Client Gallery commission and customer fee.

Revision ID: 2288c338d7d0
Revises: 06b5b1395000
"""

from alembic import op
import sqlalchemy as sa


revision = "2288c338d7d0"
down_revision = "06b5b1395000"
branch_labels = None
depends_on = None


def _update_gallery_plan(
    commission_bps: int,
    fee_cents: int,
) -> None:
    connection = op.get_bind()

    updated = connection.execute(
        sa.text(
            """
            UPDATE service_plans AS p
            SET commission_bps = :commission_bps,
                customer_service_fee_cents = :fee_cents,
                updated_at = now()
            FROM services AS s
            WHERE p.service_id = s.id
              AND s.code = 'CLIENT_GALLERY'
              AND p.code = 'GALLERY_MONTHLY'
            RETURNING p.id
            """
        ),
        {
            "commission_bps": commission_bps,
            "fee_cents": fee_cents,
        },
    ).all()

    if len(updated) != 1:
        raise RuntimeError(
            "Expected exactly one GALLERY_MONTHLY plan."
        )


def upgrade() -> None:
    # Update the catalogue; preserve purchased subscription snapshots.
    _update_gallery_plan(
        commission_bps=0,
        fee_cents=0,
    )


def downgrade() -> None:
    _update_gallery_plan(
        commission_bps=500,
        fee_cents=200,
    )