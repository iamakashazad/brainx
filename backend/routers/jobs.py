from __future__ import annotations

import datetime as dt
import uuid

from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import select

from backend.core import database, queue as queue_manager
from backend.core.config import settings
from backend.models.job import Job
from backend.models.schemas import (
    JobStatusResponse,
    JobSummary,
    TestInferenceRequest,
    TestInferenceResponse,
)
from backend.services.process_guard import workspace_whisperx_count

router = APIRouter()


def _utcnow() -> dt.datetime:
    return dt.datetime.utcnow()


def _should_mark_stale_active(job: Job, now: dt.datetime) -> bool:
    # Only PENDING jobs go stale here: a pending job past the timeout means the
    # worker never picked it up. RUNNING jobs are owned by the worker's own
    # asyncio.wait_for timeout — long CPU inference must not be killed by polling.
    if job.status != "PENDING":
        return False

    last_progress = job.updated_at or job.created_at
    if last_progress is None:
        return False

    stale_after = settings.job_timeout_seconds + 30
    return (now - last_progress).total_seconds() > stale_after


def _mark_stale_active_job(job: Job) -> None:
    job.status = "ERROR"
    job.stage = None
    job.queue_position = None
    job.error_message = (
        f"Analysis timed out after no progress for {settings.job_timeout_seconds} seconds. "
        "The worker may have stopped or the content may be too large."
    )


def _runtime_seconds(job: Job, now: dt.datetime) -> int | None:
    if job.created_at is None:
        return None
    return max(0, int((now - job.created_at).total_seconds()))


def _status_message(job: Job, runtime_seconds: int | None, stale_processes: int) -> str | None:
    if job.status not in {"PENDING", "RUNNING"}:
        return None
    if stale_processes > 0:
        return (
            f"{stale_processes} stale inference process(es) are still running and may slow this job."
        )
    if job.stage == "inference" and runtime_seconds is not None and runtime_seconds >= 120:
        return "Inference is active on CPU. This can take several minutes for TRIBEv2."
    return None


@router.post("/test-inference", response_model=TestInferenceResponse)
async def submit_test_inference(request: TestInferenceRequest) -> TestInferenceResponse:
    async with queue_manager.queue_capacity_lock:
        if queue_manager.gpu_queue.qsize() >= queue_manager.QUEUE_DEPTH_LIMIT:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="The analysis queue is full. Please try again in a moment.",
            )

        job = Job(
            id=str(uuid.uuid4()),
            status="PENDING",
            queue_position=queue_manager.gpu_queue.qsize() + 1,
            input_path=request.text,
            input_type=request.input_type,
        )

        async with database.async_session() as session:
            session.add(job)
            await session.commit()

        await queue_manager.gpu_queue.put(job.id)

    await queue_manager.sync_pending_queue_positions()

    return TestInferenceResponse(
        job_id=job.id,
        status="PENDING",
        message=f"Job queued at position {queue_manager.gpu_queue.qsize()}",
    )


@router.get("/jobs/{job_id}", response_model=JobStatusResponse)
async def get_job_status(job_id: str) -> JobStatusResponse:
    now = _utcnow()
    async with database.async_session() as session:
        result = await session.execute(select(Job).where(Job.id == job_id))
        job = result.scalar_one_or_none()

        if job is not None and _should_mark_stale_active(job, now):
            _mark_stale_active_job(job)
            await session.commit()

    if job is None:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    inference_processes = workspace_whisperx_count() if job.stage == "inference" else 0
    stale_inference_processes = max(0, inference_processes - 2)
    runtime_seconds = _runtime_seconds(job, now)

    return JobStatusResponse(
        job_id=job.id,
        status=job.status,
        persona_id=job.persona_id,
        queue_position=job.queue_position,
        stage=job.stage,
        result=job.result_json,
        error=job.error_message,
        created_at=job.created_at.isoformat() if job.created_at else None,
        updated_at=job.updated_at.isoformat() if job.updated_at else None,
        runtime_seconds=runtime_seconds,
        inference_processes=inference_processes,
        stale_inference_processes=stale_inference_processes,
        status_message=_status_message(job, runtime_seconds, stale_inference_processes),
    )


@router.delete("/jobs/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job(job_id: str) -> Response:
    deleted = await queue_manager.cancel_and_delete_job(job_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/jobs", response_model=list[JobSummary])
async def list_jobs() -> list[JobSummary]:
    async with database.async_session() as session:
        result = await session.execute(
            select(Job)
            .where(Job.persona_id.isnot(None))
            .where(Job.content_id.isnot(None))
            .order_by(Job.created_at.desc())
            .limit(50)
        )
        jobs = result.scalars().all()

    return [
        JobSummary(
            job_id=job.id,
            status=job.status,
            persona_id=job.persona_id,
            created_at=job.created_at.isoformat() if job.created_at else None,
        )
        for job in jobs
    ]
