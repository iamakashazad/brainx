from __future__ import annotations

from pathlib import Path
from typing import Protocol


class VisionProvider(Protocol):
    async def analyze(
        self,
        images: list[Path],
        prompt: str,
        schema_hint: dict | None = None,
        max_tokens: int = 4000,
        temperature: float = 0.6,
    ) -> dict | str:
        """Return raw model output for caller-side validation and repair."""
