"""Add client gallery pricing and website listing.

Revision ID: 40881b06e191
Revises: 27b98893dcca

Listing is opt-in. Existing galleries remain unlisted and without a price.
"""
from alembic import op
import sqlalchemy as sa

revision = "40881b06e191"
down_revision = "27b98893dcca"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("client_galleries", sa.Column("price_rm", sa.Numeric(10, 2), nullable=True))
    op.add_column("client_galleries", sa.Column("show_on_website", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.create_check_constraint("ck_client_galleries_price_rm", "client_galleries", 'price_rm IS NULL OR (price_rm >= 0 AND price_rm < 100000000)')
    op.create_check_constraint("ck_client_galleries_website_privacy", "client_galleries", "NOT show_on_website OR privacy_mode IN ('PUBLIC', 'PASSWORD')")


def downgrade() -> None:
    op.drop_constraint("ck_client_galleries_website_privacy", "client_galleries", type_="check")
    op.drop_constraint("ck_client_galleries_price_rm", "client_galleries", type_="check")
    op.drop_column("client_galleries", "show_on_website")
    op.drop_column("client_galleries", "price_rm")
