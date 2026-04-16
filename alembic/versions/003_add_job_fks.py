"""add persona_id and content_id fks to jobs

Revision ID: 003_add_job_fks
Revises: 002_create_personas_and_contents
Create Date: 2026-04-15 10:05:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "003_add_job_fks"
down_revision = "002_create_personas_and_contents"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("PRAGMA foreign_keys=OFF")
    with op.batch_alter_table("jobs") as batch:
        batch.add_column(sa.Column("persona_id", sa.String(), nullable=True))
        batch.add_column(sa.Column("content_id", sa.String(), nullable=True))
        batch.create_foreign_key("fk_jobs_persona", "personas", ["persona_id"], ["id"])
        batch.create_foreign_key("fk_jobs_content", "contents", ["content_id"], ["id"])
    op.execute("PRAGMA foreign_keys=ON")


def downgrade() -> None:
    op.execute("PRAGMA foreign_keys=OFF")
    with op.batch_alter_table("jobs") as batch:
        batch.drop_constraint("fk_jobs_content", type_="foreignkey")
        batch.drop_constraint("fk_jobs_persona", type_="foreignkey")
        batch.drop_column("content_id")
        batch.drop_column("persona_id")
    op.execute("PRAGMA foreign_keys=ON")
