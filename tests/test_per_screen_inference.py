from __future__ import annotations

import os

import numpy as np
import pytest

from backend.core.queue import _run_screen_inference_with_retry, _validate_screen_narrative
from backend.services.roi_aggregation import aggregate_screen_roi, get_surf_atlas

EXPECTED_BILATERAL = 10242 + 10242


def _fake_surface_atlas_payload() -> dict[str, object]:
    labels = [
        b"Unknown",
        b"S_front_inf",
        b"G_front_inf-Triangul",
        b"S_intrapariet_and_P_trans",
        b"G_front_middle",
        b"S_front_middle",
        b"G_front_sup",
        b"G_insular_short",
        b"S_cingul-Marginalis",
        b"G_cingul-Post-ventral",
        b"G_oc-temp_med-Parahip",
        b"S_collat_transv_ant",
        b"G_orbital",
        b"G_rectus",
        b"S_orbital-H_Shaped",
    ]
    labels.extend(f"Unused_{index}" for index in range(76 - len(labels)))
    bilateral = np.resize(np.arange(1, 15, dtype=np.int64), EXPECTED_BILATERAL)
    return {
        "map_left": bilateral[:10242],
        "map_right": bilateral[10242:],
        "labels": labels,
    }


@pytest.fixture
def fake_surface_fetch(monkeypatch: pytest.MonkeyPatch) -> dict[str, object]:
    payload = _fake_surface_atlas_payload()
    get_surf_atlas.cache_clear()
    monkeypatch.setattr(
        "backend.services.roi_aggregation.fetch_atlas_surf_destrieux",
        lambda **_kwargs: payload,
    )
    yield payload
    get_surf_atlas.cache_clear()


class TestRunScreenInferenceWithRetry:
    @pytest.mark.asyncio
    async def test_happy_path(self, monkeypatch: pytest.MonkeyPatch) -> None:
        calls_counted = 0

        async def fake_run(_text: str) -> np.ndarray:
            nonlocal calls_counted
            calls_counted += 1
            return np.zeros((2, 20484))

        monkeypatch.setattr("backend.core.queue.run_tribev2_text", fake_run)
        result = await _run_screen_inference_with_retry(1, "Narrative for screen one")
        assert result.shape == (2, 20484)
        assert calls_counted == 1

    @pytest.mark.asyncio
    async def test_retry_once_on_first_failure(self, monkeypatch: pytest.MonkeyPatch) -> None:
        calls_counted = 0

        async def fake_run(_text: str) -> np.ndarray:
            nonlocal calls_counted
            calls_counted += 1
            if calls_counted == 1:
                raise RuntimeError("boom")
            return np.zeros((2, 20484))

        monkeypatch.setattr("backend.core.queue.run_tribev2_text", fake_run)
        result = await _run_screen_inference_with_retry(2, "Narrative for screen two")
        assert result.shape == (2, 20484)
        assert calls_counted == 2

    @pytest.mark.asyncio
    async def test_raises_on_second_failure(self, monkeypatch: pytest.MonkeyPatch) -> None:
        calls_counted = 0

        async def fake_run(_text: str) -> np.ndarray:
            nonlocal calls_counted
            calls_counted += 1
            raise RuntimeError("kaboom")

        monkeypatch.setattr("backend.core.queue.run_tribev2_text", fake_run)
        with pytest.raises(RuntimeError, match=r"screen 2.*after 2 attempts"):
            await _run_screen_inference_with_retry(2, "Narrative for screen two")
        assert calls_counted == 2


class TestActivationsFilesystem:
    def test_per_screen_paths_use_1_indexed_names(self) -> None:
        job_id = "job-123"
        expected = [
            f"activations/{job_id}/screen_1.npy",
            f"activations/{job_id}/screen_2.npy",
            f"activations/{job_id}/screen_3.npy",
        ]
        assert expected == [
            f"activations/{job_id}/screen_{index}.npy" for index in range(1, 4)
        ]


class TestEmptyNarrativeGuard:
    def test_empty_narrative_raises_with_screen_index(self) -> None:
        with pytest.raises(RuntimeError, match="screen 1"):
            _validate_screen_narrative(1, "   ")


class TestAssumptionA1VertexCount:
    def test_fsaverage5_atlas_bilateral_total(
        self,
        fake_surface_fetch: dict[str, object],
    ) -> None:
        atlas = get_surf_atlas()
        total = atlas["map_left"].shape[0] + atlas["map_right"].shape[0]
        assert total == EXPECTED_BILATERAL, (
            f"Destrieux surface atlas bilateral total is {total}; "
            f"expected {EXPECTED_BILATERAL}. If nilearn changed, update "
            f"aggregate_screen_roi vertex-count guard."
        )

    def test_aggregate_rejects_phase1_tribev2_shape_hint(
        self,
        fake_surface_fetch: dict[str, object],
    ) -> None:
        atlas = get_surf_atlas()
        wrong = np.zeros((2, 20004))
        with pytest.raises(ValueError, match=r"20004.*20484|vertex count.*does not match"):
            aggregate_screen_roi(wrong, atlas)

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_live_tribev2_output_shape(self) -> None:
        if not os.environ.get("RUN_LIVE_TRIBEV2"):
            pytest.skip("Set RUN_LIVE_TRIBEV2=1 and have TRIBEv2 installed to run")

        from backend.services.inference import run_tribev2_text

        arr = await run_tribev2_text("Quick warm-up narrative for shape probe.")
        assert arr.shape[1] == EXPECTED_BILATERAL, (
            f"TRIBEv2 output shape is {arr.shape}; "
            f"expected (T, {EXPECTED_BILATERAL}). A1 invalidated — "
            f"update aggregate_screen_roi / _build_vertex_label_map accordingly."
        )
