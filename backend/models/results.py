"""Phase 3 result_json envelope (D-19)."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

from backend.models.continuity import FlowContinuity

SCHEMA_VERSION = 1


class ActivationManifestEntry(BaseModel):
    screen_index: int = Field(ge=0)
    path: str
    shape: list[int]
    timesteps: int = Field(ge=1)


class CircuitScoreEntry(BaseModel):
    score: float = Field(ge=0.0, le=100.0)
    peak: float = Field(ge=0.0, le=100.0)


class RegionScoreEntry(BaseModel):
    atlas_label: str
    circuit: str
    score: float = Field(ge=0.0, le=100.0)
    peak: float = Field(ge=0.0, le=100.0)


class ScreenROI(BaseModel):
    screen_index: int = Field(ge=0)
    circuits: dict[str, CircuitScoreEntry]
    regions: list[RegionScoreEntry] = Field(default_factory=list)


class AnalysisResult(BaseModel):
    """Stable Phase 3 analyze result envelope.

    Recommendations stay JSON-dict-shaped in the envelope to avoid coupling this
    module back to the recommendations schema. Queue-stage code validates them
    through `Recommendations` before persisting the dumped payload here.
    """

    schema_version: Literal[1] = 1
    simulation: dict[str, Any]
    overlays: list[dict[str, Any]] = Field(default_factory=list)
    activations: list[ActivationManifestEntry] = Field(default_factory=list)
    roi: list[ScreenROI] = Field(default_factory=list)
    flow_continuity: FlowContinuity
    recommendations: list[dict[str, Any]] = Field(default_factory=list)
