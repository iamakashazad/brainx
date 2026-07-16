from __future__ import annotations

import asyncio

import pytest
from sqlalchemy import select

from backend.core import database, queue as queue_manager
from backend.models.job import Job

pytestmark = pytest.mark.asyncio


async def _job_count() -> int:
    async with database.async_session() as session:
        result = await session.execute(select(Job))
        return len(result.scalars().all())


async def _filled_queue(size: int) -> asyncio.Queue[str]:
    test_queue: asyncio.Queue[str] = asyncio.Queue()
    for index in range(size):
        await test_queue.put(f"sentinel-{index}")
    return test_queue


async def test_analyze_returns_503_when_queue_full(
    client,
    monkeypatch,
    persona_fixture,
    text_content_fixture,
):
    monkeypatch.setattr(queue_manager, "gpu_queue", await _filled_queue(3))

    response = await client.post(
        "/analyze",
        json={"persona_id": persona_fixture, "content_id": text_content_fixture},
    )

    assert response.status_code == 503
    assert response.json() == {
        "detail": "The analysis queue is full. Please try again in a moment."
    }


async def test_analyze_does_not_create_job_row_on_503(
    client,
    monkeypatch,
    persona_fixture,
    text_content_fixture,
):
    monkeypatch.setattr(queue_manager, "gpu_queue", await _filled_queue(3))
    before = await _job_count()

    response = await client.post(
        "/analyze",
        json={"persona_id": persona_fixture, "content_id": text_content_fixture},
    )

    assert response.status_code == 503
    assert await _job_count() == before


async def test_analyze_succeeds_when_queue_below_threshold(
    client,
    monkeypatch,
    persona_fixture,
    text_content_fixture,
):
    monkeypatch.setattr(queue_manager, "gpu_queue", await _filled_queue(2))

    response = await client.post(
        "/analyze",
        json={"persona_id": persona_fixture, "content_id": text_content_fixture},
    )

    assert response.status_code == 201


async def test_analyze_uses_201_not_200_when_queue_empty(
    client,
    monkeypatch,
    persona_fixture,
    text_content_fixture,
):
    monkeypatch.setattr(queue_manager, "gpu_queue", await _filled_queue(0))

    response = await client.post(
        "/analyze",
        json={"persona_id": persona_fixture, "content_id": text_content_fixture},
    )

    assert response.status_code == 201

