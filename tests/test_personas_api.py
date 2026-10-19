from __future__ import annotations

import pytest

pytestmark = pytest.mark.asyncio

VALID_PAYLOAD = {
    "name": "Marketing Manager",
    "demographics": {"age": 32, "role": "marketing manager", "background": "10y B2B"},
    "psychographics": {
        "goals": ["find a plan"],
        "values": ["speed"],
        "motivations": ["efficiency"],
    },
    "cognitive_state": {
        "attention_span": "medium",
        "stress_level": "moderate",
        "tech_literacy": "intermediate",
    },
    "environment": {"device": "desktop", "location": "office", "ambient": "quiet"},
}

async def test_create_roundtrip(client):
    response = await client.post("/personas", json=VALID_PAYLOAD)
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["name"] == "Marketing Manager"
    assert body["demographics"]["age"] == 32
    assert body["cognitive_state"]["stress_level"] == "moderate"
    assert body["environment"]["device"] == "desktop"
    assert body["id"]

    got = await client.get(f"/personas/{body['id']}")
    assert got.status_code == 200
    assert got.json()["id"] == body["id"]


async def test_create_rejects_missing(client):
    payload = dict(VALID_PAYLOAD)
    payload.pop("cognitive_state")
    response = await client.post("/personas", json=payload)
    assert response.status_code == 422


async def test_cognitive_state_persists(client):
    payload = dict(VALID_PAYLOAD)
    payload["cognitive_state"] = {
        "attention_span": "long",
        "stress_level": "low",
        "tech_literacy": "expert",
    }
    response = await client.post("/personas", json=payload)
    assert response.status_code == 201
    assert response.json()["cognitive_state"]["attention_span"] == "long"


async def test_cognitive_state_enum_reject(client):
    payload = dict(VALID_PAYLOAD)
    payload["cognitive_state"] = {
        "attention_span": "medium",
        "stress_level": "moderate",
        "tech_literacy": "guru",
    }
    response = await client.post("/personas", json=payload)
    assert response.status_code == 422


async def test_environment_persists(client):
    payload = dict(VALID_PAYLOAD)
    payload["environment"] = {"device": "mobile", "location": "commute", "ambient": "noisy"}
    response = await client.post("/personas", json=payload)
    assert response.status_code == 201
    assert response.json()["environment"]["device"] == "mobile"

    payload["environment"] = {"device": "laptop", "location": "office", "ambient": None}
    bad = await client.post("/personas", json=payload)
    assert bad.status_code == 422


async def test_list_personas(client):
    created = await client.post("/personas", json=VALID_PAYLOAD)
    assert created.status_code == 201, created.text

    response = await client.get("/personas")
    assert response.status_code == 200
    assert any(persona["id"] == created.json()["id"] for persona in response.json())


async def test_get_persona_404(client):
    response = await client.get("/personas/does-not-exist")
    assert response.status_code == 404


async def test_patch_persona(client, persona_fixture):
    response = await client.patch(f"/personas/{persona_fixture}", json={"name": "Updated Name"})
    assert response.status_code == 200
    assert response.json()["name"] == "Updated Name"

    response = await client.patch(
        f"/personas/{persona_fixture}",
        json={
            "cognitive_state": {
                "attention_span": "short",
                "stress_level": "high",
                "tech_literacy": "novice",
            }
        },
    )
    assert response.status_code == 200
    assert response.json()["cognitive_state"]["attention_span"] == "short"


async def test_delete_persona(client, persona_fixture):
    response = await client.delete(f"/personas/{persona_fixture}")
    assert response.status_code == 204
    gone = await client.get(f"/personas/{persona_fixture}")
    assert gone.status_code == 404


async def test_delete_persona_rejects_referenced_jobs(client, persona_fixture, text_content_fixture):
    analyze = await client.post(
        "/analyze",
        json={"persona_id": persona_fixture, "content_id": text_content_fixture},
    )
    assert analyze.status_code == 201, analyze.text

    response = await client.delete(f"/personas/{persona_fixture}")
    assert response.status_code == 409, response.text
    assert "referenced" in response.json()["detail"]


# ── /personas/ai-suggest ──────────────────────────────────────────────────────
# This endpoint previously had no tests, which is how it shipped raising
# provider errors as bare 500s with no JSON body for the UI to display.

AI_SUGGEST_PAYLOAD = {
    "name": "Marketing Manager",
    "age": 32,
    "role": "marketing manager",
    "background": None,
    "field": "psychographics.goals",
}


async def test_ai_suggest_rejects_unknown_field(client):
    response = await client.post(
        "/personas/ai-suggest",
        json={**AI_SUGGEST_PAYLOAD, "field": "demographics.not_a_field"},
    )
    assert response.status_code == 400, response.text
    assert "Unknown field" in response.json()["detail"]


async def test_ai_suggest_missing_key_returns_422(client, monkeypatch):
    """Matches /analyze: an unconfigured key is an actionable 422, not a 500."""
    from backend.core.config import settings

    monkeypatch.setattr(settings, "deepseek_api_key", "")

    response = await client.post("/personas/ai-suggest", json=AI_SUGGEST_PAYLOAD)
    assert response.status_code == 422, response.text
    assert "DEEPSEEK_API_KEY" in response.json()["detail"]


async def test_ai_suggest_provider_failure_returns_502_with_detail(client, monkeypatch):
    """The provider's message must survive to the client, not become 500 text."""
    from backend.services import deepseek_client
    from backend.models.simulation import DeepSeekClientError

    async def boom(*_args, **_kwargs):
        raise DeepSeekClientError("DeepSeek request timed out. Please retry.")

    monkeypatch.setattr(deepseek_client, "deepseek_text_completion", boom)

    response = await client.post("/personas/ai-suggest", json=AI_SUGGEST_PAYLOAD)
    assert response.status_code == 502, response.text
    assert "timed out" in response.json()["detail"]


async def test_ai_suggest_schema_failure_returns_502(client, monkeypatch):
    from backend.services import deepseek_client
    from backend.models.simulation import SchemaValidationFailure

    async def bad_shape(*_args, **_kwargs):
        raise SchemaValidationFailure("value: expected list[str]")

    monkeypatch.setattr(deepseek_client, "deepseek_text_completion", bad_shape)

    response = await client.post("/personas/ai-suggest", json=AI_SUGGEST_PAYLOAD)
    assert response.status_code == 502, response.text
    assert "unusable response" in response.json()["detail"]


async def test_ai_suggest_returns_list_for_list_field(client, monkeypatch):
    from backend.services import deepseek_client

    class _Result:
        value = ["ship faster", "reduce onboarding drop-off"]

    async def ok(*_args, **_kwargs):
        return _Result()

    monkeypatch.setattr(deepseek_client, "deepseek_text_completion", ok)

    response = await client.post("/personas/ai-suggest", json=AI_SUGGEST_PAYLOAD)
    assert response.status_code == 200, response.text
    assert response.json()["value"] == ["ship faster", "reduce onboarding drop-off"]


def _fake_suggestion(monkeypatch, value):
    from backend.services import deepseek_client

    class _Result:
        pass

    _Result.value = value

    async def fake(*_args, **_kwargs):
        return _Result()

    monkeypatch.setattr(deepseek_client, "deepseek_text_completion", fake)


async def test_ai_suggest_normalises_enum_field(client, monkeypatch):
    _fake_suggestion(monkeypatch, " Medium. ")
    response = await client.post(
        "/personas/ai-suggest",
        json={**AI_SUGGEST_PAYLOAD, "field": "cognitive_state.attention_span"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["value"] == "medium"


async def test_ai_suggest_rejects_enum_value_outside_choices(client, monkeypatch):
    """An off-list value would fill the <select> with an option it does not have."""
    _fake_suggestion(monkeypatch, "very long")
    response = await client.post(
        "/personas/ai-suggest",
        json={**AI_SUGGEST_PAYLOAD, "field": "cognitive_state.attention_span"},
    )
    assert response.status_code == 502, response.text
    assert "short, medium, long" in response.json()["detail"]


async def test_ai_suggest_free_text_field_is_not_restricted(client, monkeypatch):
    _fake_suggestion(monkeypatch, "Busy open-plan office")
    response = await client.post(
        "/personas/ai-suggest",
        json={**AI_SUGGEST_PAYLOAD, "field": "environment.ambient"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["value"] == "Busy open-plan office"
