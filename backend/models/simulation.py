from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class TargetRegion(BaseModel):
    x_ratio: float = Field(ge=0.0, le=1.0)
    y_ratio: float = Field(ge=0.0, le=1.0)
    width_ratio: float = Field(ge=0.0, le=1.0)
    height_ratio: float = Field(ge=0.0, le=1.0)


EventType = Literal["fixation", "scroll", "hesitation", "click_intent", "emotional_shift"]


class Event(BaseModel):
    timestamp_ms: int = Field(ge=0)
    type: EventType
    target_region: TargetRegion | None = None
    # Intensity scale: the model must emit floats directly from 0.0 to 1.0.
    intensity: float = Field(ge=0.0, le=1.0)
    note: str | None = None


class Screen(BaseModel):
    screen_index: int = Field(ge=0)
    narrative_text: str = Field(min_length=1)
    summary_emotional_state: str
    memorability_hypothesis: str
    events: list[Event] = Field(default_factory=list)


class SimulationLog(BaseModel):
    screens: list[Screen] = Field(min_length=1, max_length=5)


class HallucinationItem(BaseModel):
    screen_index: int
    narrative_claim: str
    reason: str


class GroundingVerdict(BaseModel):
    hallucinations: list[HallucinationItem] = Field(default_factory=list)
    verified_elements: list[str] = Field(default_factory=list)


class SchemaValidationFailure(Exception):
    """DeepSeek returned invalid JSON twice."""


class HallucinationError(Exception):
    """Grounding judge flagged unverifiable UI claims."""

    def __init__(self, items: list[HallucinationItem]) -> None:
        self.items = items
        super().__init__(self._format())

    def _format(self) -> str:
        return "; ".join(
            f"Narrative references '{item.narrative_claim}' not visible in screen {item.screen_index}"
            for item in self.items
        )


class DeepSeekClientError(Exception):
    """Sanitized API failure."""
