from __future__ import annotations

import asyncio
import logging
import json
import time
from unittest.mock import AsyncMock, patch

import httpx
import numpy as np
import pytest
import respx
from sqlalchemy import select

from backend.core import database
from backend.models.job import Job
from tests.fixtures.sim_log_3_screens import empty_narrative_screen, sim_log_3_screens

pytestmark = pytest.mark.asyncio


@pytest.fixture(autouse=True)
def _stub_queue_recommendations(
    stub_queue_recommendations,
    mixed_recommendations_payload,
):
    stub_queue_recommendations(mixed_recommendations_payload)

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


THREE_SCREEN_SIM_JSON = json.dumps(
    {
        "screens": [
            {
                "screen_index": 0,
                "narrative_text": "User opens the welcome screen calmly, reading the headline with focus.",
                "summary_emotional_state": "calm",
                "memorability_hypothesis": "Likely remembered because it frames the first impression.",
                "events": [
                    {
                        "timestamp_ms": 100,
                        "type": "fixation",
                        "target_region": {
                            "x_ratio": 0.1,
                            "y_ratio": 0.1,
                            "width_ratio": 0.8,
                            "height_ratio": 0.2,
                        },
                        "intensity": 0.6,
                        "note": "Headline fixation",
                    }
                ],
            },
            {
                "screen_index": 1,
                "narrative_text": "User scrolls through a dense feature list and feels overwhelmed by the options shown.",
                "summary_emotional_state": "frustrated",
                "memorability_hypothesis": "Likely forgotten because the screen is too dense.",
                "events": [
                    {
                        "timestamp_ms": 2000,
                        "type": "scroll",
                        "target_region": {
                            "x_ratio": 0.0,
                            "y_ratio": 0.5,
                            "width_ratio": 1.0,
                            "height_ratio": 0.4,
                        },
                        "intensity": 0.8,
                        "note": "Fast scroll past features",
                    }
                ],
            },
            {
                "screen_index": 2,
                "narrative_text": "User reaches the CTA button and feels excited to sign up immediately after scanning pricing.",
                "summary_emotional_state": "excited",
                "memorability_hypothesis": "Strongly remembered because the CTA creates reward anticipation.",
                "events": [
                    {
                        "timestamp_ms": 4000,
                        "type": "click_intent",
                        "target_region": {
                            "x_ratio": 0.3,
                            "y_ratio": 0.8,
                            "width_ratio": 0.4,
                            "height_ratio": 0.1,
                        },
                        "intensity": 0.9,
                        "note": "Sign up CTA",
                    }
                ],
            },
        ]
    }
)


def _patch_surface_text_inference(
    monkeypatch: pytest.MonkeyPatch,
    *,
    delay: float = 0.0,
) -> None:
    async def fake_text_inference(_text: str) -> np.ndarray:
        if delay:
            await asyncio.sleep(delay)
        return np.ones((2, 20484))

    monkeypatch.setattr("backend.core.queue.run_tribev2_text", fake_text_inference)


def _patch_surface_atlas(monkeypatch: pytest.MonkeyPatch) -> None:
    labels = ["Unknown"] + [
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
    labels.extend(f"Unused_{index}" for index in range(76 - len(labels)))
    bilateral = np.resize(np.arange(1, 15, dtype=np.int64), 20484)
    atlas = {
        "map_left": bilateral[:10242],
        "map_right": bilateral[10242:],
        "labels": labels,
    }
    monkeypatch.setattr("backend.core.queue.get_surf_atlas", lambda: atlas)


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
    _patch_surface_text_inference(monkeypatch)
    _patch_surface_atlas(monkeypatch)
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
    rec_types = {rec["rec_type"] for rec in final["result"]["recommendations"]}
    assert {"layout_flag", "memorability", "emotional_dropoff"} <= rec_types


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


async def test_stage_transitions(client, persona_fixture, text_content_fixture, monkeypatch, caplog):
    from backend.core.config import settings

    monkeypatch.setattr(settings, "deepseek_api_key", "deepseek-test")
    _patch_surface_text_inference(monkeypatch, delay=0.05)
    _patch_surface_atlas(monkeypatch)

    with respx.mock(assert_all_called=False) as router:
        router.post("https://api.deepseek.com/chat/completions").mock(
            return_value=httpx.Response(200, json={"choices": [{"message": {"content": VALID_SIM_JSON}}]})
        )
        with caplog.at_level(logging.INFO, logger="backend.core.queue"):
            response = await client.post(
                "/analyze",
                json={"persona_id": persona_fixture, "content_id": text_content_fixture},
            )
            final = await _wait_for_terminal(client, response.json()["job_id"])

    assert final["status"] == "DONE", final
    messages = [record.getMessage() for record in caplog.records]
    for expected in (
        "simulation",
        "grounding_check",
        "inference",
        "roi_aggregation",
        "processing",
        "recommendations",
    ):
        assert any(expected in message for message in messages), f"missing {expected}"
    assert final["result"]["schema_version"] == 1
    assert "flow_continuity" in final["result"]
    assert "roi" in final["result"]
    assert "activations" in final["result"]
    assert "_roi_native_tmp" not in final["result"]


async def test_failure_policy_simulation_retry(client, persona_fixture, text_content_fixture, monkeypatch):
    from backend.core.config import settings

    monkeypatch.setattr(settings, "deepseek_api_key", "deepseek-test")
    _patch_surface_text_inference(monkeypatch)
    _patch_surface_atlas(monkeypatch)
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
    _patch_surface_text_inference(monkeypatch)
    _patch_surface_atlas(monkeypatch)

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


async def test_per_screen_files_written(
    client,
    persona_fixture,
    ui_screens_fixture,
    monkeypatch,
    tmp_path,
    sim_log_3_screens,
):
    async def fake_simulate(_persona, _content):
        return sim_log_3_screens

    async def fake_grounding(_content, _sim_log):
        return None

    monkeypatch.chdir(tmp_path)
    _patch_surface_text_inference(monkeypatch)
    _patch_surface_atlas(monkeypatch)
    monkeypatch.setattr("backend.core.queue.simulation.simulate", fake_simulate)
    monkeypatch.setattr("backend.core.queue.grounding.judge", fake_grounding)

    response = await client.post(
        "/analyze",
        json={"persona_id": persona_fixture, "content_id": ui_screens_fixture},
    )
    final = await _wait_for_terminal(client, response.json()["job_id"])

    assert final["status"] == "DONE", final
    job_dir = tmp_path / "activations" / response.json()["job_id"]
    assert (job_dir / "screen_1.npy").exists()
    assert (job_dir / "screen_2.npy").exists()
    assert (job_dir / "screen_3.npy").exists()
    assert not (job_dir / "screen_4.npy").exists()


async def test_empty_narrative_errors(
    client,
    persona_fixture,
    ui_screens_fixture,
    monkeypatch,
    empty_narrative_screen,
):
    async def fake_simulate(_persona, _content):
        return empty_narrative_screen

    async def fake_grounding(_content, _sim_log):
        return None

    _patch_surface_text_inference(monkeypatch)
    _patch_surface_atlas(monkeypatch)
    monkeypatch.setattr("backend.core.queue.simulation.simulate", fake_simulate)
    monkeypatch.setattr("backend.core.queue.grounding.judge", fake_grounding)

    response = await client.post(
        "/analyze",
        json={"persona_id": persona_fixture, "content_id": ui_screens_fixture},
    )
    final = await _wait_for_terminal(client, response.json()["job_id"])

    assert final["status"] == "ERROR"
    assert "screen 1" in final["error"]


async def test_activations_manifest_shape(
    client,
    persona_fixture,
    ui_screens_fixture,
    monkeypatch,
    sim_log_3_screens,
):
    async def fake_simulate(_persona, _content):
        return sim_log_3_screens

    async def fake_grounding(_content, _sim_log):
        return None

    _patch_surface_text_inference(monkeypatch)
    _patch_surface_atlas(monkeypatch)
    monkeypatch.setattr("backend.core.queue.simulation.simulate", fake_simulate)
    monkeypatch.setattr("backend.core.queue.grounding.judge", fake_grounding)

    response = await client.post(
        "/analyze",
        json={"persona_id": persona_fixture, "content_id": ui_screens_fixture},
    )
    final = await _wait_for_terminal(client, response.json()["job_id"])

    assert final["status"] == "DONE", final
    manifest = final["result"]["activations"]
    assert len(manifest) == 3
    for index, entry in enumerate(manifest):
        assert set(entry.keys()) >= {"screen_index", "path", "shape", "timesteps"}
        assert entry["screen_index"] == index
        assert entry["shape"] == [2, 20484]
        assert entry["timesteps"] == 2


async def test_analyze_populates_recommendations_via_mock(
    client,
    persona_fixture,
    ui_screens_fixture,
    monkeypatch,
    sim_log_3_screens,
    mixed_recommendations_payload,
):
    from backend.models.recommendations import Recommendations

    async def fake_simulate(_persona, _content):
        return sim_log_3_screens

    async def fake_grounding(_content, _sim_log):
        return None

    async def fake_generate_recommendations(*_args, **_kwargs) -> Recommendations:
        return Recommendations.model_validate(mixed_recommendations_payload)

    _patch_surface_text_inference(monkeypatch)
    _patch_surface_atlas(monkeypatch)
    monkeypatch.setattr("backend.core.queue.simulation.simulate", fake_simulate)
    monkeypatch.setattr("backend.core.queue.grounding.judge", fake_grounding)
    monkeypatch.setattr("backend.core.queue.generate_recommendations", fake_generate_recommendations)

    response = await client.post(
        "/analyze",
        json={"persona_id": persona_fixture, "content_id": ui_screens_fixture},
    )
    final = await _wait_for_terminal(client, response.json()["job_id"])

    assert final["status"] == "DONE", final
    persisted = final["result"]["recommendations"]
    rec_types = {rec["rec_type"] for rec in persisted}
    assert {"layout_flag", "memorability", "emotional_dropoff"} <= rec_types
    layout_flag = next(rec for rec in persisted if rec["rec_type"] == "layout_flag")
    assert layout_flag["target_region"]["x_ratio"] == 0.15
    assert layout_flag["element_description"] == "Subtitle reread"
    assert next(rec for rec in persisted if rec["rec_type"] == "memorability")["screen_index"] == 1
    assert next(rec for rec in persisted if rec["rec_type"] == "emotional_dropoff")["screen_index"] == 2


async def test_legacy_test_inference_single_shot(client, monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)

    response = await client.post("/test-inference", json={"text": "hello world", "input_type": "text"})
    assert response.status_code == 200

    final = await _wait_for_terminal(client, response.json()["job_id"])

    assert final["status"] == "DONE", final
    assert final["result"]["shape"] == [2, 8]
    assert (tmp_path / "activations" / f"{response.json()['job_id']}.npy").exists()
    assert not (tmp_path / "activations" / response.json()["job_id"] / "screen_2.npy").exists()
