from __future__ import annotations

import asyncio
import os
import tempfile
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import torch

from backend.ml.tribe_loader import get_model

_gpu_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="tribe-infer")


def get_gpu_executor() -> ThreadPoolExecutor:
    return _gpu_executor


def recycle_gpu_executor() -> None:
    """Replace the executor so a hung inference thread cannot block later jobs.

    The abandoned thread cannot be killed and may keep running until process
    restart; callers should log that caveat when recycling after a timeout.
    """
    global _gpu_executor
    _gpu_executor.shutdown(wait=False, cancel_futures=True)
    _gpu_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="tribe-infer")


def shutdown_gpu_executor() -> None:
    _gpu_executor.shutdown(wait=False, cancel_futures=True)


def _to_numpy(preds) -> np.ndarray:
    if isinstance(preds, torch.Tensor):
        return preds.detach().cpu().numpy()
    return np.asarray(preds)


async def run_tribev2_text(text_content: str) -> np.ndarray:
    """Run TRIBEv2 via the text_path pathway."""
    loop = asyncio.get_running_loop()
    model = get_model()

    def _infer() -> np.ndarray:
        # Created inside the executor task: a future cancelled by
        # recycle_gpu_executor(cancel_futures=True) never runs, so a file made
        # before submit was never cleaned up (and the write blocked the loop).
        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as handle:
            handle.write(text_content)
            text_path = handle.name
        try:
            with torch.inference_mode():
                df = model.get_events_dataframe(text_path=text_path)
                preds, _segments = model.predict(events=df)
            return _to_numpy(preds)
        finally:
            if os.path.exists(text_path):
                os.unlink(text_path)

    return await loop.run_in_executor(get_gpu_executor(), _infer)


async def run_tribev2_video(video_path: str) -> np.ndarray:
    """Run TRIBEv2 via the video_path pathway."""
    loop = asyncio.get_running_loop()
    model = get_model()

    def _infer() -> np.ndarray:
        with torch.inference_mode():
            df = model.get_events_dataframe(video_path=video_path)
            preds, _segments = model.predict(events=df)
        return _to_numpy(preds)

    return await loop.run_in_executor(get_gpu_executor(), _infer)
