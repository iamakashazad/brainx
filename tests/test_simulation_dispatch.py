from __future__ import annotations

import json

import httpx
import pytest
import respx

from backend.models.content import Content, ContentType
from backend.models.persona import Persona
from backend.models.simulation import SimulationLog
from backend.services import simulation as simulation_service


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


@pytest.mark.asyncio
async def test_vl2_dispatch(tmp_path, monkeypatch):
    from backend.core.config import settings

    monkeypatch.setattr(settings, "uploads_dir", tmp_path)
    monkeypatch.setattr(settings, "replicate_api_token", "replicate-test")
    content_dir = tmp_path / "c2"
    content_dir.mkdir()
    (content_dir / "screen_1.jpg").write_bytes(b"\xff\xd8\xff\xd9")

    content = Content()
    content.id = "c2"
    content.content_type = ContentType.UI_SCREENS.value
    content.screen_count = 1

    valid_json = json.dumps(
        {
            "screens": [
                {
                    "screen_index": 0,
                    "narrative_text": "user sees the CTA",
                    "summary_emotional_state": "curious",
                    "memorability_hypothesis": "medium",
                    "events": [],
                }
            ]
        }
    )

    with respx.mock(assert_all_called=False) as router:
        deepseek_route = router.post("https://api.deepseek.com/chat/completions").mock(
            return_value=httpx.Response(200, json={})
        )
        router.get("https://api.replicate.com/v1/models/deepseek-ai/deepseek-vl2").mock(
            return_value=httpx.Response(200, json={"latest_version": {"id": "v" * 64}})
        )
        replicate_route = router.post("https://api.replicate.com/v1/predictions").mock(
            return_value=httpx.Response(200, json={"output": [valid_json]})
        )

        result = await simulation_service.simulate(_persona(), content)

    assert isinstance(result, SimulationLog)
    assert replicate_route.called
    assert not deepseek_route.called
    body = replicate_route.calls[0].request.read().decode("utf-8")
    assert "data:image/jpeg;base64," in body


@pytest.mark.asyncio
async def test_v3_dispatch(monkeypatch):
    from backend.core.config import settings

    monkeypatch.setattr(settings, "deepseek_api_key", "deepseek-test")
    content = Content()
    content.id = "c1"
    content.content_type = ContentType.TEXT.value
    content.content_text = "hello"

    valid_json = json.dumps(
        {
            "screens": [
                {
                    "screen_index": 0,
                    "narrative_text": "user reads the message",
                    "summary_emotional_state": "engaged",
                    "memorability_hypothesis": "high",
                    "events": [],
                }
            ]
        }
    )

    with respx.mock(assert_all_called=False) as router:
        deepseek_route = router.post("https://api.deepseek.com/chat/completions").mock(
            return_value=httpx.Response(200, json={"choices": [{"message": {"content": valid_json}}]})
        )
        replicate_route = router.post("https://api.replicate.com/v1/predictions").mock(
            return_value=httpx.Response(200, json={})
        )

        result = await simulation_service.simulate(_persona(), content)

    assert isinstance(result, SimulationLog)
    assert deepseek_route.called
    assert not replicate_route.called
