from __future__ import annotations

import asyncio
from pathlib import Path

import numpy as np
from sqlalchemy import select

from backend.core import database
from backend.models.job import Job
from backend.services.inference import run_tribev2_text, run_tribev2_video

gpu_queue: asyncio.Queue[str] = asyncio.Queue()


def _pending_job_ids() -> list[str]:
    return list(gpu_queue._queue)  # noqa: SLF001 - queue order is required for position tracking


async def sync_pending_queue_positions() -> None:
    pending_ids = _pending_job_ids()

    async with database.async_session() as session:
        result = await session.execute(select(Job).where(Job.status == "PENDING"))
        jobs = {job.id: job for job in result.scalars()}

        for job in jobs.values():
            job.queue_position = None

        for index, job_id in enumerate(pending_ids, start=1):
            job = jobs.get(job_id)
            if job is not None:
                job.queue_position = index

        await session.commit()


async def gpu_worker_loop() -> None:
    while True:
        job_id = await gpu_queue.get()
        try:
            await _process_job(job_id)
        finally:
            gpu_queue.task_done()


async def _process_job(job_id: str) -> None:
    async with database.async_session() as session:
        result = await session.execute(select(Job).where(Job.id == job_id))
        job = result.scalar_one_or_none()
        if job is None:
            return

        job.status = "RUNNING"
        job.stage = "inference"
        job.queue_position = None
        input_payload = job.input_path or ""
        input_type = job.input_type or "text"
        await session.commit()

    await sync_pending_queue_positions()

    last_error = "unknown error"
    for attempt in range(2):
        try:
            if input_type == "video":
                activation = await run_tribev2_video(input_payload)
            else:
                activation = await run_tribev2_text(input_payload)

            Path("activations").mkdir(exist_ok=True)
            output_path = Path("activations") / f"{job_id}.npy"
            np.save(output_path, activation)

            async with database.async_session() as session:
                result = await session.execute(select(Job).where(Job.id == job_id))
                job = result.scalar_one()
                job.status = "DONE"
                job.stage = None
                job.result_json = {
                    "activation_path": output_path.as_posix(),
                    "shape": list(activation.shape),
                }
                job.retry_count = attempt
                await session.commit()
            return
        except Exception as exc:
            last_error = str(exc)
            if attempt == 0:
                continue

    async with database.async_session() as session:
        result = await session.execute(select(Job).where(Job.id == job_id))
        job = result.scalar_one_or_none()
        if job is None:
            return
        job.status = "ERROR"
        job.stage = None
        job.error_message = f"GPU inference failed after 2 attempt(s): {last_error}"
        job.retry_count = 2
        await session.commit()
