from __future__ import annotations

import logging
from pathlib import Path

from pydantic import ValidationError

from backend.core.config import settings
from backend.models.content import Content, ContentType
from backend.models.simulation import (
    DeepSeekClientError,
    GroundingVerdict,
    HallucinationError,
    SimulationLog,
)
from backend.services.vision_providers import get_provider

logger = logging.getLogger(__name__)

JUDGE_SYSTEM = """You verify whether a narrative about UI screens references only visible elements.

Output JSON matching this schema:
{
  "hallucinations": [{"screen_index": int, "narrative_claim": str, "reason": str}],
  "verified_elements": [str]
}

Rules:
- Flag claims about concrete UI elements (buttons, text, images, icons, forms) that are NOT visible.
- Do NOT flag emotional or behavioral descriptions (e.g., "user feels rushed", "pauses to think").
- If a claim is ambiguous or you're uncertain, flag it as a hallucination.
- Return empty hallucinations array only if EVERY UI-element claim is verifiable.
"""


def _resolve_image_paths(content: Content) -> list[Path]:
    base = settings.uploads_dir / content.id
    if content.content_type == ContentType.UI_SCREENS.value:
        return [base / f"screen_{index}.jpg" for index in range(1, (content.screen_count or 0) + 1)]
    if content.content_type == ContentType.STATIC.value:
        return [base / "image.jpg"]
    return []


async def judge(content: Content, sim_log: SimulationLog) -> GroundingVerdict:
    if content.content_type == ContentType.TEXT.value:
        return GroundingVerdict(hallucinations=[], verified_elements=[])

    narratives = "\n\n".join(
        f"Screen {screen.screen_index}:\n{screen.narrative_text}" for screen in sim_log.screens
    )
    provider = get_provider()
    try:
        raw = await provider.analyze(
            images=_resolve_image_paths(content),
            prompt=(
                f"{JUDGE_SYSTEM}\n\nFor each screen, the simulator produced this narrative:\n\n{narratives}"
            ),
            schema_hint=GroundingVerdict.model_json_schema(),
            max_tokens=1200,
            temperature=0.2,
        )
        if isinstance(raw, str):
            verdict = GroundingVerdict.model_validate_json(raw)
        else:
            verdict = GroundingVerdict.model_validate(raw)
    except (ValidationError, DeepSeekClientError, OSError) as exc:
        logger.error("Grounding judge failed", exc_info=exc)
        raise HallucinationError([]) from exc

    if verdict.hallucinations:
        raise HallucinationError(verdict.hallucinations)
    return verdict
