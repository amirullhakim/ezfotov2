"""seed initial services"""

from typing import Sequence, Union

from alembic import op


revision: str = "45fc7c64a563"
down_revision: Union[str, None] = "c56ecbac3f6b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO services (
            id,
            code,
            name,
            description,
            is_active,
            created_at,
            updated_at
        )
        VALUES
        (
            '37f3854b-5a76-4ac3-8d07-9cfaec84bb10',
            'WEBSITE',
            'Photographer Website',
            'Professional branded photography website and portfolio.',
            TRUE,
            NOW(),
            NOW()
        ),
        (
            '61f5d2a9-dc93-4c91-babf-22d8d4cd8ad5',
            'CLIENT_GALLERY',
            'Client Gallery',
            'Private or public galleries for client photo delivery and proofing.',
            TRUE,
            NOW(),
            NOW()
        ),
        (
            '96b1eb3e-706a-48fe-a417-6b30abf1fc91',
            'EVENT_SALES',
            'Event Photo Sales',
            'AI-powered event photo search, sales and digital delivery.',
            TRUE,
            NOW(),
            NOW()
        )
        ON CONFLICT (code) DO NOTHING;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM services
        WHERE code IN (
            'WEBSITE',
            'CLIENT_GALLERY',
            'EVENT_SALES'
        );
        """
    )