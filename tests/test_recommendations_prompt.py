from __future__ import annotations


def _persona() -> dict[str, object]:
    return {
        "id": "p1",
        "name": "Test Persona",
        "demographics": {"age": 30, "role": "designer", "background": "x"},
        "psychographics": {"goals": ["ship"], "values": ["clarity"], "motivations": ["speed"]},
        "cognitive_state": {
            "attention_span": "medium",
            "stress_level": "moderate",
            "tech_literacy": "intermediate",
        },
        "environment": {"device": "desktop", "location": "office", "ambient": None},
    }


def _roi() -> list[dict[str, object]]:
    return [
        {
            "screen_index": 0,
            "circuits": {"Attention": {"score": 50.0, "peak": 60.0}},
            "regions": [],
        }
    ]


def _flow() -> dict[str, object]:
    return {"circuits": {"Attention": {"per_screen": [], "trend": "flat"}}}


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


class TestBuildRecUserPrompt:
    def test_includes_all_four_input_sections(self, sim_log_3_screens):
        from backend.services.recommendations import build_rec_user_prompt

        prompt = build_rec_user_prompt(_persona(), sim_log_3_screens.model_dump(), _roi(), _flow())
        lowered = prompt.lower()
        assert "persona" in lowered or "Test Persona" in prompt
        assert "simulation" in lowered or "screen_index" in prompt
        assert "roi" in lowered or "activation_score" in lowered or "Attention" in prompt
        assert "continuity" in lowered or "trend" in lowered

    def test_has_user_content_delimiter(self, sim_log_3_screens):
        from backend.services.recommendations import build_rec_user_prompt

        prompt = build_rec_user_prompt(_persona(), sim_log_3_screens.model_dump(), _roi(), _flow())
        assert "BEGIN USER CONTENT" in prompt
        assert "END USER CONTENT" in prompt

    def test_does_not_include_screen_image_data(self, sim_log_3_screens):
        from backend.services.recommendations import build_rec_user_prompt

        prompt = build_rec_user_prompt(_persona(), sim_log_3_screens.model_dump(), _roi(), _flow())
        assert not any(
            len(token) > 500 and token.replace("+", "").replace("/", "").isalnum()
            for token in prompt.split()
        )

    def test_includes_behavioral_coverage_requirements(self, sim_log_3_screens):
        from backend.services.recommendations import build_rec_user_prompt

        prompt = build_rec_user_prompt(
            _persona(),
            sim_log_3_screens.model_dump(),
            _trigger_heavy_roi(),
            _trigger_heavy_flow(),
        )

        assert "Behavioral coverage requirements inferred from the supplied data" in prompt
        assert "layout_flag required on screen 0" in prompt
        assert "note=\"Subtitle reread\"" in prompt
        assert "\"x_ratio\": 0.15" in prompt
        assert "memorability required on screen 1" in prompt
        assert "emotional_dropoff required on screen 2" in prompt

    def test_includes_prior_failure_reason_when_retrying(self, sim_log_3_screens):
        from backend.services.recommendations import build_rec_user_prompt

        prompt = build_rec_user_prompt(
            _persona(),
            sim_log_3_screens.model_dump(),
            _trigger_heavy_roi(),
            _trigger_heavy_flow(),
            prior_failure_reason="Recommendation bundle missing required behavioral coverage: layout_flag@screen_0",
        )

        assert "Previous attempt missed required behavioral coverage." in prompt
        assert "layout_flag@screen_0" in prompt


class TestBuildRecSystemPrompt:
    def test_contains_bad_and_good_examples(self):
        from backend.services.recommendations import REC_SYSTEM_PROMPT

        lowered = REC_SYSTEM_PROMPT.lower()
        assert "bad" in lowered or "don't" in lowered or "avoid" in lowered
        assert "good" in lowered or "do" in lowered or "must" in lowered

    def test_mentions_evidence_requirement(self):
        from backend.services.recommendations import REC_SYSTEM_PROMPT

        assert "evidence" in REC_SYSTEM_PROMPT.lower()
        assert "activation_score" in REC_SYSTEM_PROMPT
