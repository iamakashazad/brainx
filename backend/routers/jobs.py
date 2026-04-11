from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from backend.core import database, queue as queue_manager
from backend.models.job import Job
from backend.models.schemas import JobStatusResponse, TestInferenceRequest, TestInferenceResponse

router = APIRouter()


@router.post("/test-inference", response_model=TestInferenceResponse)
async def submit_test_inference(request: TestInferenceRequest) -> TestInferenceResponse:
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
    async with database.async_session() as session:
        result = await session.execute(select(Job).where(Job.id == job_id))
        job = result.scalar_one_or_none()

    if job is None:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    return JobStatusResponse(
        job_id=job.id,
        status=job.status,
        queue_position=job.queue_position,
        stage=job.stage,
        result=job.result_json,
        error=job.error_message,
        created_at=job.created_at.isoformat() if job.created_at else None,
    )
