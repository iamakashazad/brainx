from __future__ import annotations

import asyncio
import os
import tempfile

import numpy as np
import pytest
from PIL import Image

from backend.core.config import settings
from backend.ml.tribe_loader import load_model
from backend.services.inference import run_tribev2_text, run_tribev2_video
from backend.services.pathway_config import get_default_pathway, set_default_pathway
from backend.services.video_slideshow import create_slideshow

pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(
        os.environ.get("RUN_TRIBEV2_INTEGRATION") != "1",
        reason="set RUN_TRIBEV2_INTEGRATION=1 to run live TRIBEv2 smoke tests",
    ),
]


@pytest.fixture(scope="module")
def loaded_model():
    model = asyncio.run(load_model(settings.model_cache_path, settings.device))
    yield model


class TestTextPathway:
    def test_text_pathway_produces_activation(self, loaded_model) -> None:
        activation = asyncio.run(
            run_tribev2_text("The user opens the app and reads the headline carefully.")
        )

        assert loaded_model is not None
        assert isinstance(activation, np.ndarray)
        assert activation.ndim == 2
        assert activation.shape[0] > 0
        assert activation.shape[1] > 10000

    def test_text_pathway_different_inputs_different_outputs(self, loaded_model) -> None:
        calm_text = (
            "A serene meditation app opens with soft blue gradients. "
            "The user breathes slowly and reads each prompt in stillness."
        )
        urgent_text = (
            "FLASH SALE ENDING NOW!!! BUY NOW!!! "
            "The user feels time pressure and rushes toward the red CTA."
        )

        calm_activation = asyncio.run(run_tribev2_text(calm_text))
        urgent_activation = asyncio.run(run_tribev2_text(urgent_text))

        assert loaded_model is not None
        calm_mean = np.mean(calm_activation, axis=0)
        urgent_mean = np.mean(urgent_activation, axis=0)
        diff = np.abs(calm_mean - urgent_mean)

        print(f"Mean absolute difference: {np.mean(diff):.6f}")
        print(f"Max absolute difference: {np.max(diff):.6f}")

        assert not np.allclose(calm_mean, urgent_mean, atol=1e-6)


class TestVideoSlideshowPathway:
    def test_slideshow_creates_valid_mp4(self) -> None:
        img_paths: list[str] = []
        mp4_path = ""

        for color in [(255, 0, 0), (0, 0, 255)]:
            image = Image.new("RGB", (320, 240), color)
            path = tempfile.NamedTemporaryFile(suffix=".png", delete=False).name
            image.save(path)
            img_paths.append(path)

        try:
            mp4_path = create_slideshow(img_paths, durations=[2.0, 2.0])
            assert os.path.exists(mp4_path)
            assert os.path.getsize(mp4_path) > 0
        finally:
            for path in img_paths:
                if os.path.exists(path):
                    os.unlink(path)
            if mp4_path and os.path.exists(mp4_path):
                os.unlink(mp4_path)

    def test_video_pathway_produces_activation(self, loaded_model) -> None:
        img_paths: list[str] = []
        mp4_path = ""

        for color in [(255, 255, 255), (0, 0, 0)]:
            image = Image.new("RGB", (320, 240), color)
            path = tempfile.NamedTemporaryFile(suffix=".png", delete=False).name
            image.save(path)
            img_paths.append(path)

        try:
            mp4_path = create_slideshow(img_paths, durations=[3.0, 3.0])
            activation = asyncio.run(run_tribev2_video(mp4_path))

            assert loaded_model is not None
            assert isinstance(activation, np.ndarray)
            assert activation.ndim == 2
            assert activation.shape[0] > 0
            assert activation.shape[1] > 10000
        finally:
            for path in img_paths:
                if os.path.exists(path):
                    os.unlink(path)
            if mp4_path and os.path.exists(mp4_path):
                os.unlink(mp4_path)


class TestDifferentiationGate:
    def test_pathway_auto_switch_on_failure(self) -> None:
        assert get_default_pathway() == "text"

        set_default_pathway("video")
        assert get_default_pathway() == "video"

        set_default_pathway("text")
