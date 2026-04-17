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
