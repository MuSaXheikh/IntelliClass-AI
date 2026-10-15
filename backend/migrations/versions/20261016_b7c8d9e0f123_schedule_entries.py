"""schedule_entries: planned class meetings

Revision ID: b7c8d9e0f123
Revises: a3d4e5f60718
Create Date: 2026-10-16
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "b7c8d9e0f123"
down_revision: str | None = "a3d4e5f60718"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "schedule_entries",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("class_id", sa.String(length=36), nullable=False),
        sa.Column("scheduled_date", sa.Date(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=True),
        sa.Column("topic", sa.String(length=200), nullable=False),
        sa.Column("location", sa.String(length=200), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("cancel_reason", sa.String(length=300), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["class_id"], ["classes.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("class_id", "scheduled_date", "start_time", name="uq_schedule_slot"),
    )
    op.create_index("ix_schedule_entries_class_id", "schedule_entries", ["class_id"])
    op.create_index("ix_schedule_entries_scheduled_date", "schedule_entries", ["scheduled_date"])
    op.create_index("ix_schedule_entries_status", "schedule_entries", ["status"])


def downgrade() -> None:
    op.drop_index("ix_schedule_entries_status", table_name="schedule_entries")
    op.drop_index("ix_schedule_entries_scheduled_date", table_name="schedule_entries")
    op.drop_index("ix_schedule_entries_class_id", table_name="schedule_entries")
    op.drop_table("schedule_entries")
