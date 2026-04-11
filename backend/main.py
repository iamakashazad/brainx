from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.core.config import settings
from backend.core.database import init_db
from backend.core import queue as queue_manager
from backend.ml.tribe_loader import load_model
from backend.routers import health, jobs


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()

    try:
        app.state.tribe_model = await load_model(settings.model_cache_path, settings.device)
    except Exception as exc:
        raise RuntimeError(f"TRIBEv2 failed to load: {exc}") from exc

    worker_task = asyncio.create_task(queue_manager.gpu_worker_loop())
    app.state.worker_task = worker_task

    try:
        yield
    finally:
        worker_task.cancel()
        with suppress(asyncio.CancelledError):
            await worker_task


def create_app() -> FastAPI:
    app = FastAPI(title="BrainX", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://localhost:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health.router, tags=["health"])
    app.include_router(jobs.router, tags=["jobs"])
    return app


app = create_app()
