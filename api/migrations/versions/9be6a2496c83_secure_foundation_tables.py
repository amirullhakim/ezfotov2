"""secure foundation tables

Revision ID: 9be6a2496c83
Revises: 45fc7c64a563
Create Date: 2026-09-15 00:30:59.520338

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9be6a2496c83'
down_revision: Union[str, Sequence[str], None] = '45fc7c64a563'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # profiles.id must correspond to a real Supabase Auth user.
    op.create_foreign_key(
        "fk_profiles_auth_user",
        "profiles",
        "users",
        ["id"],
        ["id"],
        source_schema="public",
        referent_schema="auth",
        ondelete="CASCADE",
    )

    protected_tables = [
        "profiles",
        "workspaces",
        "workspace_members",
        "services",
        "workspace_services",
        "domains",
    ]

    for table_name in protected_tables:
        op.execute(
            f"ALTER TABLE public.{table_name} ENABLE ROW LEVEL SECURITY"
        )

        op.execute(
            f"REVOKE ALL ON TABLE public.{table_name} "
            f"FROM anon, authenticated"
        )


def downgrade() -> None:
    protected_tables = [
        "profiles",
        "workspaces",
        "workspace_members",
        "services",
        "workspace_services",
        "domains",
    ]

    for table_name in protected_tables:
        op.execute(
            f"ALTER TABLE public.{table_name} DISABLE ROW LEVEL SECURITY"
        )

    op.drop_constraint(
        "fk_profiles_auth_user",
        "profiles",
        schema="public",
        type_="foreignkey",
    )
