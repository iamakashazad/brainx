from __future__ import annotations

import asyncio
import json

import httpx
import pytest
import respx

from backend.models.content import Content, ContentType
from backend.models.persona import Persona
from backend.models.simulation import SchemaValidationFailure, SimulationLog
from backend.services import simulation as simulation_service

pytestmark = pytest.mark.asyncio

VALID_JSON = json.dumps(
    {
        "screens": [
            {
                "screen_index": 0,
                "narrative_text": "user reads the offer",
                "summary_emotional_state": "engaged",
                "memorability_hypothesis": "high",
                "events": [],
            }
        ]
    }
)
INVALID_JSON = '{"screens":"not a list"}'


def _persona() -> Persona:
    persona = Persona()
    persona.id = "p1"
    persona.name = "Test Persona"
    persona.demographics = {"age": 30, "role": "user", "background": None}
    persona.psychographics = {"goals": [], "values": [], "motivations": []}
    persona.cognitive_state = {
        "attention_span": "medium",
        "stress_level": "low",
        "tech_literacy": "expert",
    }
    persona.environment = {"device": "desktop", "location": "office", "ambient": None}
    return persona


def _text_content(text: str = "hello") -> Content:
    content = Content()
    content.id = "c1"
    content.content_type = ContentType.TEXT.value
    content.content_text = text
    return content


def _static_content() -> Content:
    content = Content()
    content.id = "c2"
    content.content_type = ContentType.STATIC.value
    content.screen_count = 1
    return content


async def test_text_sim_happy(monkeypatch):
    from backend.core.config import settings

    monkeypatch.setattr(settings, "deepseek_api_key", "deepseek-test")
    with respx.mock(assert_all_called=False) as router:
        router.post("https://api.deepseek.com/chat/completions").mock(
            return_value=httpx.Response(200, json={"choices": [{"message": {"content": VALID_JSON}}]})
        )
        result = await simulation_service.simulate(_persona(), _text_content())

    assert isinstance(result, SimulationLog)
    assert result.screens[0].narrative_text == "user reads the offer"


async def test_repair_retry(monkeypatch):
    from backend.core.config import settings

    monkeypatch.setattr(settings, "deepseek_api_key", "deepseek-test")
    with respx.mock(assert_all_called=False) as router:
        route = router.post("https://api.deepseek.com/chat/completions")
        call_count = {"count": 0}

        def responder(request: httpx.Request) -> httpx.Response:
            call_count["count"] += 1
            payload = INVALID_JSON if call_count["count"] == 1 else VALID_JSON
            return httpx.Response(200, json={"choices": [{"message": {"content": payload}}]})

        route.mock(side_effect=responder)
        result = await simulation_service.simulate(_persona(), _text_content())

    assert call_count["count"] == 2
    assert isinstance(result, SimulationLog)
    second_request = json.loads(route.calls[-1].request.read().decode("utf-8"))
    assert "Previous attempt failed validation" in second_request["messages"][1]["content"]


async def test_repair_retry_exhausted(monkeypatch):
    from backend.core.config import settings

    monkeypatch.setattr(settings, "deepseek_api_key", "deepseek-test")
    with respx.mock(assert_all_called=False) as router:
        router.post("https://api.deepseek.com/chat/completions").mock(
            return_value=httpx.Response(200, json={"choices": [{"message": {"content": INVALID_JSON}}]})
        )
        with pytest.raises(SchemaValidationFailure):
            await simulation_service.simulate(_persona(), _text_content())


async def test_vl2_malformed_json_still_retries():
    prompts: list[str] = []

    class FakeProvider:
        async def analyze(self, **kwargs):
            prompts.append(kwargs["prompt"])
            if len(prompts) == 1:
                return '{"screens":'
            return VALID_JSON

    with pytest.MonkeyPatch.context() as monkeypatch:
        monkeypatch.setattr(simulation_service, "get_provider", lambda: FakeProvider())
        result = await simulation_service.simulate(_persona(), _static_content())

    assert isinstance(result, SimulationLog)
    assert len(prompts) == 2
    assert "Previous attempt failed validation" in prompts[1]


async def test_log_viewable(client, persona_fixture, text_content_fixture, monkeypatch):
    from backend.core.config import settings

    monkeypatch.setattr(settings, "deepseek_api_key", "deepseek-test")
    valid = json.dumps(
        {
            "screens": [
                {
                    "screen_index": 0,
                    "narrative_text": "vivid log",
                    "summary_emotional_state": "engaged",
                    "memorability_hypothesis": "high",
                    "events": [],
                }
            ]
        }
    )
    with respx.mock(assert_all_called=False) as router:
        router.post("https://api.deepseek.com/chat/completions").mock(
            return_value=httpx.Response(200, json={"choices": [{"message": {"content": valid}}]})
        )
        response = await client.post(
            "/analyze",
            json={"persona_id": persona_fixture, "content_id": text_content_fixture},
        )
        job_id = response.json()["job_id"]
        for _ in range(60):
            poll = await client.get(f"/jobs/{job_id}")
            body = poll.json()
            if body["status"] in {"DONE", "ERROR"}:
                break
            await asyncio.sleep(0.05)
        else:
            raise AssertionError("job did not complete")

    assert body["status"] == "DONE", body
    assert body["result"]["simulation"]["screens"][0]["narrative_text"] == "vivid log"
