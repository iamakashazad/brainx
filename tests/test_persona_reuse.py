from __future__ import annotations

import uuid

import pytest
from sqlalchemy import select

from backend.core import database
from backend.models.job import Job

pytestmark = pytest.mark.asyncio


async def test_persona_reused_across_jobs(client, persona_fixture):
    job_ids: list[str] = []
    async with database.async_session() as session:
        for _ in range(2):
            job = Job(id=str(uuid.uuid4()), status="PENDING", persona_id=persona_fixture)
            session.add(job)
            job_ids.append(job.id)
        await session.commit()

    async with database.async_session() as session:
        result = await session.execute(select(Job).where(Job.id.in_(job_ids)))
        jobs = result.scalars().all()

    assert len(jobs) == 2
    assert all(job.persona_id == persona_fixture for job in jobs)
