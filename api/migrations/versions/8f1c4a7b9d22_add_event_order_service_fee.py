"""add event order service fee

Revision ID: 8f1c4a7b9d22
Revises: 0cf2520f7654
Create Date: 2026-09-21

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "8f1c4a7b9d22"
down_revision: Union[str, Sequence[str], None] = "0cf2520f7654"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "event_orders",
        sa.Column(
            "photo_subtotal_cents",
            sa.Integer(),
            nullable=True,
        ),
    )

    op.add_column(
        "event_orders",
        sa.Column(
            "service_fee_cents",
            sa.Integer(),
            nullable=True,
        ),
    )

    # Historical orders were created before the service fee existed.
    # Preserve their original totals exactly.
    op.execute(
        """
        UPDATE event_orders
        SET
            photo_subtotal_cents = total_cents,
            service_fee_cents = 0
        """
    )

    op.alter_column(
        "event_orders",
        "photo_subtotal_cents",
        existing_type=sa.Integer(),
        nullable=False,
    )

    op.alter_column(
        "event_orders",
        "service_fee_cents",
        existing_type=sa.Integer(),
        nullable=False,
    )

    op.create_check_constraint(
        "ck_event_orders_photo_subtotal_nonnegative",
        "event_orders",
        "photo_subtotal_cents >= 0",
    )

    op.create_check_constraint(
        "ck_event_orders_service_fee_nonnegative",
        "event_orders",
        "service_fee_cents >= 0",
    )

    op.create_check_constraint(
        "ck_event_orders_total_matches_breakdown",
        "event_orders",
        "total_cents = photo_subtotal_cents + service_fee_cents",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_event_orders_total_matches_breakdown",
        "event_orders",
        type_="check",
    )

    op.drop_constraint(
        "ck_event_orders_service_fee_nonnegative",
        "event_orders",
        type_="check",
    )

    op.drop_constraint(
        "ck_event_orders_photo_subtotal_nonnegative",
        "event_orders",
        type_="check",
    )

    op.drop_column(
        "event_orders",
        "service_fee_cents",
    )

    op.drop_column(
        "event_orders",
        "photo_subtotal_cents",
    )
