"""Enable the pgvector extension on PostgreSQL (no-op on SQLite).

Revision ID: 8f2c1a9d4e67
Revises: 5ca6ee7b4db9
Create Date: 2026-10-15
"""

from alembic import op

revision = "8f2c1a9d4e67"
down_revision = "5ca6ee7b4db9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if op.get_bind().dialect.name == "postgresql":
        op.execute("CREATE EXTENSION IF NOT EXISTS vector")


def downgrade() -> None:
    if op.get_bind().dialect.name == "postgresql":
        op.execute("DROP EXTENSION IF EXISTS vector")
