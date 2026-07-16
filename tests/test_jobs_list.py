from __future__ import annotations

import datetime as dt

import pytest

from backend.core import database
from backend.models.job import Job

pytestmark = pytest.mark.asyncio


async def _create_real_refs(client) -> tuple[str, str]:
    persona_response = await client.post(
        "/personas",
        json={
            "name": "History Persona",
            "demographics": {"age": 32, "role": "Designer", "background": None},
            "psychographics": {
                "goals": ["review"],
                "values": ["clarity"],
                "motivations": ["speed"],
            },
            "cognitive_state": {
                "attention_span": "medium",
                "stress_level": "moderate",
                "tech_literacy": "expert",
            },
            "environment": {"device": "desktop", "location": "office", "ambient": None},
        },
    )
    assert persona_response.status_code in (200, 201), persona_response.text

    content_response = await client.post(
        "/content/text",
        json={"content_text": "A landing page headline and call to action."},
    )
    assert content_response.status_code in (200, 201), content_response.text

    return persona_response.json()["id"], content_response.json()["content_id"]


async def _insert_job(
    *,
    job_id: str,
    status: str = "DONE",
    persona_id: str | None,
    content_id: str | None,
    created_at: dt.datetime,
) -> None:
    async with database.async_session() as session:
        session.add(
            Job(
                id=job_id,
                status=status,
                persona_id=persona_id,
                content_id=content_id,
                created_at=created_at,
                updated_at=created_at,
            )
        )
        await session.commit()


async def test_list_jobs_returns_empty_when_no_real_jobs(client):
    response = await client.get("/jobs")

    assert response.status_code == 200
    assert response.json() == []


async def test_list_jobs_filters_legacy_and_orders_desc(client):
    persona_id, content_id = await _create_real_refs(client)
    older = dt.datetime(2026, 4, 23, 10, 0, 0)
    newer = dt.datetime(2026, 4, 24, 12, 0, 0)

    await _insert_job(
        job_id="legacy-job",
        persona_id=None,
        content_id=None,
        created_at=newer + dt.timedelta(hours=1),
    )
    await _insert_job(
        job_id="real-older",
        persona_id=persona_id,
        content_id=content_id,
        created_at=older,
    )
    await _insert_job(
        job_id="real-newer",
        persona_id=persona_id,
        content_id=content_id,
        created_at=newer,
    )

    response = await client.get("/jobs")

    assert response.status_code == 200
    body = response.json()
    assert [job["job_id"] for job in body] == ["real-newer", "real-older"]
    assert "legacy-job" not in {job["job_id"] for job in body}


async def test_list_jobs_caps_at_50(client):
    persona_id, content_id = await _create_real_refs(client)
    base = dt.datetime(2026, 4, 24, 12, 0, 0)

    for index in range(60):
        await _insert_job(
            job_id=f"job-{index:02d}",
            persona_id=persona_id,
            content_id=content_id,
            created_at=base + dt.timedelta(minutes=index),
        )

    response = await client.get("/jobs")

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 50
    assert body[0]["job_id"] == "job-59"
    assert body[-1]["job_id"] == "job-10"


async def test_list_jobs_response_shape(client):
    persona_id, content_id = await _create_real_refs(client)
    await _insert_job(
        job_id="done-job",
        status="DONE",
        persona_id=persona_id,
        content_id=content_id,
        created_at=dt.datetime(2026, 4, 24, 12, 0, 0),
    )

    response = await client.get("/jobs")

    assert response.status_code == 200
    item = response.json()[0]
    assert set(item.keys()) == {"job_id", "status", "persona_id", "created_at"}
    assert item["status"] == "DONE"
