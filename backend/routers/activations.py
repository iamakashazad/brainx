from __future__ import annotations

import asyncio
from pathlib import Path

import numpy as np
from fastapi import APIRouter, HTTPException, Response
from pydantic import ValidationError
from sqlalchemy import select

from backend.core import database
from backend.models.job import Job
from backend.models.results import AnalysisResult

router = APIRouter()

VERTEX_COUNT = 20484


@router.get("/jobs/{job_id}/activations/{screen_index}")
async def get_screen_activation(job_id: str, screen_index: int) -> Response:
    async with database.async_session() as session:
        result = await session.execute(select(Job).where(Job.id == job_id))
        job = result.scalar_one_or_none()

    if job is None or job.status != "DONE" or job.result_json is None:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found or not complete")

    try:
        envelope = AnalysisResult.model_validate(job.result_json)
    except ValidationError as exc:
        # Legacy /test-inference jobs and pre-schema envelopes have no per-screen
        # manifest; that is "no such activation", not a server error.
        raise HTTPException(
            status_code=404,
            detail=f"Job {job_id} has no per-screen activations (result predates the current schema)",
        ) from exc
    manifest_entry = next(
        (entry for entry in envelope.activations if entry.screen_index == screen_index),
        None,
    )
    if manifest_entry is None:
        raise HTTPException(status_code=404, detail=f"Screen {screen_index} not found in job {job_id}")

    activation_path = Path(manifest_entry.path)
    if not activation_path.is_absolute():
        activation_path = Path.cwd() / activation_path
    if not activation_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Activation file missing on disk: {manifest_entry.path}",
        )

    activation = await asyncio.to_thread(np.load, activation_path, allow_pickle=False)
    if activation.ndim != 2 or activation.shape[1] != VERTEX_COUNT:
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected activation shape {activation.shape} - expected (T, {VERTEX_COUNT})",
        )

    time_mean = activation.mean(axis=0).astype(np.float32)

    return Response(
        content=time_mean.tobytes(order="C"),
        media_type="application/octet-stream",
        headers={
            "X-Vertex-Count": str(VERTEX_COUNT),
            "X-Shape": str(VERTEX_COUNT),
            "Cache-Control": "public, max-age=300",
        },
    )
