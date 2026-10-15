"""instructor_settings: per-instructor alert preferences

Revision ID: a3d4e5f60718
Revises: 8f2c1a9d4e67
Create Date: 2026-10-15
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "a3d4e5f60718"
down_revision: str | None = "8f2c1a9d4e67"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "instructor_settings",
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("drowsy_min_seconds", sa.Float(), nullable=False),
        sa.Column("lookaway_min_seconds", sa.Float(), nullable=False),
        sa.Column("noface_min_seconds", sa.Float(), nullable=False),
        sa.Column("camera_off_min_seconds", sa.Float(), nullable=False),
        sa.Column("screen_grace_seconds", sa.Float(), nullable=False),
        sa.Column("alert_cooldown_seconds", sa.Float(), nullable=False),
        sa.Column("alert_confidence_threshold", sa.Float(), nullable=False),
        sa.Column("nudge_rate_limit", sa.Integer(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("user_id"),
    )


def downgrade() -> None:
    op.drop_table("instructor_settings")
