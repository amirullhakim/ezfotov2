"""secure remaining business tables"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "76781d38e2dc"
down_revision: Union[str, Sequence[str], None] = "7bdd8a0cf1b6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Enable RLS and block direct browser access."""

    tables = (
        "media_assets",
        "photography_packages",
        "portfolio_items",
        "website_settings",
    )

    for table_name in tables:
        op.execute(
            f"""
            ALTER TABLE {table_name}
            ENABLE ROW LEVEL SECURITY;
            """
        )

        op.execute(
            f"""
            REVOKE ALL
            ON TABLE {table_name}
            FROM anon, authenticated;
            """
        )


def downgrade() -> None:
    """Restore previous unrestricted state."""

    tables = (
        "media_assets",
        "photography_packages",
        "portfolio_items",
        "website_settings",
    )

    for table_name in tables:
        op.execute(
            f"""
            GRANT ALL
            ON TABLE {table_name}
            TO anon, authenticated;
            """
        )

        op.execute(
            f"""
            ALTER TABLE {table_name}
            DISABLE ROW LEVEL SECURITY;
            """
        )