from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.core.config import settings
from backend.core.database import init_db
from backend.core import queue as queue_manager
from backend.ml.tribe_loader import load_model
from backend.routers import activations, analyze, content, health, jobs, personas
from backend.services.inference import recycle_gpu_executor
from backend.services.process_guard import cleanup_workspace_whisperx_processes


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    cleanup_workspace_whisperx_processes()
    interrupted_count = await queue_manager.mark_interrupted_jobs()
    if interrupted_count:
        await queue_manager.sync_pending_queue_positions()

    try:
        app.state.tribe_model = await load_model(settings.model_cache_path, settings.device)
    except Exception as exc:
        raise RuntimeError(f"TRIBEv2 failed to load: {exc}") from exc

    worker_task = asyncio.create_task(queue_manager.supervised_worker_loop())
    app.state.worker_task = worker_task

    try:
        yield
    finally:
        worker_task.cancel()
        with suppress(asyncio.CancelledError):
            await worker_task
        # Recycle rather than shutdown: leaves a fresh usable executor so
        # repeated app lifecycles (tests, dev reload) don't inherit a dead one.
        recycle_gpu_executor()


def create_app() -> FastAPI:
    app = FastAPI(title="BrainX", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:4173",
            "http://127.0.0.1:4173",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health.router, tags=["health"])
    app.include_router(jobs.router, tags=["jobs"])
    app.include_router(activations.router, tags=["activations"])
    app.include_router(personas.router, prefix="/personas", tags=["personas"])
    app.include_router(content.router, prefix="/content", tags=["content"])
    app.include_router(analyze.router, prefix="/analyze", tags=["analyze"])
    return app


app = create_app()
