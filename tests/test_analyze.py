from __future__ import annotations

import asyncio
import json
import time
from unittest.mock import AsyncMock, patch

import httpx
import pytest
import respx
from sqlalchemy import select

from backend.core import database
from backend.models.job import Job

pytestmark = pytest.mark.asyncio

VALID_SIM_JSON = json.dumps(
    {
        "screens": [
            {
                "screen_index": 0,
                "narrative_text": "user reads ad",
                "summary_emotional_state": "engaged",
                "memorability_hypothesis": "high",
                "events": [
                    {
                        "timestamp_ms": 100,
                        "type": "fixation",
                        "target_region": {
                            "x_ratio": 0.5,
                            "y_ratio": 0.2,
                            "width_ratio": 0.3,
                            "height_ratio": 0.1,
                        },
                        "intensity": 0.7,
                        "note": "headline",
                    }
                ],
            }
        ]
    }
)
INVALID_SIM_JSON = '{"screens":"not a list"}'
BAD_JUDGE = json.dumps(
    {
        "hallucinations": [
            {"screen_index": 0, "narrative_claim": "Submit", "reason": "absent"}
        ],
        "verified_elements": [],
    }
)


async def _wait_for_terminal(client, job_id: str, max_iters: int = 60):
    body = {}
    for _ in range(max_iters):
        response = await client.get(f"/jobs/{job_id}")
        body = response.json()
        if body["status"] in {"DONE", "ERROR"}:
            return body
        await asyncio.sleep(0.05)
    raise AssertionError(f"job {job_id} did not complete: {body}")


async def test_happy_path(client, persona_fixture, text_content_fixture, monkeypatch):
    from backend.core.config import settings

    monkeypatch.setattr(settings, "deepseek_api_key", "deepseek-test")
    with respx.mock(assert_all_called=False) as router:
        router.post("https://api.deepseek.com/chat/completions").mock(
            return_value=httpx.Response(200, json={"choices": [{"message": {"content": VALID_SIM_JSON}}]})
        )
        start = time.perf_counter()
        response = await client.post(
            "/analyze",
            json={"persona_id": persona_fixture, "content_id": text_content_fixture},
        )
        elapsed = time.perf_counter() - start
        assert response.status_code == 201, response.text
        assert elapsed < 0.1
        payload = response.json()
        assert payload["status"] == "PENDING"

        async with database.async_session() as session:
            job = (await session.execute(select(Job).where(Job.id == payload["job_id"]))).scalar_one()
        assert job.persona_id == persona_fixture
        assert job.content_id == text_content_fixture

        final = await _wait_for_terminal(client, payload["job_id"])

    assert final["status"] == "DONE", final
    assert final["result"]["simulation"]["screens"][0]["narrative_text"] == "user reads ad"


async def test_bad_persona(client, text_content_fixture):
    response = await client.post(
        "/analyze",
        json={"persona_id": "missing", "content_id": text_content_fixture},
    )
    assert response.status_code == 404


async def test_bad_content(client, persona_fixture):
    response = await client.post(
        "/analyze",
        json={"persona_id": persona_fixture, "content_id": "missing"},
    )
    assert response.status_code == 404


async def test_stage_transitions(client, persona_fixture, text_content_fixture, monkeypatch):
    from backend.core.config import settings
    from backend.services import simulation as simulation_service

    monkeypatch.setattr(settings, "deepseek_api_key", "deepseek-test")
    original_simulate = simulation_service.simulate

    async def slow_text_inference(_text: str):
        await asyncio.sleep(0.05)
        return __import__("numpy").ones((2, 8))

    async def slow_simulate(persona, content):
        await asyncio.sleep(0.05)
        return await original_simulate(persona, content)

    monkeypatch.setattr("backend.core.queue.run_tribev2_text", slow_text_inference)
    monkeypatch.setattr("backend.core.queue.simulation.simulate", slow_simulate)
    seen_stages: set[str] = set()

    with respx.mock(assert_all_called=False) as router:
        router.post("https://api.deepseek.com/chat/completions").mock(
            return_value=httpx.Response(200, json={"choices": [{"message": {"content": VALID_SIM_JSON}}]})
        )
        response = await client.post(
            "/analyze",
            json={"persona_id": persona_fixture, "content_id": text_content_fixture},
        )
        job_id = response.json()["job_id"]
        for _ in range(120):
            poll = await client.get(f"/jobs/{job_id}")
            body = poll.json()
            if body.get("stage"):
                seen_stages.add(body["stage"])
            if body["status"] in {"DONE", "ERROR"}:
                final = body
                break
            await asyncio.sleep(0.02)
        else:
            raise AssertionError("job did not complete")

    assert final["status"] == "DONE", final
    assert "simulation" in seen_stages
    assert any(stage in seen_stages for stage in {"inference", "processing"})


async def test_failure_policy_simulation_retry(client, persona_fixture, text_content_fixture, monkeypatch):
    from backend.core.config import settings

    monkeypatch.setattr(settings, "deepseek_api_key", "deepseek-test")
    call_count = {"count": 0}

    def responder(_request: httpx.Request) -> httpx.Response:
        call_count["count"] += 1
        body = INVALID_SIM_JSON if call_count["count"] == 1 else VALID_SIM_JSON
        return httpx.Response(200, json={"choices": [{"message": {"content": body}}]})

    with respx.mock(assert_all_called=False) as router:
        router.post("https://api.deepseek.com/chat/completions").mock(side_effect=responder)
        response = await client.post(
            "/analyze",
            json={"persona_id": persona_fixture, "content_id": text_content_fixture},
        )
        final = await _wait_for_terminal(client, response.json()["job_id"])

    assert final["status"] == "DONE", final
    assert call_count["count"] == 2


async def test_failure_policy_grounding_no_retry(client, persona_fixture, ui_screens_fixture):
    responses = [json.loads(VALID_SIM_JSON), json.loads(BAD_JUDGE)]

    async def fake_analyze(**_kwargs):
        return responses.pop(0)

    with patch("backend.services.simulation.get_provider") as simulation_provider, patch(
        "backend.services.grounding.get_provider"
    ) as grounding_provider:
        fake_provider = AsyncMock()
        fake_provider.analyze.side_effect = fake_analyze
        simulation_provider.return_value = fake_provider
        grounding_provider.return_value = fake_provider

        response = await client.post(
            "/analyze",
            json={"persona_id": persona_fixture, "content_id": ui_screens_fixture},
        )
        final = await _wait_for_terminal(client, response.json()["job_id"])

    assert final["status"] == "ERROR"
    assert "Narrative references" in final["error"]
    assert fake_provider.analyze.await_count == 2


async def test_failure_policy_processing_fail_hard(
    client, persona_fixture, text_content_fixture, monkeypatch
):
    from backend.core.config import settings

    monkeypatch.setattr(settings, "deepseek_api_key", "deepseek-test")

    def boom(*_args, **_kwargs):
        raise RuntimeError("processing exploded")

    monkeypatch.setattr("backend.core.queue.derive_overlays", boom)

    with respx.mock(assert_all_called=False) as router:
        router.post("https://api.deepseek.com/chat/completions").mock(
            return_value=httpx.Response(200, json={"choices": [{"message": {"content": VALID_SIM_JSON}}]})
        )
        response = await client.post(
            "/analyze",
            json={"persona_id": persona_fixture, "content_id": text_content_fixture},
        )
        final = await _wait_for_terminal(client, response.json()["job_id"])

    assert final["status"] == "ERROR"
    assert "processing exploded" in final["error"]
