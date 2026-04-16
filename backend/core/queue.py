from __future__ import annotations

import asyncio
import logging
from pathlib import Path

import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core import database
from backend.models.content import Content
from backend.models.job import Job, StageEnum
from backend.models.persona import Persona
from backend.models.simulation import HallucinationError, SchemaValidationFailure
from backend.services import grounding, simulation
from backend.services.inference import run_tribev2_text, run_tribev2_video
from backend.services.overlay import derive_overlays

logger = logging.getLogger(__name__)

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


async def transition(session: AsyncSession, job: Job, stage: StageEnum | None) -> None:
    job.stage = stage.value if stage is not None else None
    logger.info("job %s -> %s", job.id, job.stage)
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
        job.queue_position = None
        input_payload = job.input_path or ""
        input_type = job.input_type or "text"
        persona: Persona | None = None
        content: Content | None = None
        if job.persona_id:
            persona = (
                await session.execute(select(Persona).where(Persona.id == job.persona_id))
            ).scalar_one_or_none()
        if job.content_id:
            content = (
                await session.execute(select(Content).where(Content.id == job.content_id))
            ).scalar_one_or_none()
        legacy_phase1 = persona is None and content is None
        await session.commit()

    await sync_pending_queue_positions()

    if legacy_phase1:
        await _run_inference_only(job_id, input_type, input_payload)
        return

    if persona is None or content is None:
        missing_links = []
        if persona is None:
            missing_links.append("persona")
        if content is None:
            missing_links.append("content")
        async with database.async_session() as session:
            job = (await session.execute(select(Job).where(Job.id == job_id))).scalar_one_or_none()
            if job is None:
                return
            job.status = "ERROR"
            job.error_message = (
                f"Analyze job references missing {' and '.join(missing_links)} record(s)"
            )
            await transition(session, job, None)
        return

    try:
        async with database.async_session() as session:
            job = (await session.execute(select(Job).where(Job.id == job_id))).scalar_one()
            await transition(session, job, StageEnum.SIMULATION)
        sim_log = await simulation.simulate(persona, content)

        async with database.async_session() as session:
            job = (await session.execute(select(Job).where(Job.id == job_id))).scalar_one()
            await transition(session, job, StageEnum.GROUNDING_CHECK)
        await grounding.judge(content, sim_log)

        async with database.async_session() as session:
            job = (await session.execute(select(Job).where(Job.id == job_id))).scalar_one()
            await transition(session, job, StageEnum.INFERENCE)
        narrative = "\n\n".join(screen.narrative_text for screen in sim_log.screens)
        activation = await _run_inference_with_retry(narrative)

        async with database.async_session() as session:
            job = (await session.execute(select(Job).where(Job.id == job_id))).scalar_one()
            await transition(session, job, StageEnum.PROCESSING)
        overlays = derive_overlays(sim_log, content_type=content.content_type)
        Path("activations").mkdir(exist_ok=True)
        output_path = Path("activations") / f"{job_id}.npy"
        np.save(output_path, activation)

        async with database.async_session() as session:
            job = (await session.execute(select(Job).where(Job.id == job_id))).scalar_one()
            job.result_json = {
                **(job.result_json or {}),
                "simulation": sim_log.model_dump(),
                "overlays": [overlay.model_dump() for overlay in overlays],
                "activation": {
                    "path": output_path.as_posix(),
                    "shape": list(activation.shape),
                },
            }
            job.status = "DONE"
            await transition(session, job, None)
        return
    except HallucinationError as exc:
        async with database.async_session() as session:
            job = (await session.execute(select(Job).where(Job.id == job_id))).scalar_one_or_none()
            if job is None:
                return
            job.status = "ERROR"
            job.error_message = str(exc)
            await transition(session, job, None)
        return
    except SchemaValidationFailure as exc:
        async with database.async_session() as session:
            job = (await session.execute(select(Job).where(Job.id == job_id))).scalar_one_or_none()
            if job is None:
                return
            job.status = "ERROR"
            job.error_message = f"Simulation schema validation failed: {exc}"
            await transition(session, job, None)
        return
    except Exception as exc:
        logger.error("job %s failed unexpectedly", job_id, exc_info=exc)
        async with database.async_session() as session:
            job = (await session.execute(select(Job).where(Job.id == job_id))).scalar_one_or_none()
            if job is None:
                return
            job.status = "ERROR"
            job.error_message = str(exc)
            await transition(session, job, None)
        return


async def _run_inference_with_retry(text_content: str) -> np.ndarray:
    last_error = "unknown error"
    for attempt in range(2):
        try:
            return await run_tribev2_text(text_content)
        except Exception as exc:
            last_error = str(exc)
            if attempt == 0:
                continue
            raise RuntimeError(f"Inference failed after 2 attempts: {last_error}") from exc


async def _run_inference_only(job_id: str, input_type: str, input_payload: str) -> None:
    async with database.async_session() as session:
        job = (await session.execute(select(Job).where(Job.id == job_id))).scalar_one_or_none()
        if job is None:
            return
        await transition(session, job, StageEnum.INFERENCE)

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
                job.result_json = {
                    "activation_path": output_path.as_posix(),
                    "shape": list(activation.shape),
                }
                job.retry_count = attempt
                await transition(session, job, None)
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
        job.error_message = f"GPU inference failed after 2 attempt(s): {last_error}"
        job.retry_count = 2
        await transition(session, job, None)
