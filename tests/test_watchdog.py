from __future__ import annotations

import asyncio
import datetime as dt
from contextlib import suppress

import pytest
from sqlalchemy import select

from backend.core import database, queue as queue_manager
from backend.core.config import settings
from backend.models.job import Job

pytestmark = pytest.mark.asyncio


async def _insert_job(job_id: str) -> None:
    async with database.async_session() as session:
        session.add(Job(id=job_id, status="PENDING", queue_position=1))
        await session.commit()


async def _insert_running_job(job_id: str, updated_at: dt.datetime) -> None:
    async with database.async_session() as session:
        session.add(
            Job(
                id=job_id,
                status="RUNNING",
                stage="inference",
                queue_position=None,
                updated_at=updated_at,
                created_at=updated_at,
            )
        )
        await session.commit()


async def _insert_pending_job(job_id: str, updated_at: dt.datetime) -> None:
    async with database.async_session() as session:
        session.add(
            Job(
                id=job_id,
                status="PENDING",
                queue_position=1,
                updated_at=updated_at,
                created_at=updated_at,
            )
        )
        await session.commit()


async def _get_job(job_id: str) -> Job:
    async with database.async_session() as session:
        return (await session.execute(select(Job).where(Job.id == job_id))).scalar_one()


async def _run_worker_until_cancelled() -> asyncio.Task[None]:
    return asyncio.create_task(queue_manager.gpu_worker_loop())


async def test_watchdog_marks_job_error_on_timeout(client, monkeypatch):
    test_queue: asyncio.Queue[str] = asyncio.Queue()
    monkeypatch.setattr(queue_manager, "gpu_queue", test_queue)

    async def slow_process_job(_job_id: str) -> None:
        await asyncio.sleep(5)

    monkeypatch.setattr(settings, "job_timeout_seconds", 1)
    monkeypatch.setattr(queue_manager, "_process_job", slow_process_job)

    await _insert_job("timeout-job")
    worker_task = await _run_worker_until_cancelled()
    await test_queue.put("timeout-job")
    await asyncio.sleep(1.4)

    worker_task.cancel()
    with suppress(asyncio.CancelledError):
        await worker_task

    job = await _get_job("timeout-job")
    assert job.status == "ERROR"
    assert job.error_message is not None
    assert "timed out" in job.error_message.lower()
    assert "1" in job.error_message


async def test_watchdog_does_not_block_subsequent_jobs(client, monkeypatch):
    test_queue: asyncio.Queue[str] = asyncio.Queue()
    monkeypatch.setattr(queue_manager, "gpu_queue", test_queue)

    async def slow_process_job(_job_id: str) -> None:
        await asyncio.sleep(5)

    monkeypatch.setattr(settings, "job_timeout_seconds", 1)
    monkeypatch.setattr(queue_manager, "_process_job", slow_process_job)

    await _insert_job("timeout-job-1")
    await _insert_job("timeout-job-2")
    worker_task = await _run_worker_until_cancelled()
    await test_queue.put("timeout-job-1")
    await test_queue.put("timeout-job-2")
    await asyncio.sleep(2.6)

    worker_task.cancel()
    with suppress(asyncio.CancelledError):
        await worker_task

    first = await _get_job("timeout-job-1")
    second = await _get_job("timeout-job-2")
    assert first.status == "ERROR"
    assert second.status == "ERROR"


async def test_watchdog_uses_status_ERROR_not_FAILED(client, monkeypatch):
    test_queue: asyncio.Queue[str] = asyncio.Queue()
    monkeypatch.setattr(queue_manager, "gpu_queue", test_queue)

    async def slow_process_job(_job_id: str) -> None:
        await asyncio.sleep(5)

    monkeypatch.setattr(settings, "job_timeout_seconds", 1)
    monkeypatch.setattr(queue_manager, "_process_job", slow_process_job)

    await _insert_job("status-job")
    worker_task = await _run_worker_until_cancelled()
    await test_queue.put("status-job")
    await asyncio.sleep(1.4)

    worker_task.cancel()
    with suppress(asyncio.CancelledError):
        await worker_task

    job = await _get_job("status-job")
    assert job.status == "ERROR"
    assert job.status != "FAILED"


async def test_watchdog_default_timeout_is_3600(client):
    assert settings.job_timeout_seconds == 3600


async def test_status_poll_does_not_mark_stale_running_job_error(client, monkeypatch):
    monkeypatch.setattr(settings, "job_timeout_seconds", 1)
    stale_time = dt.datetime.utcnow() - dt.timedelta(seconds=40)
    await _insert_running_job("stale-running-job", stale_time)

    response = await client.get("/jobs/stale-running-job")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "RUNNING"
    assert body["stage"] == "inference"
    assert body["queue_position"] is None
    assert body["error"] is None


async def test_status_poll_marks_stale_pending_job_error(client, monkeypatch):
    monkeypatch.setattr(settings, "job_timeout_seconds", 1)
    stale_time = dt.datetime.utcnow() - dt.timedelta(seconds=40)
    await _insert_pending_job("stale-pending-job", stale_time)

    response = await client.get("/jobs/stale-pending-job")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ERROR"
    assert body["stage"] is None
    assert body["queue_position"] is None
    assert "timed out" in body["error"].lower()


async def test_startup_recovery_marks_interrupted_active_jobs_error(client):
    await _insert_pending_job("interrupted-pending", dt.datetime.utcnow())
    await _insert_running_job("interrupted-running", dt.datetime.utcnow())

    count = await queue_manager.mark_interrupted_jobs()

    assert count == 2
    pending = await _get_job("interrupted-pending")
    running = await _get_job("interrupted-running")
    assert pending.status == "ERROR"
    assert running.status == "ERROR"
    assert pending.queue_position is None
    assert running.stage is None
    assert "interrupted" in (pending.error_message or "").lower()
