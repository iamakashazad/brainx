"""Deterministic flow continuity service (BRAIN-03, D-11, D-12)."""

from __future__ import annotations

from typing import Literal

from backend.models.continuity import CircuitContinuity, ContinuityPoint, FlowContinuity
from backend.services.roi_aggregation import CIRCUIT_NAMES

DELTA_FLOOR: float = 5.0
VOLATILITY_FLIPS_MIN: int = 2

TrendTag = Literal["rising", "dropping", "flat", "volatile"]


def classify_trend(scores_0_100: list[float]) -> TrendTag:
    """Classify a score series using module-level continuity thresholds."""

    if len(scores_0_100) < 2:
        return "flat"

    deltas = [
        scores_0_100[index] - scores_0_100[index - 1]
        for index in range(1, len(scores_0_100))
    ]
    significant = [delta for delta in deltas if abs(delta) >= DELTA_FLOOR]
    if not significant:
        return "flat"

    flips = sum(
        1
        for index in range(1, len(significant))
        if (significant[index] > 0) != (significant[index - 1] > 0)
    )
    if flips >= VOLATILITY_FLIPS_MIN:
        return "volatile"
    if all(delta > 0 for delta in significant):
        return "rising"
    if all(delta < 0 for delta in significant):
        return "dropping"
    return "volatile"


def compute_flow_continuity(roi_per_screen: list[dict]) -> FlowContinuity:
    """Build per-circuit continuity points from rescaled ROI screen bundles."""

    sorted_screens = sorted(roi_per_screen, key=lambda entry: entry["screen_index"])
    circuits: dict[str, CircuitContinuity] = {}

    for circuit_name in CIRCUIT_NAMES:
        points: list[ContinuityPoint] = []
        previous_score: float | None = None
        for entry in sorted_screens:
            screen_circuits = entry.get("circuits", {})
            circuit_values = screen_circuits.get(circuit_name, {})
            score = float(circuit_values.get("score", 0.0))
            delta = 0.0 if previous_score is None else score - previous_score
            points.append(
                ContinuityPoint(
                    screen_index=int(entry["screen_index"]),
                    score_0_100=score,
                    delta_from_prev=delta,
                )
            )
            previous_score = score

        circuits[circuit_name] = CircuitContinuity(
            per_screen=points,
            trend=classify_trend([point.score_0_100 for point in points]),
        )

    return FlowContinuity(circuits=circuits)
