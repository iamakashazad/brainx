from __future__ import annotations

import asyncio

import pytest

from backend.core.config import settings
from backend.models.simulation import DeepSeekClientError

pytestmark = pytest.mark.asyncio


async def test_analyze_returns_422_when_deepseek_key_missing(
    client,
    monkeypatch,
    persona_fixture,
    text_content_fixture,
):
    monkeypatch.setattr(settings, "deepseek_api_key", "")

    response = await client.post(
        "/analyze",
        json={"persona_id": persona_fixture, "content_id": text_content_fixture},
    )

    assert response.status_code == 422
    assert "DEEPSEEK_API_KEY" in response.json()["detail"]


async def test_analyze_text_content_ignores_missing_replicate_token(
    client,
    monkeypatch,
    persona_fixture,
    text_content_fixture,
):
    monkeypatch.setattr(settings, "replicate_api_token", "")

    response = await client.post(
        "/analyze",
        json={"persona_id": persona_fixture, "content_id": text_content_fixture},
    )

    assert response.status_code == 201


async def test_analyze_image_content_returns_422_without_replicate_token(
    client,
    monkeypatch,
    persona_fixture,
    ui_screens_fixture,
):
    monkeypatch.setattr(settings, "replicate_api_token", "")

    response = await client.post(
        "/analyze",
        json={"persona_id": persona_fixture, "content_id": ui_screens_fixture},
    )

    assert response.status_code == 422
    assert "REPLICATE_API_TOKEN" in response.json()["detail"]


async def test_model_status_lists_missing_keys(client, monkeypatch):
    monkeypatch.setattr(settings, "deepseek_api_key", "")
    monkeypatch.setattr(settings, "replicate_api_token", "")

    response = await client.get("/model-status")

    assert response.status_code == 200
    assert response.json()["missing_keys"] == ["DEEPSEEK_API_KEY", "REPLICATE_API_TOKEN"]


async def test_model_status_reports_no_missing_keys_when_configured(client):
    response = await client.get("/model-status")

    assert response.status_code == 200
    assert response.json()["missing_keys"] == []


async def test_failed_job_preserves_stage_and_real_error(
    client,
    monkeypatch,
    persona_fixture,
    text_content_fixture,
):
    async def failing_simulate(*_args, **_kwargs):
        raise DeepSeekClientError("DeepSeek request failed (HTTP 401). Please retry.")

    monkeypatch.setattr("backend.core.queue.simulation.simulate", failing_simulate)

    response = await client.post(
        "/analyze",
        json={"persona_id": persona_fixture, "content_id": text_content_fixture},
    )
    assert response.status_code == 201
    job_id = response.json()["job_id"]

    body = None
    for _ in range(50):
        poll = await client.get(f"/jobs/{job_id}")
        body = poll.json()
        if body["status"] == "ERROR":
            break
        await asyncio.sleep(0.1)

    assert body is not None
    assert body["status"] == "ERROR"
    assert body["stage"] == "simulation"
    assert "HTTP 401" in body["error"]
