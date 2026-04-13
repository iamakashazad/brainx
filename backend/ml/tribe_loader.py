from __future__ import annotations

import asyncio
import logging
import os
from pathlib import Path
from typing import Any

from backend.core.config import settings

logger = logging.getLogger(__name__)

_model: Any | None = None
_model_lock = asyncio.Lock()


def _build_model(cache_folder: Path, device: str) -> Any:
    cache_folder = cache_folder.resolve()
    os.environ["HOME"] = cache_folder.as_posix()
    os.environ.setdefault("XDG_CACHE_HOME", (cache_folder / ".cache").as_posix())
    os.environ.setdefault("HF_HOME", (cache_folder / "huggingface").as_posix())

    hf_token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_HUB_TOKEN")
    if hf_token:
        os.environ.setdefault("HF_TOKEN", hf_token)
        os.environ.setdefault("HUGGING_FACE_HUB_TOKEN", hf_token)

    # Validate device — fall back to CPU if MPS requested but unreliable
    if device == "mps":
        import torch

        if torch.backends.mps.is_available():
            logger.warning(
                "MPS available but TRIBEv2 inference stalls on MPS — falling back to CPU"
            )
        device = "cpu"
    elif device == "cuda":
        import torch

        if not torch.cuda.is_available():
            logger.warning("CUDA requested but not available — falling back to CPU")
            device = "cpu"

    # Local VJEPA2 weights are staged into the HF hub cache layout at
    # model_cache/huggingface/hub/models--facebook--vjepa2-vitg-fpc64-256/ so that
    # AutoModel.from_pretrained("facebook/vjepa2-vitg-fpc64-256") resolves offline.
    local_vjepa_cache = (
        cache_folder
        / "huggingface"
        / "hub"
        / "models--facebook--vjepa2-vitg-fpc64-256"
    )
    if (local_vjepa_cache / "refs" / "main").exists():
        logger.info("VJEPA2 hub cache present at %s", local_vjepa_cache)

    from tribev2.demo_utils import TribeModel

    # The pretrained config.yaml hardcodes `device: cuda` on all four feature
    # extractors (text, image, audio, video). On CPU-only machines this causes
    # `neuralset.extractors.video.py` to call `.to("cuda")` during prepare(),
    # crashing with "Torch not compiled with CUDA enabled". Override them.
    extractor_device = device
    config_update = {
        "data.text_feature.device": extractor_device,
        "data.image_feature.image.device": extractor_device,
        "data.audio_feature.device": extractor_device,
        "data.video_feature.image.device": extractor_device,
    }

    model = TribeModel.from_pretrained(
        "facebook/tribev2",
        cache_folder=str(cache_folder),
        device=device,
        config_update=config_update,
    )
    return model


async def load_model(cache_folder: str | Path | None = None, device: str | None = None) -> Any:
    global _model

    if _model is not None:
        return _model

    async with _model_lock:
        if _model is not None:
            return _model

        resolved_cache = Path(cache_folder or settings.model_cache_path).expanduser()
        resolved_cache.mkdir(parents=True, exist_ok=True)

        loop = asyncio.get_running_loop()
        _model = await loop.run_in_executor(
            None,
            _build_model,
            resolved_cache,
            device or settings.device,
        )
        return _model


def get_model() -> Any:
    if _model is None:
        raise RuntimeError("Model not loaded")
    return _model


def is_model_loaded() -> bool:
    return _model is not None
