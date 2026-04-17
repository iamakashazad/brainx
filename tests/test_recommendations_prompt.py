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
