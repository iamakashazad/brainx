from __future__ import annotations

import numpy as np
import pytest

pytestmark = pytest.mark.asyncio


async def test_vertex_endpoint_happy(client, seed_done_job):
    job_id, _manifest_path, raw_arr = await seed_done_job(screen_count=1)

    resp = await client.get(f"/jobs/{job_id}/activations/0")

    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/octet-stream"
    assert resp.headers["x-vertex-count"] == "20484"
    assert resp.headers["x-shape"] == "20484"
    assert len(resp.content) == 20484 * 4

    recovered = np.frombuffer(resp.content, dtype=np.float32)
    expected = raw_arr.mean(axis=0).astype(np.float32)
    np.testing.assert_allclose(recovered, expected, rtol=0, atol=0)


async def test_vertex_endpoint_404_unknown_job(client):
    resp = await client.get("/jobs/nonexistent/activations/0")
    assert resp.status_code == 404


async def test_vertex_endpoint_404_unknown_screen(client, seed_done_job):
    job_id, _manifest_path, _raw_arr = await seed_done_job(screen_count=2)

    resp = await client.get(f"/jobs/{job_id}/activations/5")

    assert resp.status_code == 404


async def test_vertex_endpoint_404_nondone(client, seed_pending_job):
    job_id = await seed_pending_job()

    resp = await client.get(f"/jobs/{job_id}/activations/0")

    assert resp.status_code == 404


async def test_vertex_endpoint_404_for_legacy_result_shape(client):
    """A DONE /test-inference job has no per-screen manifest: 404, not 500."""
    from backend.core import database
    from backend.models.job import Job

    async with database.async_session() as session:
        session.add(
            Job(
                id="legacy-done-job",
                status="DONE",
                result_json={"activation_path": "activations/legacy.npy", "shape": [3, 20484]},
            )
        )
        await session.commit()

    resp = await client.get("/jobs/legacy-done-job/activations/0")
    assert resp.status_code == 404
    assert "predates" in resp.json()["detail"]
