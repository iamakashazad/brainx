from __future__ import annotations

import asyncio
import logging
import shutil
from pathlib import Path

import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core import database
from backend.core.config import settings
from backend.models.content import Content, ContentType
from backend.models.recommendations import Recommendations
from backend.models.results import AnalysisResult, SCHEMA_VERSION
from backend.models.job import Job, StageEnum
from backend.models.persona import Persona
from backend.models.simulation import DeepSeekClientError, HallucinationError, SchemaValidationFailure
from backend.services.continuity import compute_flow_continuity
from backend.services import grounding, simulation
from backend.services.recommendations import generate_recommendations
from backend.services.inference import run_tribev2_text, run_tribev2_video
from backend.services.overlay import derive_overlays
from backend.services.pathway_config import resolve_runtime_pathway
from backend.services.process_guard import cleanup_workspace_whisperx_processes
from backend.services.roi_aggregation import (
    aggregate_screen_roi,
    get_surf_atlas,
    rescale_to_0_100,
)
from backend.services.video_slideshow import (
    create_slideshow,
    derive_slideshow_durations,
    resolve_uploaded_image_paths,
    split_video_activation_by_screen,
)

logger = logging.getLogger(__name__)

gpu_queue: asyncio.Queue[str] = asyncio.Queue()
queue_capacity_lock = asyncio.Lock()
cancel_requested: set[str] = set()


def _pending_job_ids() -> list[str]:
    return list(gpu_queue._queue)  # noqa: SLF001 - queue order is required for position tracking


def _remove_pending_job(job_id: str) -> bool:
    pending = _pending_job_ids()
    if job_id not in pending:
        return False

    gpu_queue._queue.clear()  # noqa: SLF001 - queue order mutation is required for cancellation
    for pending_job_id in pending:
        if pending_job_id != job_id:
            gpu_queue._queue.append(pending_job_id)  # noqa: SLF001
    return True


def _job_artifact_dir(job_id: str) -> Path:
    return Path("activations") / job_id


def _delete_job_artifacts(job_id: str) -> None:
    artifact_dir = _job_artifact_dir(job_id)
    if artifact_dir.exists():
        shutil.rmtree(artifact_dir, ignore_errors=True)


async def cancel_and_delete_job(job_id: str) -> bool:
    """Best-effort one-way cancellation.

    Pending jobs are removed from the in-memory queue immediately. Running jobs
    cannot safely kill a Python executor thread, but killing workspace WhisperX
    subprocesses interrupts the expensive child-process portion and deleting the
    DB row makes the worker abandon any later writes.
    """
    cancel_requested.add(job_id)

    async with queue_capacity_lock:
        _remove_pending_job(job_id)

        async with database.async_session() as session:
            job = (await session.execute(select(Job).where(Job.id == job_id))).scalar_one_or_none()
            if job is None:
                await sync_pending_queue_positions()
                return False
            should_cleanup_processes = job.status == "RUNNING"
            await session.delete(job)
            await session.commit()

        if should_cleanup_processes:
            cleanup_workspace_whisperx_processes()
        _delete_job_artifacts(job_id)
        await sync_pending_queue_positions()
        return True


def _is_cancelled(job_id: str) -> bool:
    return job_id in cancel_requested


async def _job_exists(job_id: str) -> bool:
    async with database.async_session() as session:
        job = (await session.execute(select(Job).where(Job.id == job_id))).scalar_one_or_none()
        return job is not None


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


async def mark_interrupted_jobs() -> int:
    """Fail jobs that cannot resume because the in-memory worker queue restarted."""
    async with database.async_session() as session:
        result = await session.execute(
            select(Job).where(Job.status.in_(["PENDING", "RUNNING"]))
        )
        jobs = result.scalars().all()

        for job in jobs:
            job.status = "ERROR"
            job.stage = None
            job.queue_position = None
            job.error_message = (
                "Analysis was interrupted before it finished. "
                "Please start a new analysis."
            )

        await session.commit()
        return len(jobs)


async def transition(session: AsyncSession, job: Job, stage: StageEnum | None) -> None:
    job.stage = stage.value if stage is not None else None
    logger.info("job %s -> %s", job.id, job.stage)
    await session.commit()


def _validate_screen_narrative(screen_index: int, narrative: str) -> None:
    if not narrative.strip():
        raise RuntimeError(f"Empty or whitespace-only narrative on screen {screen_index}")


def _workspace_relative_path(path: Path | str) -> str:
    artifact_path = Path(path)
    if artifact_path.is_absolute():
        try:
            return artifact_path.relative_to(Path.cwd()).as_posix()
        except ValueError as exc:
            raise RuntimeError(
                f"Artifact path must stay workspace-relative, got {artifact_path.as_posix()}"
            ) from exc
    return artifact_path.as_posix()


def _save_per_screen_activations(
    job_act_dir: Path,
    screen_indices: list[int],
    per_screen_arrays: list[np.ndarray],
) -> list[dict[str, str | int | list[int]]]:
    if len(screen_indices) != len(per_screen_arrays):
        raise RuntimeError(
            f"Expected {len(screen_indices)} per-screen activations, got {len(per_screen_arrays)}"
        )

    activations_manifest: list[dict[str, str | int | list[int]]] = []
    for screen_index, arr in zip(screen_indices, per_screen_arrays):
        out_path = job_act_dir / f"screen_{screen_index + 1}.npy"
        np.save(out_path, arr)
        activations_manifest.append(
            {
                "screen_index": screen_index,
                "path": _workspace_relative_path(out_path),
                "shape": list(arr.shape),
                "timesteps": int(arr.shape[0]),
            }
        )

    return activations_manifest


async def gpu_worker_loop() -> None:
    while True:
        job_id = await gpu_queue.get()
        try:
            if not _is_cancelled(job_id):
                await asyncio.wait_for(
                    _process_job(job_id),
                    timeout=settings.job_timeout_seconds,
                )
        except TimeoutError:
            logger.error("job %s timed out after %s seconds", job_id, settings.job_timeout_seconds)
            await _mark_timed_out(job_id, settings.job_timeout_seconds)
        finally:
            cancel_requested.discard(job_id)
            gpu_queue.task_done()


async def _mark_timed_out(job_id: str, timeout_seconds: int) -> None:
    async with database.async_session() as session:
        job = (await session.execute(select(Job).where(Job.id == job_id))).scalar_one_or_none()
        if job is None:
            return
        job.status = "ERROR"
        job.stage = None
        job.queue_position = None
        job.error_message = (
            f"Analysis timed out after {timeout_seconds} seconds. "
            "Please try again with shorter content."
        )
        await session.commit()


async def _process_job(job_id: str) -> None:
    if _is_cancelled(job_id):
        return

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
        if _is_cancelled(job_id):
            return
        async with database.async_session() as session:
            job = (await session.execute(select(Job).where(Job.id == job_id))).scalar_one()
            await transition(session, job, StageEnum.SIMULATION)
        sim_log = await simulation.simulate(persona, content)
        if _is_cancelled(job_id) or not await _job_exists(job_id):
            return

        async with database.async_session() as session:
            job = (await session.execute(select(Job).where(Job.id == job_id))).scalar_one()
            await transition(session, job, StageEnum.GROUNDING_CHECK)
        await grounding.judge(content, sim_log)
        if _is_cancelled(job_id) or not await _job_exists(job_id):
            return

        selected_pathway = resolve_runtime_pathway(content)
        async with database.async_session() as session:
            job = (await session.execute(select(Job).where(Job.id == job_id))).scalar_one()
            await transition(session, job, StageEnum.INFERENCE)
        cleanup_workspace_whisperx_processes()

        for screen in sim_log.screens:
            _validate_screen_narrative(screen.screen_index, screen.narrative_text)

        job_act_dir = Path("activations") / job_id
        job_act_dir.mkdir(parents=True, exist_ok=True)
        screen_indices = [screen.screen_index for screen in sim_log.screens]
        pathway_metadata: dict[str, str | list[float] | None] = {
            "selected_pathway": selected_pathway,
            "slideshow_path": None,
            "durations": [],
        }

        if selected_pathway == "video":
            image_paths = resolve_uploaded_image_paths(content)
            durations = derive_slideshow_durations(sim_log, content.content_type)
            if len(durations) != len(sim_log.screens):
                raise RuntimeError(
                    "Slideshow duration count must match simulated screen count; "
                    f"got {len(durations)} durations for {len(sim_log.screens)} screens"
                )
            if content.content_type == ContentType.UI_SCREENS.value and len(image_paths) != len(sim_log.screens):
                raise RuntimeError(
                    "Uploaded UI screen count must match simulated screen count; "
                    f"got {len(image_paths)} files for {len(sim_log.screens)} screens"
                )
            if content.content_type == ContentType.STATIC.value and len(image_paths) != 1:
                raise RuntimeError(
                    f"Static content must resolve to exactly one uploaded image, got {len(image_paths)}"
                )

            slideshow_path = job_act_dir / "fallback_slideshow.mp4"
            slideshow_artifact = create_slideshow(
                image_paths=image_paths,
                durations=durations,
                output_path=slideshow_path.as_posix(),
            )
            video_activation = await _run_video_inference_with_retry(slideshow_artifact)
            if _is_cancelled(job_id) or not await _job_exists(job_id):
                return
            per_screen_arrays = split_video_activation_by_screen(
                activation=video_activation,
                durations=durations,
                screen_count=len(sim_log.screens),
            )
            activations_manifest = _save_per_screen_activations(
                job_act_dir=job_act_dir,
                screen_indices=screen_indices,
                per_screen_arrays=per_screen_arrays,
            )
            pathway_metadata = {
                "selected_pathway": "video",
                "slideshow_path": _workspace_relative_path(slideshow_artifact),
                "durations": durations,
            }
        else:
            per_screen_arrays = []
            for screen in sim_log.screens:
                if _is_cancelled(job_id) or not await _job_exists(job_id):
                    return
                arr = await _run_screen_inference_with_retry(
                    screen.screen_index,
                    screen.narrative_text,
                )
                if _is_cancelled(job_id) or not await _job_exists(job_id):
                    return
                per_screen_arrays.append(arr)
            activations_manifest = _save_per_screen_activations(
                job_act_dir=job_act_dir,
                screen_indices=screen_indices,
                per_screen_arrays=per_screen_arrays,
            )

        async with database.async_session() as session:
            job = (await session.execute(select(Job).where(Job.id == job_id))).scalar_one()
            await transition(session, job, StageEnum.ROI_AGGREGATION)

        if per_screen_arrays:
            logger.info(
                "A1 probe: first-screen activation shape=%s (expected (T, 20484))",
                per_screen_arrays[0].shape,
            )
        atlas = get_surf_atlas()
        roi_per_screen_native: list[dict[str, object]] = []
        for screen, arr in zip(sim_log.screens, per_screen_arrays):
            bundle = aggregate_screen_roi(arr, atlas)
            roi_per_screen_native.append({"screen_index": screen.screen_index, **bundle})

        async with database.async_session() as session:
            job = (await session.execute(select(Job).where(Job.id == job_id))).scalar_one()
            await transition(session, job, StageEnum.PROCESSING)

        roi_per_screen_rescaled = rescale_to_0_100(
            [
                {
                    "circuits": native["circuits"],
                    "regions": native["regions"],
                }
                for native in roi_per_screen_native
            ]
        )
        roi_per_screen = [
            {"screen_index": native["screen_index"], **rescaled}
            for native, rescaled in zip(roi_per_screen_native, roi_per_screen_rescaled)
        ]
        overlays = derive_overlays(sim_log, content_type=content.content_type)
        flow_continuity = compute_flow_continuity(roi_per_screen)

        async with database.async_session() as session:
            job = (await session.execute(select(Job).where(Job.id == job_id))).scalar_one()
            await transition(session, job, StageEnum.RECOMMENDATIONS)

        recs_result: Recommendations = await generate_recommendations(
            persona=persona,
            sim_log=sim_log,
            roi_per_screen=roi_per_screen,
            flow_continuity=flow_continuity,
        )
        recommendations_dump: list[dict[str, object]] = [
            recommendation.model_dump() for recommendation in recs_result.recommendations
        ]
        envelope = AnalysisResult(
            schema_version=SCHEMA_VERSION,
            simulation=sim_log.model_dump(),
            overlays=[overlay.model_dump() for overlay in overlays],
            activations=activations_manifest,
            roi=roi_per_screen,
            flow_continuity=flow_continuity,
            recommendations=recommendations_dump,
            pathway=pathway_metadata,
        )

        async with database.async_session() as session:
            job = (await session.execute(select(Job).where(Job.id == job_id))).scalar_one()
            job.result_json = envelope.model_dump()
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
            message = str(exc)
            if "fsaverage5" in message or "vertex count" in message:
                message = f"A1 vertex-count invariant violated: {message}"
            job.error_message = message
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


async def _run_screen_inference_with_retry(screen_index: int, narrative: str) -> np.ndarray:
    last_error = "unknown error"
    for attempt in range(2):
        try:
            return await run_tribev2_text(narrative)
        except Exception as exc:
            last_error = str(exc)
            if attempt == 0:
                continue
            raise RuntimeError(
                f"Inference failed for screen {screen_index} after 2 attempts: {last_error}"
            ) from exc


async def _run_video_inference_with_retry(video_path: str) -> np.ndarray:
    last_error = "unknown error"
    for attempt in range(2):
        try:
            return await run_tribev2_video(video_path)
        except Exception as exc:
            last_error = str(exc)
            if attempt == 0:
                continue
            raise RuntimeError(f"Video inference failed after 2 attempts: {last_error}") from exc


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
