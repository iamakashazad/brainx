from __future__ import annotations

import asyncio

import pytest
from httpx import AsyncClient


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
