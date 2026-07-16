from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from backend.core import database, queue as queue_manager
from backend.models.content import Content
from backend.models.job import Job
from backend.models.persona import Persona
from backend.models.schemas import AnalyzeRequest, AnalyzeResponse

router = APIRouter()
QUEUE_DEPTH_LIMIT = 3


@router.post("", response_model=AnalyzeResponse, status_code=status.HTTP_201_CREATED)
async def submit_analyze(payload: AnalyzeRequest) -> AnalyzeResponse:
    async with database.async_session() as session:
        persona = (
            await session.execute(select(Persona).where(Persona.id == payload.persona_id))
        ).scalar_one_or_none()
        if persona is None:
            raise HTTPException(status_code=404, detail=f"Persona {payload.persona_id} not found")

        content = (
            await session.execute(select(Content).where(Content.id == payload.content_id))
        ).scalar_one_or_none()
        if content is None:
            raise HTTPException(status_code=404, detail=f"Content {payload.content_id} not found")

        async with queue_manager.queue_capacity_lock:
            if queue_manager.gpu_queue.qsize() >= QUEUE_DEPTH_LIMIT:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="The analysis queue is full. Please try again in a moment.",
                )

            job = Job(
                id=str(uuid.uuid4()),
                status="PENDING",
                queue_position=queue_manager.gpu_queue.qsize() + 1,
                persona_id=payload.persona_id,
                content_id=payload.content_id,
            )
            session.add(job)
            await session.commit()
            await queue_manager.gpu_queue.put(job.id)

    await queue_manager.sync_pending_queue_positions()
    return AnalyzeResponse(job_id=job.id, status="PENDING")
