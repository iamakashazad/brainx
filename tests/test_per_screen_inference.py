from __future__ import annotations

import numpy as np
import pytest

from backend.core.queue import _run_screen_inference_with_retry, _validate_screen_narrative


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
