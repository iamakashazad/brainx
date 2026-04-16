from __future__ import annotations

import logging
import uuid

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from backend.core import queue as queue_manager
from backend.models.job import Base, Job, StageEnum


@pytest.mark.asyncio
async def test_transition_writes(tmp_path, caplog):
    db_url = f"sqlite+aiosqlite:///{tmp_path / 'queue.db'}"
    engine = create_async_engine(db_url, echo=False)
    sessionmaker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        from backend.models import content as _content  # noqa: F401
        from backend.models import persona as _persona  # noqa: F401

        await conn.run_sync(Base.metadata.create_all)

    job_id = str(uuid.uuid4())
    async with sessionmaker() as session:
        session.add(Job(id=job_id, status="PENDING"))
        await session.commit()

    with caplog.at_level(logging.INFO, logger="backend.core.queue"):
        async with sessionmaker() as session:
            job = (await session.execute(select(Job).where(Job.id == job_id))).scalar_one()
            await queue_manager.transition(session, job, StageEnum.SIMULATION)

    async with sessionmaker() as session:
        job = (await session.execute(select(Job).where(Job.id == job_id))).scalar_one()
    assert job.stage == "simulation"
    assert any("simulation" in record.message for record in caplog.records)

    await engine.dispose()
