from __future__ import annotations

import json

import httpx
import pytest
import respx
from pydantic import ValidationError

from backend.models.recommendations import Recommendation, Recommendations
from backend.models.simulation import Event, Screen, SimulationLog, TargetRegion


def _trigger_heavy_sim_log() -> SimulationLog:
    return SimulationLog(
        screens=[
            Screen(
                screen_index=0,
                narrative_text="The user stalls on a dense feature wall and skips past the CTA.",
                summary_emotional_state="tense",
                memorability_hypothesis="medium",
                events=[
                    Event(
                        timestamp_ms=1000,
                        type="hesitation",
                        target_region=TargetRegion(
                            x_ratio=0.12,
                            y_ratio=0.28,
                            width_ratio=0.7,
                            height_ratio=0.22,
                        ),
                        intensity=0.92,
                        note="Feature grid overload",
                    )
                ],
            ),
            Screen(
                screen_index=1,
                narrative_text="The user barely encodes the offer and cannot recall the value prop.",
                summary_emotional_state="flat",
                memorability_hypothesis="low",
                events=[],
            ),
            Screen(
                screen_index=2,
                narrative_text="Interest falls sharply when pricing appears and confidence collapses.",
                summary_emotional_state="discouraged",
                memorability_hypothesis="medium",
                events=[
                    Event(
                        timestamp_ms=2300,
                        type="emotional_shift",
                        target_region=TargetRegion(
                            x_ratio=0.24,
                            y_ratio=0.66,
                            width_ratio=0.5,
                            height_ratio=0.18,
                        ),
                        intensity=0.85,
                        note="Pricing block confidence drop",
                    )
                ],
            ),
        ]
    )


def _trigger_heavy_roi() -> list[dict[str, object]]:
    return [
        {
            "screen_index": 0,
            "circuits": {
                "Attention": {"score": 58.0, "peak": 63.0},
                "Cognitive Load": {"score": 84.0, "peak": 90.0},
                "Emotional Response": {"score": 63.0, "peak": 70.0},
                "Memory Encoding": {"score": 52.0, "peak": 58.0},
                "Reward": {"score": 24.0, "peak": 30.0},
            },
            "regions": [
                {
                    "atlas_label": "G_front_middle",
                    "circuit": "Cognitive Load",
                    "score": 84.0,
                    "peak": 90.0,
                }
            ],
        },
        {
            "screen_index": 1,
            "circuits": {
                "Attention": {"score": 42.0, "peak": 48.0},
                "Cognitive Load": {"score": 51.0, "peak": 59.0},
                "Emotional Response": {"score": 39.0, "peak": 45.0},
                "Memory Encoding": {"score": 18.0, "peak": 26.0},
                "Reward": {"score": 34.0, "peak": 40.0},
            },
            "regions": [
                {
                    "atlas_label": "G_oc-temp_med-Parahip",
                    "circuit": "Memory Encoding",
                    "score": 18.0,
                    "peak": 26.0,
                }
            ],
        },
        {
            "screen_index": 2,
            "circuits": {
                "Attention": {"score": 36.0, "peak": 42.0},
                "Cognitive Load": {"score": 60.0, "peak": 67.0},
                "Emotional Response": {"score": 21.0, "peak": 30.0},
                "Memory Encoding": {"score": 28.0, "peak": 34.0},
                "Reward": {"score": 19.0, "peak": 25.0},
            },
            "regions": [
                {
                    "atlas_label": "S_cingul-Marginalis",
                    "circuit": "Emotional Response",
                    "score": 21.0,
                    "peak": 30.0,
                }
            ],
        },
    ]


def _trigger_heavy_flow() -> dict[str, object]:
    return {
        "circuits": {
            "Emotional Response": {
                "per_screen": [
                    {"screen_index": 0, "score_0_100": 63.0, "delta_from_prev": 0.0},
                    {"screen_index": 1, "score_0_100": 39.0, "delta_from_prev": -24.0},
                    {"screen_index": 2, "score_0_100": 21.0, "delta_from_prev": -18.0},
                ],
                "trend": "dropping",
            }
        }
    }


def _copy_only_response_json() -> str:
    return json.dumps(
        {
            "recommendations": [
                {
                    "rec_type": "copy_rewrite",
                    "screen_index": 0,
                    "evidence": {
                        "circuit": "Cognitive Load",
                        "region": "G_front_middle",
                        "activation_score": 84.0,
                        "score_rank": "Very High",
                    },
                    "before": "Explore every feature across ten dense cards right now",
                    "after": "See the three features that matter first",
                    "rationale": "Condense the feature wall so the first scan is easier to parse.",
                }
            ]
        }
    )


def _behaviorally_complete_bundle() -> Recommendations:
    return Recommendations.model_validate(
        {
            "recommendations": [
                {
                    "rec_type": "layout_flag",
                    "screen_index": 0,
                    "evidence": {
                        "circuit": "Cognitive Load",
                        "region": "G_front_middle",
                        "activation_score": 84.0,
                        "score_rank": "Very High",
                    },
                    "target_region": {
                        "x_ratio": 0.12,
                        "y_ratio": 0.28,
                        "width_ratio": 0.7,
                        "height_ratio": 0.22,
                    },
                    "element_description": "Feature grid overload",
                    "rationale": "The dense feature wall is overwhelming the scan path.",
                },
                {
                    "rec_type": "memorability",
                    "screen_index": 1,
                    "evidence": {
                        "circuit": "Memory Encoding",
                        "region": "G_oc-temp_med-Parahip",
                        "activation_score": 18.0,
                        "score_rank": "Low",
                    },
                    "rationale": "This screen is likely to be forgotten unless the value prop is isolated.",
                },
                {
                    "rec_type": "emotional_dropoff",
                    "screen_index": 2,
                    "evidence": {
                        "circuit": "Emotional Response",
                        "region": "S_cingul-Marginalis",
                        "activation_score": 21.0,
                        "score_rank": "Low",
                    },
                    "rationale": "Emotional engagement drops on the pricing reveal and needs a confidence repair.",
                },
            ]
        }
    )


@pytest.fixture
def respx_mock():
    with respx.mock(assert_all_called=False) as router:
        yield router


@pytest.mark.asyncio
async def test_trigger_heavy_bundle_rejects_copy_only_output(
    respx_mock,
    persona_model_fixture,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from backend.core.config import settings
    from backend.models.simulation import DeepSeekClientError
    from backend.services.recommendations import generate_recommendations

    monkeypatch.setattr(settings, "deepseek_api_key", "deepseek-test")
    respx_mock.post("https://api.deepseek.com/chat/completions").mock(
        return_value=httpx.Response(
            200,
            json={"choices": [{"message": {"content": _copy_only_response_json()}}]},
        )
    )

    with pytest.raises(DeepSeekClientError):
        await generate_recommendations(
            persona_model_fixture,
            _trigger_heavy_sim_log(),
            _trigger_heavy_roi(),
            _trigger_heavy_flow(),
        )


def test_layout_flag_requires_simulation_identifier() -> None:
    with pytest.raises(ValidationError):
        Recommendation.model_validate(
            {
                "rec_type": "layout_flag",
                "screen_index": 0,
                "evidence": {
                    "circuit": "Cognitive Load",
                    "region": "G_front_middle",
                    "activation_score": 84.0,
                    "score_rank": "Very High",
                },
                "rationale": "Flag the overloaded layout.",
            }
        )


def test_behavioral_coverage_accepts_layout_flag_memorability_and_emotional_dropoff() -> None:
    from backend.services.recommendations import validate_behavioral_coverage

    validate_behavioral_coverage(
        _trigger_heavy_sim_log(),
        _trigger_heavy_roi(),
        _trigger_heavy_flow(),
        _behaviorally_complete_bundle(),
    )
