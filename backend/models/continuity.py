"""Flow-level continuity Pydantic models (BRAIN-03, D-11)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

TrendTag = Literal["rising", "dropping", "flat", "volatile"]


class ContinuityPoint(BaseModel):
    screen_index: int = Field(ge=0)
    score_0_100: float = Field(ge=0.0, le=100.0)
    delta_from_prev: float


class CircuitContinuity(BaseModel):
    per_screen: list[ContinuityPoint] = Field(default_factory=list)
    trend: TrendTag


class FlowContinuity(BaseModel):
    """Flow-level continuity for all named circuits."""

    circuits: dict[str, CircuitContinuity] = Field(default_factory=dict)
