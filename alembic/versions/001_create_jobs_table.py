"""create jobs table

Revision ID: 001_create_jobs_table
Revises:
Create Date: 2026-04-11 18:00:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "001_create_jobs_table"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "jobs",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("status", sa.String(), nullable=False, server_default="PENDING"),
        sa.Column("stage", sa.String(), nullable=True),
        sa.Column("queue_position", sa.Integer(), nullable=True),
        sa.Column("result_json", sa.JSON(), nullable=True),
        sa.Column("error_message", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("input_path", sa.String(), nullable=True),
        sa.Column("input_type", sa.String(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("jobs")
