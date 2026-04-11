from __future__ import annotations

import numpy as np

from backend.services import roi_aggregation
from backend.services.roi_aggregation import (
    CIRCUIT_NAMES,
    ROI_CIRCUIT_MAP,
    SUBCORTICAL_LABELS,
    aggregate_roi_scores,
    verify_atlas_labels,
)


class TestROICircuitMap:
    def test_five_circuits_defined(self) -> None:
        assert len(ROI_CIRCUIT_MAP) == 5
        assert set(CIRCUIT_NAMES) == {
            "Attention",
            "Cognitive Load",
            "Emotional Response",
            "Memory Encoding",
            "Reward",
        }

    def test_no_brodmann_codes_in_names(self) -> None:
        for name in ROI_CIRCUIT_MAP:
            assert "brodmann" not in name.lower()
            assert "ba" not in name.lower()

    def test_no_subcortical_labels_in_regions(self) -> None:
        region_text = " ".join(region for regions in ROI_CIRCUIT_MAP.values() for region in regions).lower()
        for label in SUBCORTICAL_LABELS:
            assert label.lower() not in region_text


class TestROIAggregation:
    def test_aggregate_roi_scores(self) -> None:
        atlas_labels = [
            "S_front_inf",
            "G_front_middle",
            "G_insular_short",
            "G_oc-temp_med-Parahip",
            "G_orbital",
            "Unknown",
        ]
        activation = np.array([0.8, 0.4, 0.3, 0.6, 0.9, 0.1])

        scores = aggregate_roi_scores(activation, atlas_labels)

        assert set(scores) == set(CIRCUIT_NAMES)
        assert scores["Attention"]["score"] > 0
        assert scores["Reward"]["peak"] == 0.9

    def test_verify_atlas_labels_returns_mapping(self) -> None:
        roi_aggregation.get_atlas_labels = lambda: [  # type: ignore[assignment]
            "S_front_inf",
            "G_front_middle",
            "G_insular_short",
            "G_oc-temp_med-Parahip",
            "G_orbital",
        ]
        missing = verify_atlas_labels()
        assert isinstance(missing, dict)
