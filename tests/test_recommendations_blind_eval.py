from __future__ import annotations

import json
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


def _allowed_scores(bundle: list[dict[str, object]]) -> set[float]:
    allowed_scores: set[float] = set()
    for screen in bundle:
        for circuit in screen["circuits"].values():
            allowed_scores.add(round(float(circuit["score"]), 1))
            allowed_scores.add(round(float(circuit["peak"]), 1))
        for region in screen["regions"]:
            allowed_scores.add(round(float(region["score"]), 1))
            allowed_scores.add(round(float(region["peak"]), 1))
    return allowed_scores


def _recommendations_cite_known_scores(bundle: list[dict[str, object]], recommendations) -> bool:
    allowed_scores = _allowed_scores(bundle)
    return all(
        round(recommendation.evidence.activation_score, 1) in allowed_scores
        for recommendation in recommendations.recommendations
    )


def _recommendations_use_valid_circuit_regions(recommendations) -> bool:
    return all(
        recommendation.evidence.circuit in ROI_CIRCUIT_MAP
        and recommendation.evidence.region in ROI_CIRCUIT_MAP[recommendation.evidence.circuit]
        for recommendation in recommendations.recommendations
    )


def build_blind_eval_metrics(
    high_bundle: list[dict[str, object]],
    low_bundle: list[dict[str, object]],
    recs_high,
    recs_low,
) -> dict[str, object]:
    high_text = " ".join(
        " ".join(filter(None, (rec.before, rec.after, rec.rationale)))
        for rec in recs_high.recommendations
    )
    low_text = " ".join(
        " ".join(filter(None, (rec.before, rec.after, rec.rationale)))
        for rec in recs_low.recommendations
    )
    return {
        "jaccard_similarity": round(_jaccard(high_text, low_text), 4),
        "recommendation_count_high": len(recs_high.recommendations),
        "recommendation_count_low": len(recs_low.recommendations),
        "cited_scores_verified": _recommendations_cite_known_scores(high_bundle, recs_high)
        and _recommendations_cite_known_scores(low_bundle, recs_low),
        "valid_circuit_region_pairs": _recommendations_use_valid_circuit_regions(recs_high)
        and _recommendations_use_valid_circuit_regions(recs_low),
    }


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

    metrics = build_blind_eval_metrics(high_bundle, low_bundle, recs_high, recs_low)
    print(f"BLIND_EVAL_METRICS={json.dumps(metrics, sort_keys=True)}")

    assert metrics["recommendation_count_high"] >= 1, (
        "high-cog-load profile produced no recommendations"
    )
    assert metrics["recommendation_count_low"] >= 1, (
        "low-cog-load profile produced no recommendations"
    )
    assert metrics["cited_scores_verified"] is True, (
        "Recommendations cited activation scores not present in the ROI bundles"
    )
    assert metrics["valid_circuit_region_pairs"] is True, (
        "Recommendations cited invalid circuit/region pairs"
    )
    assert metrics["jaccard_similarity"] < 0.4, (
        f"Jaccard {metrics['jaccard_similarity']:.3f} >= 0.4 — recs not differentiated by ROI profile"
    )
