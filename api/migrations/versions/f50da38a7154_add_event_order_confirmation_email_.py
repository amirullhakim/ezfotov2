"""Add event order confirmation email tracking.

Revision ID: f50da38a7154
Revises: 8f1c4a7b9d22
"""

from alembic import op
import sqlalchemy as sa


revision = "f50da38a7154"
down_revision = "8f1c4a7b9d22"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "event_orders",
        sa.Column(
            "confirmation_email_sent_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )
    op.add_column(
        "event_orders",
        sa.Column(
            "confirmation_email_claimed_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )
    op.add_column(
        "event_orders",
        sa.Column(
            "confirmation_email_attempts",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )


def downgrade() -> None:
    op.drop_column("event_orders", "confirmation_email_attempts")
    op.drop_column("event_orders", "confirmation_email_claimed_at")
    op.drop_column("event_orders", "confirmation_email_sent_at")