from __future__ import annotations

import asyncio
import os
from pathlib import Path
from typing import Any

from backend.core.config import settings

_model: Any | None = None
_model_lock = asyncio.Lock()


def _build_model(cache_folder: Path, device: str) -> Any:
    cache_folder = cache_folder.resolve()
    os.environ["HOME"] = cache_folder.as_posix()
    os.environ.setdefault("XDG_CACHE_HOME", (cache_folder / ".cache").as_posix())
    os.environ.setdefault("HF_HOME", (cache_folder / "huggingface").as_posix())

    from tribev2.demo_utils import TribeModel

    model = TribeModel.from_pretrained(
        "facebook/tribev2",
        cache_folder=str(cache_folder),
        device=device,
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
