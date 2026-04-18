from __future__ import annotations

import json

import httpx
import pytest
import respx

from backend.models.schemas import PersonaRead

pytestmark = pytest.mark.asyncio


def _roi() -> list[dict[str, object]]:
    return [
        {
            "screen_index": 0,
            "circuits": {
                "Attention": {"score": 50.0, "peak": 60.0},
                "Cognitive Load": {"score": 45.0, "peak": 55.0},
            },
            "regions": [
                {
                    "atlas_label": "S_front_inf",
                    "circuit": "Attention",
                    "score": 50.0,
                    "peak": 60.0,
                }
            ],
        }
    ]


def _flow() -> dict[str, object]:
    return {"circuits": {"Attention": {"per_screen": [], "trend": "flat"}}}


@pytest.fixture
def valid_rec_response_json() -> str:
    return json.dumps(
        {
            "recommendations": [
                {
                    "rec_type": "copy_rewrite",
                    "screen_index": 0,
                    "evidence": {
                        "circuit": "Attention",
                        "region": "S_front_inf",
                        "activation_score": 50.0,
                        "score_rank": "Moderate",
                    },
                    "before": "Welcome to our product",
                    "after": "Get started in 30 seconds",
                    "rationale": "Shortened headline reduces cognitive load; Attention is moderate (50).",
                }
            ]
        }
    )


@pytest.fixture
def mixed_rec_response_json() -> str:
    return json.dumps(
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
                        "x_ratio": 0.15,
                        "y_ratio": 0.32,
                        "width_ratio": 0.55,
                        "height_ratio": 0.12,
                    },
                    "element_description": "Subtitle reread",
                    "rationale": "The reread pattern signals cognitive overload on this screen.",
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
                    "rationale": "Emotional engagement drops on pricing and needs a confidence repair.",
                },
            ]
        }
    )


@pytest.fixture
def respx_mock():
    with respx.mock(assert_all_called=False) as router:
        yield router


class TestGenerateRecommendationsHappyPath:
    async def test_valid_response_parses_through(
        self,
        respx_mock,
        valid_rec_response_json: str,
        sim_log_3_screens,
        persona_model_fixture: PersonaRead,
        monkeypatch: pytest.MonkeyPatch,
    ):
        from backend.core.config import settings
        from backend.services.recommendations import generate_recommendations

        monkeypatch.setattr(settings, "deepseek_api_key", "deepseek-test")
        respx_mock.post("https://api.deepseek.com/chat/completions").mock(
            return_value=httpx.Response(
                200,
                json={
                    "choices": [{"message": {"content": valid_rec_response_json}}],
                    "usage": {"prompt_tokens": 100, "completion_tokens": 200},
                },
            )
        )
        result = await generate_recommendations(
            persona_model_fixture,
            sim_log_3_screens,
            _roi(),
            _flow(),
        )
        assert len(result.recommendations) == 1
        assert result.recommendations[0].evidence.activation_score == 50.0

    async def test_mixed_response_types_parse_through(
        self,
        respx_mock,
        mixed_rec_response_json: str,
        sim_log_3_screens,
        persona_model_fixture: PersonaRead,
        monkeypatch: pytest.MonkeyPatch,
    ):
        from backend.core.config import settings
        from backend.services.recommendations import generate_recommendations

        trigger_heavy_roi = [
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
        trigger_heavy_flow = {
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

        monkeypatch.setattr(settings, "deepseek_api_key", "deepseek-test")
        respx_mock.post("https://api.deepseek.com/chat/completions").mock(
            return_value=httpx.Response(
                200,
                json={"choices": [{"message": {"content": mixed_rec_response_json}}]},
            )
        )

        result = await generate_recommendations(
            persona_model_fixture,
            sim_log_3_screens,
            trigger_heavy_roi,
            trigger_heavy_flow,
        )

        rec_types = {rec.rec_type for rec in result.recommendations}
        assert {"layout_flag", "memorability", "emotional_dropoff"} <= rec_types
        layout_flag = next(rec for rec in result.recommendations if rec.rec_type == "layout_flag")
        assert layout_flag.target_region is not None
        assert layout_flag.element_description == "Subtitle reread"

    async def test_normalizes_invalid_region_to_valid_circuit_label(
        self,
        sim_log_3_screens,
        persona_model_fixture: PersonaRead,
        monkeypatch: pytest.MonkeyPatch,
    ):
        from backend.models.recommendations import Recommendations
        from backend.services.recommendations import generate_recommendations

        prompts: list[str] = []
        invalid_region_bundle = Recommendations.model_validate(
            {
                "recommendations": [
                    {
                        "rec_type": "copy_rewrite",
                        "screen_index": 0,
                        "evidence": {
                            "circuit": "Attention",
                            "region": "NotARealRegion",
                            "activation_score": 50.0,
                            "score_rank": "Moderate",
                        },
                        "before": "Start your journey today",
                        "after": "Start today",
                        "rationale": "Shorter copy sharpens the first-scan signal.",
                    }
                ]
            }
        )

        async def fake_completion(*, user: str, **_kwargs):
            prompts.append(user)
            return invalid_region_bundle

        monkeypatch.setattr("backend.services.recommendations.deepseek_text_completion", fake_completion)

        result = await generate_recommendations(
            persona_model_fixture,
            sim_log_3_screens,
            _roi(),
            _flow(),
        )

        assert len(prompts) == 1
        assert result.recommendations[0].evidence.circuit == "Attention"
        assert result.recommendations[0].evidence.region == "S_front_inf"

    async def test_retries_when_behavioral_coverage_is_missing(
        self,
        sim_log_3_screens,
        persona_model_fixture: PersonaRead,
        monkeypatch: pytest.MonkeyPatch,
    ):
        from backend.models.recommendations import Recommendations
        from backend.services.recommendations import generate_recommendations

        trigger_heavy_roi = [
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
                    "Cognitive Load": {"score": 84.0, "peak": 89.0},
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
                    },
                    {
                        "atlas_label": "G_front_middle",
                        "circuit": "Cognitive Load",
                        "score": 84.0,
                        "peak": 89.0,
                    },
                ],
            },
        ]
        trigger_heavy_flow = {
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
        first_attempt = Recommendations.model_validate(
            {
                "recommendations": [
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
                        "rationale": "Emotional engagement drops on pricing and needs a confidence repair.",
                    },
                ]
            }
        )
        second_attempt = Recommendations.model_validate(
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
                            "x_ratio": 0.15,
                            "y_ratio": 0.32,
                            "width_ratio": 0.55,
                            "height_ratio": 0.12,
                        },
                        "element_description": "Subtitle reread",
                        "rationale": "The reread pattern signals cognitive overload on this screen.",
                    },
                    {
                        "rec_type": "layout_flag",
                        "screen_index": 2,
                        "evidence": {
                            "circuit": "Cognitive Load",
                            "region": "G_front_middle",
                            "activation_score": 84.0,
                            "score_rank": "Very High",
                        },
                        "target_region": {
                            "x_ratio": 0.3,
                            "y_ratio": 0.8,
                            "width_ratio": 0.4,
                            "height_ratio": 0.1,
                        },
                        "element_description": "Sign up CTA",
                        "rationale": "The CTA region is overloaded despite low reward, so the layout needs simplification.",
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
                        "rationale": "Emotional engagement drops on pricing and needs a confidence repair.",
                    },
                ]
            }
        )
        prompts: list[str] = []
        results = iter((first_attempt, second_attempt))

        async def fake_completion(*, user: str, **_kwargs):
            prompts.append(user)
            return next(results)

        monkeypatch.setattr("backend.services.recommendations.deepseek_text_completion", fake_completion)

        result = await generate_recommendations(
            persona_model_fixture,
            sim_log_3_screens,
            trigger_heavy_roi,
            trigger_heavy_flow,
        )

        assert len(prompts) == 2
        assert "Previous attempt missed required behavioral coverage." in prompts[1]
        assert "layout_flag@screen_0" in prompts[1]
        rec_types = {rec.rec_type for rec in result.recommendations}
        assert {"layout_flag", "memorability", "emotional_dropoff"} <= rec_types


class TestGenerateRecommendationsRepairRetry:
    async def test_first_malformed_second_valid(
        self,
        respx_mock,
        valid_rec_response_json: str,
        sim_log_3_screens,
        persona_model_fixture: PersonaRead,
        monkeypatch: pytest.MonkeyPatch,
    ):
        from backend.core.config import settings
        from backend.services.recommendations import generate_recommendations

        monkeypatch.setattr(settings, "deepseek_api_key", "deepseek-test")
        malformed = '{"recommendations": [{"rec_type": "copy_rewrite"}]}'
        route = respx_mock.post("https://api.deepseek.com/chat/completions")
        route.mock(
            side_effect=[
                httpx.Response(200, json={"choices": [{"message": {"content": malformed}}]}),
                httpx.Response(
                    200,
                    json={"choices": [{"message": {"content": valid_rec_response_json}}]},
                ),
            ]
        )

        result = await generate_recommendations(
            persona_model_fixture,
            sim_log_3_screens,
            _roi(),
            _flow(),
        )
        assert len(result.recommendations) == 1
        assert route.call_count == 2

    async def test_second_malformed_raises_sanitized(
        self,
        respx_mock,
        sim_log_3_screens,
        persona_model_fixture: PersonaRead,
        monkeypatch: pytest.MonkeyPatch,
    ):
        from backend.core.config import settings
        from backend.models.simulation import DeepSeekClientError
        from backend.services.recommendations import generate_recommendations

        monkeypatch.setattr(settings, "deepseek_api_key", "deepseek-test")
        malformed = '{"recommendations": [{"rec_type": "copy_rewrite"}]}'
        route = respx_mock.post("https://api.deepseek.com/chat/completions")
        route.mock(
            side_effect=[
                httpx.Response(200, json={"choices": [{"message": {"content": malformed}}]}),
                httpx.Response(200, json={"choices": [{"message": {"content": malformed}}]}),
            ]
        )

        with pytest.raises(DeepSeekClientError):
            await generate_recommendations(
                persona_model_fixture,
                sim_log_3_screens,
                _roi(),
                _flow(),
            )


class TestGenerateRecommendationsErrorSanitization:
    async def test_invalid_activation_score_raises_sanitized(
        self,
        sim_log_3_screens,
        persona_model_fixture: PersonaRead,
        monkeypatch: pytest.MonkeyPatch,
    ):
        from backend.models.recommendations import Recommendations
        from backend.models.simulation import DeepSeekClientError
        from backend.services.recommendations import generate_recommendations

        invalid_score_bundle = Recommendations.model_validate(
            {
                "recommendations": [
                    {
                        "rec_type": "copy_rewrite",
                        "screen_index": 0,
                        "evidence": {
                            "circuit": "Attention",
                            "region": "S_front_inf",
                            "activation_score": 88.0,
                            "score_rank": "Very High",
                        },
                        "before": "Welcome to our product",
                        "after": "Get started in 30 seconds",
                        "rationale": "Shorter copy reduces friction.",
                    }
                ]
            }
        )

        async def fake_completion(**_kwargs):
            return invalid_score_bundle

        monkeypatch.setattr("backend.services.recommendations.deepseek_text_completion", fake_completion)

        with pytest.raises(DeepSeekClientError):
            await generate_recommendations(
                persona_model_fixture,
                sim_log_3_screens,
                _roi(),
                _flow(),
            )

    async def test_api_key_not_in_error(
        self,
        respx_mock,
        sim_log_3_screens,
        persona_model_fixture: PersonaRead,
        monkeypatch: pytest.MonkeyPatch,
    ):
        from backend.core.config import settings
        from backend.services.recommendations import generate_recommendations

        leaked_key = "sk-SECRET-FAKE-KEY-12345"
        monkeypatch.setattr(settings, "deepseek_api_key", leaked_key)
        respx_mock.post("https://api.deepseek.com/chat/completions").mock(
            return_value=httpx.Response(500, text=f"Bad upstream: {leaked_key}")
        )

        with pytest.raises(Exception) as exc_info:
            await generate_recommendations(
                persona_model_fixture,
                sim_log_3_screens,
                _roi(),
                _flow(),
            )

        assert leaked_key not in str(exc_info.value)
