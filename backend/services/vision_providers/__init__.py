from __future__ import annotations

from backend.core.config import settings
from backend.services.vision_providers.base import VisionProvider
from backend.services.vision_providers.replicate import ReplicateVL2Backend


def get_provider() -> VisionProvider:
    if settings.vision_provider == "replicate":
        return ReplicateVL2Backend()
    raise ValueError(f"Unsupported vision provider: {settings.vision_provider}")
