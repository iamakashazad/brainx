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
