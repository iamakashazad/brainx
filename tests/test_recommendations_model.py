from __future__ import annotations

import pytest
from pydantic import ValidationError


def _evidence() -> dict[str, object]:
    return {
        "circuit": "Attention",
        "region": "S_front_inf",
        "activation_score": 50.0,
        "score_rank": "Moderate",
    }


class TestRecommendationsPydantic:
    def test_evidence_required(self):
        from backend.models.recommendations import Recommendation

        with pytest.raises(ValidationError):
            Recommendation(rec_type="copy_rewrite", screen_index=0, rationale="test")

    def test_rec_type_discriminator_values(self):
        from backend.models.recommendations import Recommendation

        for rec_type in ("copy_rewrite", "layout_flag", "memorability", "emotional_dropoff"):
            recommendation = Recommendation(
                rec_type=rec_type,
                screen_index=0,
                evidence=_evidence(),
                rationale="test rationale",
            )
            assert recommendation.rec_type == rec_type

        with pytest.raises(ValidationError):
            Recommendation(
                rec_type="unknown_type",
                screen_index=0,
                evidence=_evidence(),
                rationale="test",
            )

    def test_screen_index_bounds(self):
        from backend.models.recommendations import Recommendation

        for screen_index in (0, 4):
            Recommendation(
                rec_type="copy_rewrite",
                screen_index=screen_index,
                evidence=_evidence(),
                rationale="test",
            )

        with pytest.raises(ValidationError):
            Recommendation(
                rec_type="copy_rewrite",
                screen_index=5,
                evidence=_evidence(),
                rationale="test",
            )

        with pytest.raises(ValidationError):
            Recommendation(
                rec_type="copy_rewrite",
                screen_index=-1,
                evidence=_evidence(),
                rationale="test",
            )

    def test_activation_score_bounds_0_100(self):
        from backend.models.recommendations import RecEvidence

        with pytest.raises(ValidationError):
            RecEvidence(
                circuit="Attention",
                region="S_front_inf",
                activation_score=101.0,
                score_rank="Very High",
            )

        with pytest.raises(ValidationError):
            RecEvidence(
                circuit="Attention",
                region="S_front_inf",
                activation_score=-1.0,
                score_rank="Low",
            )

    def test_rationale_min_length(self):
        from backend.models.recommendations import Recommendation

        with pytest.raises(ValidationError):
            Recommendation(
                rec_type="copy_rewrite",
                screen_index=0,
                evidence=_evidence(),
                rationale="",
            )


class TestRankScore:
    def test_cutoffs(self):
        from backend.models.recommendations import rank_score

        assert rank_score(0.0) == "Low"
        assert rank_score(24.9) == "Low"
        assert rank_score(25.0) == "Moderate"
        assert rank_score(49.9) == "Moderate"
        assert rank_score(50.0) == "High"
        assert rank_score(74.9) == "High"
        assert rank_score(75.0) == "Very High"
        assert rank_score(100.0) == "Very High"


class TestScoreRankThresholdsIsModuleLevel:
    def test_constants_defined(self):
        import backend.models.recommendations as rec_mod

        assert hasattr(rec_mod, "SCORE_RANK_THRESHOLDS")
        assert isinstance(rec_mod.SCORE_RANK_THRESHOLDS, dict)
        assert set(rec_mod.SCORE_RANK_THRESHOLDS.keys()) == {"Low", "Moderate", "High"}
