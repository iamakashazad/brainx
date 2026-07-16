from __future__ import annotations

import asyncio
import threading
from contextlib import suppress

import pytest
from sqlalchemy import select

from backend.core import database, queue as queue_manager
from backend.core.config import settings
from backend.models.job import Job
from backend.services import inference

pytestmark = pytest.mark.asyncio


async def _insert_job(job_id: str) -> None:
    async with database.async_session() as session:
        session.add(Job(id=job_id, status="PENDING", queue_position=1))
        await session.commit()


async def _get_job(job_id: str) -> Job:
    async with database.async_session() as session:
        return (await session.execute(select(Job).where(Job.id == job_id))).scalar_one()


async def _filled_queue(size: int) -> asyncio.Queue[str]:
    test_queue: asyncio.Queue[str] = asyncio.Queue()
    for index in range(size):
        await test_queue.put(f"sentinel-{index}")
    return test_queue


async def test_worker_survives_exception_and_marks_job_error(client, monkeypatch):
    test_queue: asyncio.Queue[str] = asyncio.Queue()
    monkeypatch.setattr(queue_manager, "gpu_queue", test_queue)

    processed: list[str] = []

    async def flaky_process_job(job_id: str) -> None:
        if job_id == "crash-job":
            raise RuntimeError("boom outside pipeline handler")
        processed.append(job_id)

    monkeypatch.setattr(queue_manager, "_process_job", flaky_process_job)

    await _insert_job("crash-job")
    await _insert_job("ok-job")

    worker_task = asyncio.create_task(queue_manager.gpu_worker_loop())
    await test_queue.put("crash-job")
    await test_queue.put("ok-job")
    await asyncio.sleep(0.5)

    worker_task.cancel()
    with suppress(asyncio.CancelledError):
        await worker_task

    crashed = await _get_job("crash-job")
    assert crashed.status == "ERROR"
    assert "boom outside pipeline handler" in (crashed.error_message or "")
    assert "ok-job" in processed


async def test_supervised_worker_loop_restarts_after_crash(monkeypatch):
    calls: list[int] = []

    async def flaky_loop() -> None:
        calls.append(1)
        if len(calls) == 1:
            raise RuntimeError("worker loop crash")
        await asyncio.sleep(30)

    monkeypatch.setattr(queue_manager, "gpu_worker_loop", flaky_loop)

    task = asyncio.create_task(queue_manager.supervised_worker_loop())
    await asyncio.sleep(1.3)

    task.cancel()
    with suppress(asyncio.CancelledError):
        await task

    assert len(calls) == 2


async def test_timeout_recycles_executor_so_next_job_runs(client, monkeypatch):
    test_queue: asyncio.Queue[str] = asyncio.Queue()
    monkeypatch.setattr(queue_manager, "gpu_queue", test_queue)
    monkeypatch.setattr(settings, "job_timeout_seconds", 1)

    block = threading.Event()
    processed: list[str] = []
    executor_before = inference.get_gpu_executor()

    async def executor_bound_job(job_id: str) -> None:
        loop = asyncio.get_running_loop()
        if job_id == "hang-job":
            await loop.run_in_executor(inference.get_gpu_executor(), block.wait)
        else:
            await loop.run_in_executor(
                inference.get_gpu_executor(), lambda: processed.append(job_id)
            )

    monkeypatch.setattr(queue_manager, "_process_job", executor_bound_job)

    await _insert_job("hang-job")
    await _insert_job("ok-job")

    # The lifespan worker is parked on the pre-monkeypatch queue, so this
    # worker is the sole consumer of test_queue and processes jobs serially.
    worker_task = asyncio.create_task(queue_manager.gpu_worker_loop())
    await test_queue.put("hang-job")
    await test_queue.put("ok-job")
    await asyncio.sleep(2.5)

    worker_task.cancel()
    with suppress(asyncio.CancelledError):
        await worker_task
    block.set()

    hung = await _get_job("hang-job")
    assert hung.status == "ERROR"
    assert "timed out" in (hung.error_message or "").lower()
    assert processed == ["ok-job"]
    assert inference.get_gpu_executor() is not executor_before


async def test_test_inference_returns_503_when_queue_full(client, monkeypatch):
    monkeypatch.setattr(queue_manager, "gpu_queue", await _filled_queue(3))

    response = await client.post("/test-inference", json={"text": "hello world"})

    assert response.status_code == 503
    assert response.json() == {
        "detail": "The analysis queue is full. Please try again in a moment."
    }


async def test_test_inference_succeeds_below_queue_limit(client, monkeypatch):
    monkeypatch.setattr(queue_manager, "gpu_queue", await _filled_queue(2))

    response = await client.post("/test-inference", json={"text": "hello world"})

    assert response.status_code == 200
    assert response.json()["status"] == "PENDING"
