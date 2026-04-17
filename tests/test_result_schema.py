from __future__ import annotations

import asyncio
import json
from pathlib import Path

import httpx
import numpy as np
import pytest
import respx

from backend.services.roi_aggregation import CIRCUIT_NAMES
from tests.fixtures.sim_log_3_screens import sim_log_3_screens  # noqa: F401

pytestmark = pytest.mark.asyncio


def _patch_surface_text_inference(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_text_inference(_text: str) -> np.ndarray:
        return np.ones((2, 20484))

    monkeypatch.setattr("backend.core.queue.run_tribev2_text", fake_text_inference)


def _patch_surface_atlas(monkeypatch: pytest.MonkeyPatch) -> None:
    roi_labels = [
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
    labels = ["Unknown", *roi_labels]
    labels.extend(f"Unused_{index}" for index in range(76 - len(labels)))
    bilateral = np.resize(np.arange(1, len(roi_labels) + 1, dtype=np.int64), 20484)
    atlas = {
        "map_left": bilateral[:10242],
        "map_right": bilateral[10242:],
        "labels": labels,
    }
    monkeypatch.setattr("backend.core.queue.get_surf_atlas", lambda: atlas)


async def _wait_for_terminal(client, job_id: str, max_iters: int = 60) -> dict:
    body: dict = {}
    for _ in range(max_iters):
        response = await client.get(f"/jobs/{job_id}")
        body = response.json()
        if body["status"] in {"DONE", "ERROR"}:
            return body
        await asyncio.sleep(0.05)
    raise AssertionError(f"job {job_id} did not complete: {body}")


class TestResultEnvelope:
    async def test_envelope_keys(
        self,
        client,
        persona_fixture,
        ui_screens_fixture,
        monkeypatch,
        sim_log_3_screens,
    ) -> None:
        async def fake_simulate(_persona, _content):
            return sim_log_3_screens

        async def fake_grounding(_content, _sim_log):
            return None

        monkeypatch.setattr("backend.core.queue.simulation.simulate", fake_simulate)
        monkeypatch.setattr("backend.core.queue.grounding.judge", fake_grounding)
        _patch_surface_text_inference(monkeypatch)
        _patch_surface_atlas(monkeypatch)

        response = await client.post(
            "/analyze",
            json={"persona_id": persona_fixture, "content_id": ui_screens_fixture},
        )
        final = await _wait_for_terminal(client, response.json()["job_id"])

        assert final["status"] == "DONE", final
        assert set(final["result"].keys()) == {
            "schema_version",
            "simulation",
            "overlays",
            "activations",
            "roi",
            "flow_continuity",
            "recommendations",
        }
        assert "_roi_native_tmp" not in final["result"]

    async def test_schema_version_round_trip(self) -> None:
        from backend.models.results import AnalysisResult

        payload = {
            "schema_version": 1,
            "simulation": {"screens": []},
            "overlays": [],
            "activations": [],
            "roi": [],
            "flow_continuity": {
                "circuits": {
                    name: {"per_screen": [], "trend": "flat"} for name in CIRCUIT_NAMES
                }
            },
            "recommendations": [],
        }

        model = AnalysisResult.model_validate(payload)
        assert model.schema_version == 1
        assert AnalysisResult.model_validate(model.model_dump()).schema_version == 1

    async def test_roi_per_screen_has_both_circuits_and_regions(
        self,
        client,
        persona_fixture,
        ui_screens_fixture,
        monkeypatch,
        sim_log_3_screens,
    ) -> None:
        async def fake_simulate(_persona, _content):
            return sim_log_3_screens

        async def fake_grounding(_content, _sim_log):
            return None

        monkeypatch.setattr("backend.core.queue.simulation.simulate", fake_simulate)
        monkeypatch.setattr("backend.core.queue.grounding.judge", fake_grounding)
        _patch_surface_text_inference(monkeypatch)
        _patch_surface_atlas(monkeypatch)

        response = await client.post(
            "/analyze",
            json={"persona_id": persona_fixture, "content_id": ui_screens_fixture},
        )
        final = await _wait_for_terminal(client, response.json()["job_id"])

        roi = final["result"]["roi"]
        assert len(roi) == 3
        for expected_index, screen_entry in enumerate(roi):
            assert screen_entry["screen_index"] == expected_index
            assert set(screen_entry["circuits"].keys()) == set(CIRCUIT_NAMES)
            for circuit_values in screen_entry["circuits"].values():
                assert set(circuit_values.keys()) == {"score", "peak"}
                assert 0.0 <= circuit_values["score"] <= 100.0
                assert 0.0 <= circuit_values["peak"] <= 100.0
            assert 1 <= len(screen_entry["regions"]) <= 15
            for row in screen_entry["regions"]:
                assert set(row.keys()) == {"atlas_label", "circuit", "score", "peak"}
                assert row["circuit"] in CIRCUIT_NAMES
                assert 0.0 <= row["score"] <= 100.0
                assert 0.0 <= row["peak"] <= 100.0

    async def test_flow_continuity_shape(
        self,
        client,
        persona_fixture,
        ui_screens_fixture,
        monkeypatch,
        sim_log_3_screens,
    ) -> None:
        async def fake_simulate(_persona, _content):
            return sim_log_3_screens

        async def fake_grounding(_content, _sim_log):
            return None

        monkeypatch.setattr("backend.core.queue.simulation.simulate", fake_simulate)
        monkeypatch.setattr("backend.core.queue.grounding.judge", fake_grounding)
        _patch_surface_text_inference(monkeypatch)
        _patch_surface_atlas(monkeypatch)

        response = await client.post(
            "/analyze",
            json={"persona_id": persona_fixture, "content_id": ui_screens_fixture},
        )
        final = await _wait_for_terminal(client, response.json()["job_id"])

        circuits = final["result"]["flow_continuity"]["circuits"]
        assert set(circuits.keys()) == set(CIRCUIT_NAMES)
        for continuity in circuits.values():
            assert set(continuity.keys()) == {"per_screen", "trend"}
            assert len(continuity["per_screen"]) == 3
            assert continuity["trend"] in ("rising", "dropping", "flat", "volatile")
            for point in continuity["per_screen"]:
                assert set(point.keys()) == {"screen_index", "score_0_100", "delta_from_prev"}

    async def test_result_size_under_100kb(
        self,
        client,
        persona_fixture,
        ui_screens_fixture,
        monkeypatch,
        sim_log_3_screens,
        tmp_path,
    ) -> None:
        async def fake_simulate(_persona, _content):
            return sim_log_3_screens

        async def fake_grounding(_content, _sim_log):
            return None

        monkeypatch.chdir(tmp_path)
        monkeypatch.setattr("backend.core.queue.simulation.simulate", fake_simulate)
        monkeypatch.setattr("backend.core.queue.grounding.judge", fake_grounding)
        _patch_surface_text_inference(monkeypatch)
        _patch_surface_atlas(monkeypatch)

        response = await client.post(
            "/analyze",
            json={"persona_id": persona_fixture, "content_id": ui_screens_fixture},
        )
        final = await _wait_for_terminal(client, response.json()["job_id"])

        payload_json = json.dumps(final["result"])
        assert len(payload_json.encode("utf-8")) < 100 * 1024
        for entry in final["result"]["activations"]:
            assert set(entry.keys()) == {"screen_index", "path", "shape", "timesteps"}
            assert isinstance(entry["path"], str)
            assert "screen_" in entry["path"]
            assert ".npy" in entry["path"]
            assert "activation" not in entry
            assert Path(entry["path"]).exists()

    async def test_recommendations_slot_is_list(
        self,
        client,
        persona_fixture,
        ui_screens_fixture,
        monkeypatch,
        sim_log_3_screens,
    ) -> None:
        async def fake_simulate(_persona, _content):
            return sim_log_3_screens

        async def fake_grounding(_content, _sim_log):
            return None

        monkeypatch.setattr("backend.core.queue.simulation.simulate", fake_simulate)
        monkeypatch.setattr("backend.core.queue.grounding.judge", fake_grounding)
        _patch_surface_text_inference(monkeypatch)
        _patch_surface_atlas(monkeypatch)

        response = await client.post(
            "/analyze",
            json={"persona_id": persona_fixture, "content_id": ui_screens_fixture},
        )
        final = await _wait_for_terminal(client, response.json()["job_id"])

        recommendations = final["result"]["recommendations"]
        assert isinstance(recommendations, list)
        assert recommendations
        assert recommendations[0]["evidence"]["circuit"] == "Attention"

    async def test_stage_progression_caplog(
        self,
        client,
        persona_fixture,
        ui_screens_fixture,
        monkeypatch,
        sim_log_3_screens,
        caplog,
    ) -> None:
        async def fake_simulate(_persona, _content):
            return sim_log_3_screens

        async def fake_grounding(_content, _sim_log):
            return None

        monkeypatch.setattr("backend.core.queue.simulation.simulate", fake_simulate)
        monkeypatch.setattr("backend.core.queue.grounding.judge", fake_grounding)
        _patch_surface_text_inference(monkeypatch)
        _patch_surface_atlas(monkeypatch)

        with respx.mock(assert_all_called=False) as router:
            router.post("https://api.deepseek.com/chat/completions").mock(
                return_value=httpx.Response(200, json={"choices": [{"message": {"content": "{}"}}]})
            )
            with caplog.at_level("INFO", logger="backend.core.queue"):
                response = await client.post(
                    "/analyze",
                    json={"persona_id": persona_fixture, "content_id": ui_screens_fixture},
                )
                final = await _wait_for_terminal(client, response.json()["job_id"])

        assert final["status"] == "DONE", final
        messages = [record.getMessage() for record in caplog.records]
        assert any("simulation" in message for message in messages)
        assert any("grounding_check" in message for message in messages)
        assert any("inference" in message for message in messages)
        assert any("roi_aggregation" in message for message in messages)
        assert any("processing" in message for message in messages)
        assert any("recommendations" in message for message in messages)


class TestModelImports:
    async def test_models_import(self) -> None:
        from backend.models.continuity import FlowContinuity
        from backend.models.results import AnalysisResult, SCHEMA_VERSION

        assert SCHEMA_VERSION == 1
        assert FlowContinuity is not None
        assert AnalysisResult is not None
