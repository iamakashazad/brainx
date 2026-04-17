from __future__ import annotations

import os
from importlib import reload

import pytest

from backend.services.roi_aggregation import ROI_CIRCUIT_MAP

DEEPSEEK_AVAILABLE = bool(os.environ.get("DEEPSEEK_API_KEY"))
skip_without_live_key = pytest.mark.skipif(
    not DEEPSEEK_AVAILABLE,
    reason="DEEPSEEK_API_KEY not set — blind-eval requires a live DeepSeek call (D-18)",
)


def _make_high_cog_load_low_reward_bundle() -> list[dict[str, object]]:
    return [
        {
            "screen_index": index,
            "circuits": {
                "Attention": {"score": 50.0, "peak": 60.0},
                "Cognitive Load": {"score": 85.0 + index, "peak": 95.0},
                "Emotional Response": {"score": 40.0, "peak": 50.0},
                "Memory Encoding": {"score": 45.0, "peak": 55.0},
                "Reward": {"score": 10.0 + index, "peak": 15.0},
            },
            "regions": [
                {
                    "atlas_label": "G_front_middle",
                    "circuit": "Cognitive Load",
                    "score": 85.0 + index,
                    "peak": 95.0,
                },
                {
                    "atlas_label": "G_orbital",
                    "circuit": "Reward",
                    "score": 10.0 + index,
                    "peak": 15.0,
                },
            ],
        }
        for index in range(3)
    ]


def _make_low_cog_load_high_reward_bundle() -> list[dict[str, object]]:
    return [
        {
            "screen_index": index,
            "circuits": {
                "Attention": {"score": 50.0, "peak": 60.0},
                "Cognitive Load": {"score": 12.0 + index, "peak": 18.0},
                "Emotional Response": {"score": 60.0, "peak": 70.0},
                "Memory Encoding": {"score": 55.0, "peak": 65.0},
                "Reward": {"score": 80.0 + index, "peak": 88.0},
            },
            "regions": [
                {
                    "atlas_label": "G_front_middle",
                    "circuit": "Cognitive Load",
                    "score": 12.0 + index,
                    "peak": 18.0,
                },
                {
                    "atlas_label": "G_orbital",
                    "circuit": "Reward",
                    "score": 80.0 + index,
                    "peak": 88.0,
                },
            ],
        }
        for index in range(3)
    ]


def _jaccard(a: str, b: str) -> float:
    tokens_a = set(a.lower().split())
    tokens_b = set(b.lower().split())
    union = tokens_a | tokens_b
    return len(tokens_a & tokens_b) / len(union) if union else 0.0


def _flow() -> dict[str, object]:
    return {"circuits": {name: {"per_screen": [], "trend": "flat"} for name in ROI_CIRCUIT_MAP}}


def test_skips_cleanly_without_key(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    import tests.test_recommendations_blind_eval as module

    reloaded = reload(module)
    assert reloaded.DEEPSEEK_AVAILABLE is False


@skip_without_live_key
@pytest.mark.asyncio
async def test_blind_eval_differentiates_opposite_profiles(sim_log_3_screens, persona_model_fixture):
    from backend.services.recommendations import generate_recommendations

    high_bundle = _make_high_cog_load_low_reward_bundle()
    low_bundle = _make_low_cog_load_high_reward_bundle()

    recs_high = await generate_recommendations(
        persona_model_fixture,
        sim_log_3_screens,
        high_bundle,
        _flow(),
    )
    recs_low = await generate_recommendations(
        persona_model_fixture,
        sim_log_3_screens,
        low_bundle,
        _flow(),
    )

    assert len(recs_high.recommendations) >= 1, "high-cog-load profile produced no recommendations"
    assert len(recs_low.recommendations) >= 1, "low-cog-load profile produced no recommendations"

    for bundle, recommendations, label in (
        (high_bundle, recs_high, "high"),
        (low_bundle, recs_low, "low"),
    ):
        allowed_scores: set[float] = set()
        for screen in bundle:
            for circuit in screen["circuits"].values():
                allowed_scores.add(round(float(circuit["score"]), 1))
                allowed_scores.add(round(float(circuit["peak"]), 1))
            for region in screen["regions"]:
                allowed_scores.add(round(float(region["score"]), 1))
                allowed_scores.add(round(float(region["peak"]), 1))
        for recommendation in recommendations.recommendations:
            cited = round(recommendation.evidence.activation_score, 1)
            assert cited in allowed_scores, (
                f"[{label}] rec cites activation_score {cited} not in input bundle. "
                f"Allowed: {sorted(allowed_scores)[:20]}..."
            )

    def rec_text(recommendations) -> str:
        return " ".join(
            " ".join(
                filter(None, (recommendation.before, recommendation.after, recommendation.rationale))
            )
            for recommendation in recommendations.recommendations
        )

    jaccard = _jaccard(rec_text(recs_high), rec_text(recs_low))
    assert jaccard < 0.4, f"Jaccard {jaccard:.3f} >= 0.4 — recs not differentiated by ROI profile"

    for recommendations, label in ((recs_high, "high"), (recs_low, "low")):
        for recommendation in recommendations.recommendations:
            assert recommendation.evidence.circuit in ROI_CIRCUIT_MAP, (
                f"[{label}] rec cites unknown circuit {recommendation.evidence.circuit}"
            )
            assert recommendation.evidence.region in ROI_CIRCUIT_MAP[recommendation.evidence.circuit], (
                f"[{label}] rec cites region {recommendation.evidence.region} not in circuit "
                f"{recommendation.evidence.circuit}"
            )
