from __future__ import annotations

import asyncio

import numpy as np
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from backend.core import database, queue as queue_manager
from backend.core.config import settings
from backend.main import create_app
from backend.models.job import Base


@pytest_asyncio.fixture
async def client(tmp_path, monkeypatch) -> AsyncClient:
    db_url = f"sqlite+aiosqlite:///{tmp_path / 'test.db'}"
    test_engine = create_async_engine(db_url, echo=False)
    test_session = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)

    monkeypatch.setattr(settings, "database_url", db_url)
    monkeypatch.setattr(database, "engine", test_engine)
    monkeypatch.setattr(database, "async_session", test_session)
    monkeypatch.setattr(queue_manager, "gpu_queue", asyncio.Queue())

    async def fake_load_model(*_args, **_kwargs):
        return object()

    async def fake_text_inference(_text: str) -> np.ndarray:
        return np.ones((2, 8))

    async def fake_video_inference(_path: str) -> np.ndarray:
        return np.zeros((2, 8))

    monkeypatch.setattr("backend.main.load_model", fake_load_model)
    monkeypatch.setattr(queue_manager, "run_tribev2_text", fake_text_inference)
    monkeypatch.setattr(queue_manager, "run_tribev2_video", fake_video_inference)

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    app = create_app()

    async with app.router.lifespan_context(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as http_client:
            yield http_client

    await test_engine.dispose()


@pytest.mark.asyncio
async def test_model_status(client: AsyncClient) -> None:
    response = await client.get("/model-status")

    assert response.status_code == 200
    assert response.json()["status"] == "ready"


@pytest.mark.asyncio
async def test_submit_and_poll_job(client: AsyncClient) -> None:
    submit = await client.post("/test-inference", json={"text": "hello world", "input_type": "text"})
    assert submit.status_code == 200

    payload = submit.json()
    job_id = payload["job_id"]

    for _ in range(10):
        status = await client.get(f"/jobs/{job_id}")
        assert status.status_code == 200
        if status.json()["status"] == "DONE":
            break
        await asyncio.sleep(0.05)
    else:
        raise AssertionError("job did not complete in time")

    final_payload = status.json()
    assert final_payload["result"]["shape"] == [2, 8]


@pytest.mark.asyncio
async def test_missing_job_returns_404(client: AsyncClient) -> None:
    response = await client.get("/jobs/does-not-exist")

    assert response.status_code == 404
