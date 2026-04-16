"""create personas and contents tables

Revision ID: 002_create_personas_and_contents
Revises: 001_create_jobs_table
Create Date: 2026-04-15 10:00:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "002_create_personas_and_contents"
down_revision = "001_create_jobs_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "personas",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("demographics", sa.JSON(), nullable=False),
        sa.Column("psychographics", sa.JSON(), nullable=False),
        sa.Column("cognitive_state", sa.JSON(), nullable=False),
        sa.Column("environment", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_table(
        "contents",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("content_type", sa.String(), nullable=False),
        sa.Column("screen_count", sa.Integer(), nullable=True),
        sa.Column("content_text", sa.String(), nullable=True),
        sa.Column("meta_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("contents")
    op.drop_table("personas")
