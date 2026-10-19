from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator


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

    @model_validator(mode="after")
    def _screen_indices_are_zero_based_and_contiguous(self) -> "SimulationLog":
        # Downstream code keys activations (screen_{i+1}.npy), the ROI map and
        # recommendation bounds on screen_index, so duplicates or gaps silently
        # overwrite or drop screens. A consistently 1-based log is the common LLM
        # slip and is safe to renumber; anything else is rejected (and retried).
        indices = [screen.screen_index for screen in self.screens]
        count = len(indices)
        if sorted(indices) == list(range(1, count + 1)):
            for screen in self.screens:
                screen.screen_index -= 1
        elif sorted(indices) != list(range(count)):
            raise ValueError(
                f"screen_index values must be exactly 0..{count - 1} with no duplicates, got {indices}"
            )
        self.screens.sort(key=lambda screen: screen.screen_index)
        return self


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
