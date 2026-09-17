"""secure client gallery tables

Revision ID: 258f968fadd1
Revises: f9cdb0f95531
Create Date: 2026-09-17 11:42:38.910675

"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "258f968fadd1"
down_revision: Union[str, Sequence[str], None] = "f9cdb0f95531"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Secure Client Gallery tables from direct browser access."""

    # --------------------------------------------------
    # Enable Row Level Security
    # --------------------------------------------------

    op.execute(
        """
        ALTER TABLE client_galleries
        ENABLE ROW LEVEL SECURITY;
        """
    )

    op.execute(
        """
        ALTER TABLE gallery_photos
        ENABLE ROW LEVEL SECURITY;
        """
    )

    op.execute(
        """
        ALTER TABLE gallery_favourites
        ENABLE ROW LEVEL SECURITY;
        """
    )

    # --------------------------------------------------
    # Remove direct Supabase API access
    # --------------------------------------------------
    #
    # EZFOTOO business data is accessed through FastAPI.
    # The browser should not directly query or mutate
    # these tables using Supabase anon/authenticated roles.
    # --------------------------------------------------

    op.execute(
        """
        REVOKE ALL PRIVILEGES
        ON TABLE client_galleries
        FROM anon, authenticated;
        """
    )

    op.execute(
        """
        REVOKE ALL PRIVILEGES
        ON TABLE gallery_photos
        FROM anon, authenticated;
        """
    )

    op.execute(
        """
        REVOKE ALL PRIVILEGES
        ON TABLE gallery_favourites
        FROM anon, authenticated;
        """
    )


def downgrade() -> None:
    """Restore the pre-security Client Gallery table state."""

    # --------------------------------------------------
    # Restore direct table privileges
    # --------------------------------------------------

    op.execute(
        """
        GRANT ALL PRIVILEGES
        ON TABLE client_galleries
        TO anon, authenticated;
        """
    )

    op.execute(
        """
        GRANT ALL PRIVILEGES
        ON TABLE gallery_photos
        TO anon, authenticated;
        """
    )

    op.execute(
        """
        GRANT ALL PRIVILEGES
        ON TABLE gallery_favourites
        TO anon, authenticated;
        """
    )

    # --------------------------------------------------
    # Disable Row Level Security
    # --------------------------------------------------

    op.execute(
        """
        ALTER TABLE gallery_favourites
        DISABLE ROW LEVEL SECURITY;
        """
    )

    op.execute(
        """
        ALTER TABLE gallery_photos
        DISABLE ROW LEVEL SECURITY;
        """
    )

    op.execute(
        """
        ALTER TABLE client_galleries
        DISABLE ROW LEVEL SECURITY;
        """
    )