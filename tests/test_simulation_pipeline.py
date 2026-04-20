from __future__ import annotations

import asyncio
import json

import httpx
import numpy as np
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


async def test_log_viewable(
    client,
    persona_fixture,
    text_content_fixture,
    monkeypatch,
    stub_queue_recommendations,
    mixed_recommendations_payload,
):
    from backend.core.config import settings

    monkeypatch.setattr(settings, "deepseek_api_key", "deepseek-test")

    async def _fake_text_inference(_text: str) -> np.ndarray:
        return np.ones((2, 20484))

    monkeypatch.setattr("backend.core.queue.run_tribev2_text", _fake_text_inference)

    _labels = [
        "Unknown",
        "S_front_inf",
        "G_front_inf-Triangul",
        "S_intrapariet_and_P_trans",
        "G_front_middle",
        "S_front_middle",
        "G_front_sup",
        "G_insular_short",
        "S_cingul-Marginalis",
        "G_cingul-Post-ventral",
        "G_oc-temp_med-Parahip",
        "S_collat_transv_ant",
        "G_orbital",
        "G_rectus",
        "S_orbital-H_Shaped",
    ]
    _labels.extend(f"Unused_{i}" for i in range(76 - len(_labels)))
    _bilateral = np.resize(np.arange(1, 15, dtype=np.int64), 20484)
    _atlas = {
        "map_left": _bilateral[:10242],
        "map_right": _bilateral[10242:],
        "labels": _labels,
    }
    monkeypatch.setattr("backend.core.queue.get_surf_atlas", lambda: _atlas)
    stub_queue_recommendations(mixed_recommendations_payload)

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
