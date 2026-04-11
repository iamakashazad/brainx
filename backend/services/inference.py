from __future__ import annotations

import asyncio
import os
import tempfile
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import torch

from backend.ml.tribe_loader import get_model

gpu_executor = ThreadPoolExecutor(max_workers=1)


async def run_tribev2_text(text_content: str) -> np.ndarray:
    """Run TRIBEv2 via the text_path pathway."""
    loop = asyncio.get_running_loop()
    model = get_model()

    with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as handle:
        handle.write(text_content)
        text_path = handle.name

    def _infer() -> np.ndarray:
        try:
            with torch.inference_mode():
                df = model.get_events_dataframe(text_path=text_path)
                preds, _segments = model.predict(events=df)
            return preds.cpu().numpy()
        finally:
            if os.path.exists(text_path):
                os.unlink(text_path)

    return await loop.run_in_executor(gpu_executor, _infer)


async def run_tribev2_video(video_path: str) -> np.ndarray:
    """Run TRIBEv2 via the video_path pathway."""
    loop = asyncio.get_running_loop()
    model = get_model()

    def _infer() -> np.ndarray:
        with torch.inference_mode():
            df = model.get_events_dataframe(video_path=video_path)
            preds, _segments = model.predict(events=df)
        return preds.cpu().numpy()

    return await loop.run_in_executor(gpu_executor, _infer)
