"""secure event sales tables"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "8d643c4834c5"
down_revision: Union[str, Sequence[str], None] = "042d8e118cc2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Enable RLS and block direct browser access."""

    op.execute(
        """
        ALTER TABLE event_galleries
        ENABLE ROW LEVEL SECURITY;
        """
    )

    op.execute(
        """
        ALTER TABLE event_photos
        ENABLE ROW LEVEL SECURITY;
        """
    )

    op.execute(
        """
        REVOKE ALL
        ON TABLE event_galleries
        FROM anon, authenticated;
        """
    )

    op.execute(
        """
        REVOKE ALL
        ON TABLE event_photos
        FROM anon, authenticated;
        """
    )


def downgrade() -> None:
    """Restore pre-security state."""

    op.execute(
        """
        GRANT ALL
        ON TABLE event_galleries
        TO anon, authenticated;
        """
    )

    op.execute(
        """
        GRANT ALL
        ON TABLE event_photos
        TO anon, authenticated;
        """
    )

    op.execute(
        """
        ALTER TABLE event_photos
        DISABLE ROW LEVEL SECURITY;
        """
    )

    op.execute(
        """
        ALTER TABLE event_galleries
        DISABLE ROW LEVEL SECURITY;
        """
    )