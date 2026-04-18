"""Phase 3 recommendations Pydantic v2 schema (REC-01..REC-04, D-09).

Flat discriminated list with mandatory `evidence` on every recommendation.
The blind-eval test (D-17) gates on every evidence.activation_score being
numerically present in the input ROI bundle.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator

from backend.models.simulation import TargetRegion

RecType = Literal["copy_rewrite", "layout_flag", "memorability", "emotional_dropoff"]
ScoreRank = Literal["Low", "Moderate", "High", "Very High"]

# Shared with downstream display logic so the qualitative buckets stay consistent.
SCORE_RANK_THRESHOLDS: dict[str, int] = {"Low": 25, "Moderate": 50, "High": 75}


def rank_score(score_0_100: float) -> ScoreRank:
    """Map a 0..100 score to its qualitative rank."""
    if score_0_100 < SCORE_RANK_THRESHOLDS["Low"]:
        return "Low"
    if score_0_100 < SCORE_RANK_THRESHOLDS["Moderate"]:
        return "Moderate"
    if score_0_100 < SCORE_RANK_THRESHOLDS["High"]:
        return "High"
    return "Very High"


class RecEvidence(BaseModel):
    """Required brain-grounding for every recommendation."""

    circuit: str
    region: str
    activation_score: float = Field(ge=0.0, le=100.0)
    score_rank: ScoreRank


class Recommendation(BaseModel):
    rec_type: RecType
    screen_index: int = Field(ge=0, le=4)
    evidence: RecEvidence
    target_region: TargetRegion | None = None
    element_description: str | None = None
    before: str | None = None
    after: str | None = None
    rationale: str = Field(min_length=1)

    @model_validator(mode="after")
    def validate_rec_type_fields(self) -> "Recommendation":
        if self.rec_type != "layout_flag":
            return self

        has_target_region = self.target_region is not None
        has_element_description = bool(self.element_description and self.element_description.strip())
        if not has_target_region and not has_element_description:
            raise ValueError(
                "layout_flag recommendations must include target_region and/or element_description"
            )
        return self


class Recommendations(BaseModel):
    """Flat discriminated list. Every recommendation must cite evidence."""

    recommendations: list[Recommendation] = Field(default_factory=list, max_length=50)
