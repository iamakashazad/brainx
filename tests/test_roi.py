from __future__ import annotations

import numpy as np
import pytest

from backend.services import roi_aggregation
from backend.services.roi_aggregation import (
    CIRCUIT_NAMES,
    ROI_CIRCUIT_MAP,
    SUBCORTICAL_LABELS,
    aggregate_roi_scores,
    aggregate_screen_roi,
    get_surf_atlas,
    rescale_to_0_100,
    verify_atlas_labels,
)


def _fake_surface_atlas_payload() -> dict[str, object]:
    roi_labels = [region for regions in ROI_CIRCUIT_MAP.values() for region in regions]
    filler = [f"Unused_{index}" for index in range(76 - len(roi_labels) - 1)]
    labels = [b"Unknown", *[label.encode("utf-8") for label in roi_labels], *filler]
    bilateral = np.resize(np.arange(1, len(roi_labels) + 1, dtype=np.int64), 20484)
    return {
        "map_left": bilateral[:10242],
        "map_right": bilateral[10242:],
        "labels": labels,
    }


@pytest.fixture
def fake_surface_fetch(monkeypatch: pytest.MonkeyPatch) -> dict[str, object]:
    payload = _fake_surface_atlas_payload()
    get_surf_atlas.cache_clear()
    monkeypatch.setattr(
        "backend.services.roi_aggregation.fetch_atlas_surf_destrieux",
        lambda **_kwargs: payload,
    )
    yield payload
    get_surf_atlas.cache_clear()


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


class TestSurfaceAtlas:
    def test_shapes(self, fake_surface_fetch: dict[str, object]) -> None:
        atlas = get_surf_atlas()
        assert atlas["map_left"].shape == (10242,)
        assert atlas["map_right"].shape == (10242,)
        assert len(atlas["labels"]) == 76

    def test_cached(self, fake_surface_fetch: dict[str, object]) -> None:
        before = get_surf_atlas.cache_info()
        atlas = get_surf_atlas()
        same_atlas = get_surf_atlas()
        after = get_surf_atlas.cache_info()
        assert atlas is same_atlas
        assert after.hits >= before.hits + 1

    def test_labels_are_strings(self, fake_surface_fetch: dict[str, object]) -> None:
        atlas = get_surf_atlas()
        assert all(isinstance(label, str) for label in atlas["labels"])

    def test_label_ids_within_range(self, fake_surface_fetch: dict[str, object]) -> None:
        atlas = get_surf_atlas()
        assert atlas["map_left"].max() < len(atlas["labels"])
        assert atlas["map_right"].max() < len(atlas["labels"])


class TestAggregateScreenROI:
    def test_shapes_returns_5_circuits_and_region_rows(
        self,
        fake_surface_fetch: dict[str, object],
    ) -> None:
        activation = np.random.rand(4, 20484)
        bundle = aggregate_screen_roi(activation, get_surf_atlas())
        assert set(bundle["circuits"].keys()) == {
            "Attention",
            "Cognitive Load",
            "Emotional Response",
            "Memory Encoding",
            "Reward",
        }
        assert 1 <= len(bundle["regions"]) <= 15
        for row in bundle["regions"]:
            assert set(row.keys()) == {"atlas_label", "circuit", "score", "peak"}
            assert row["circuit"] in bundle["circuits"]

    def test_vertex_count_mismatch_raises(
        self,
        fake_surface_fetch: dict[str, object],
    ) -> None:
        activation = np.zeros((2, 12345))
        with pytest.raises(ValueError, match="12345"):
            aggregate_screen_roi(activation, get_surf_atlas())

    def test_mean_and_peak_reductions(
        self,
        fake_surface_fetch: dict[str, object],
    ) -> None:
        activation = np.vstack([np.ones(20484), np.full(20484, 10.0)])
        bundle = aggregate_screen_roi(activation, get_surf_atlas())
        for row in bundle["regions"]:
            assert abs(row["score"] - 5.5) < 0.01
            assert abs(row["peak"] - 10.0) < 0.01

    def test_all_negative_peaks_are_not_clipped_to_zero(
        self,
        fake_surface_fetch: dict[str, object],
    ) -> None:
        activation = np.vstack([np.full(20484, -3.0), np.full(20484, -1.0)])
        bundle = aggregate_screen_roi(activation, get_surf_atlas())
        for circuit in bundle["circuits"].values():
            assert abs(circuit["peak"] - (-1.0)) < 0.01


class TestRescale:
    def test_bounds(self) -> None:
        bundles = [
            {
                "circuits": {
                    "Attention": {"score": -2.0, "peak": 0.0},
                    "Cognitive Load": {"score": 1.0, "peak": 2.0},
                    "Emotional Response": {"score": 3.0, "peak": 4.0},
                    "Memory Encoding": {"score": 5.0, "peak": 6.0},
                    "Reward": {"score": 7.0, "peak": 7.0},
                },
                "regions": [
                    {
                        "atlas_label": "S_front_inf",
                        "circuit": "Attention",
                        "score": -1.0,
                        "peak": 1.0,
                    }
                ],
            },
            {
                "circuits": {
                    "Attention": {"score": -1.5, "peak": 0.5},
                    "Cognitive Load": {"score": 1.5, "peak": 2.5},
                    "Emotional Response": {"score": 3.5, "peak": 4.5},
                    "Memory Encoding": {"score": 5.5, "peak": 6.5},
                    "Reward": {"score": 6.0, "peak": 6.5},
                },
                "regions": [
                    {
                        "atlas_label": "G_front_middle",
                        "circuit": "Cognitive Load",
                        "score": 2.0,
                        "peak": 2.5,
                    }
                ],
            },
            {
                "circuits": {
                    "Attention": {"score": 0.0, "peak": 1.0},
                    "Cognitive Load": {"score": 2.0, "peak": 3.0},
                    "Emotional Response": {"score": 4.0, "peak": 5.0},
                    "Memory Encoding": {"score": 6.0, "peak": 7.0},
                    "Reward": {"score": 2.5, "peak": 3.5},
                },
                "regions": [
                    {
                        "atlas_label": "G_orbital",
                        "circuit": "Reward",
                        "score": 6.5,
                        "peak": 7.0,
                    }
                ],
            },
        ]

        scaled = rescale_to_0_100(bundles)

        for bundle in scaled:
            for circuit in bundle["circuits"].values():
                assert 0.0 <= circuit["score"] <= 100.0
                assert 0.0 <= circuit["peak"] <= 100.0
            for row in bundle["regions"]:
                assert 0.0 <= row["score"] <= 100.0
                assert 0.0 <= row["peak"] <= 100.0

    def test_global_scope(self) -> None:
        bundles = [
            {
                "circuits": {"Attention": {"score": -2.0, "peak": 2.5}},
                "regions": [
                    {
                        "atlas_label": "S_front_inf",
                        "circuit": "Attention",
                        "score": -2.0,
                        "peak": 7.0,
                    }
                ],
            },
            {
                "circuits": {"Attention": {"score": 2.5, "peak": 7.0}},
                "regions": [
                    {
                        "atlas_label": "G_front_middle",
                        "circuit": "Attention",
                        "score": 2.5,
                        "peak": 0.0,
                    }
                ],
            },
        ]

        scaled = rescale_to_0_100(bundles)
        assert scaled[0]["circuits"]["Attention"]["score"] == 0.0
        assert scaled[0]["regions"][0]["peak"] == 100.0
        assert scaled[1]["circuits"]["Attention"]["score"] == pytest.approx(
            (2.5 - (-2.0)) / (7.0 - (-2.0)) * 100.0
        )

    def test_flat_bundle_normalizes_to_zero(self) -> None:
        bundles = [
            {
                "circuits": {
                    "Attention": {"score": 0.0, "peak": 0.0},
                    "Cognitive Load": {"score": 0.0, "peak": 0.0},
                    "Emotional Response": {"score": 0.0, "peak": 0.0},
                    "Memory Encoding": {"score": 0.0, "peak": 0.0},
                    "Reward": {"score": 0.0, "peak": 0.0},
                },
                "regions": [
                    {
                        "atlas_label": "S_front_inf",
                        "circuit": "Attention",
                        "score": 0.0,
                        "peak": 0.0,
                    }
                ],
            }
        ]

        scaled = rescale_to_0_100(bundles)
        assert scaled[0]["circuits"]["Attention"]["score"] == 0.0
        assert scaled[0]["circuits"]["Reward"]["peak"] == 0.0
        assert scaled[0]["regions"][0]["score"] == 0.0
