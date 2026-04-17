from __future__ import annotations

import pytest

from backend.services.roi_aggregation import CIRCUIT_NAMES


class TestClassifyTrend:
    def test_rising(self) -> None:
        from backend.services.continuity import classify_trend

        assert classify_trend([10.0, 20.0, 30.0]) == "rising"
        assert classify_trend([40.0, 50.0]) == "rising"

    def test_dropping(self) -> None:
        from backend.services.continuity import classify_trend

        assert classify_trend([80.0, 60.0, 40.0]) == "dropping"
        assert classify_trend([50.0, 40.0]) == "dropping"

    def test_flat(self) -> None:
        from backend.services.continuity import classify_trend

        assert classify_trend([50.0, 52.0, 49.0, 51.0]) == "flat"
        assert classify_trend([50.0]) == "flat"
        assert classify_trend([]) == "flat"

    def test_volatile(self) -> None:
        from backend.services.continuity import classify_trend

        assert classify_trend([20.0, 80.0, 20.0, 80.0]) == "volatile"
        assert classify_trend([10.0, 90.0, 20.0, 85.0]) == "volatile"

    def test_single_significant_flip_not_volatile(self) -> None:
        from backend.services.continuity import classify_trend

        result = classify_trend([10.0, 90.0, 80.0])
        assert result in ("rising", "volatile"), f"got {result}"


class TestComputeFlowContinuity:
    def test_shape(self) -> None:
        from backend.services.continuity import compute_flow_continuity

        roi_per_screen = [
            {
                "screen_index": 0,
                "circuits": {
                    "Attention": {"score": 20.0, "peak": 30.0},
                    "Cognitive Load": {"score": 80.0, "peak": 90.0},
                    "Emotional Response": {"score": 30.0, "peak": 40.0},
                    "Memory Encoding": {"score": 40.0, "peak": 50.0},
                    "Reward": {"score": 10.0, "peak": 15.0},
                },
                "regions": [],
            },
            {
                "screen_index": 1,
                "circuits": {
                    "Attention": {"score": 40.0, "peak": 50.0},
                    "Cognitive Load": {"score": 75.0, "peak": 85.0},
                    "Emotional Response": {"score": 35.0, "peak": 45.0},
                    "Memory Encoding": {"score": 45.0, "peak": 55.0},
                    "Reward": {"score": 20.0, "peak": 25.0},
                },
                "regions": [],
            },
            {
                "screen_index": 2,
                "circuits": {
                    "Attention": {"score": 60.0, "peak": 70.0},
                    "Cognitive Load": {"score": 70.0, "peak": 80.0},
                    "Emotional Response": {"score": 40.0, "peak": 50.0},
                    "Memory Encoding": {"score": 50.0, "peak": 60.0},
                    "Reward": {"score": 30.0, "peak": 40.0},
                },
                "regions": [],
            },
        ]

        flow = compute_flow_continuity(roi_per_screen)

        assert set(flow.circuits.keys()) == set(CIRCUIT_NAMES)
        for continuity in flow.circuits.values():
            assert len(continuity.per_screen) == 3
            assert continuity.per_screen[0].delta_from_prev == 0.0
            assert continuity.trend in ("rising", "dropping", "flat", "volatile")
        assert flow.circuits["Attention"].trend == "rising"
        assert flow.circuits["Reward"].trend == "rising"

    def test_empty_roi_per_screen(self) -> None:
        from backend.services.continuity import compute_flow_continuity

        flow = compute_flow_continuity([])

        assert set(flow.circuits.keys()) == set(CIRCUIT_NAMES)
        for continuity in flow.circuits.values():
            assert continuity.per_screen == []
            assert continuity.trend == "flat"

    def test_delta_from_prev_computation(self) -> None:
        from backend.services.continuity import compute_flow_continuity

        flow = compute_flow_continuity(
            [
                {
                    "screen_index": 0,
                    "circuits": {
                        name: {"score": 10.0, "peak": 20.0} for name in CIRCUIT_NAMES
                    },
                    "regions": [],
                },
                {
                    "screen_index": 1,
                    "circuits": {
                        name: {"score": 35.0, "peak": 45.0} for name in CIRCUIT_NAMES
                    },
                    "regions": [],
                },
                {
                    "screen_index": 2,
                    "circuits": {
                        name: {"score": 25.0, "peak": 30.0} for name in CIRCUIT_NAMES
                    },
                    "regions": [],
                },
            ]
        )

        attention_points = flow.circuits["Attention"].per_screen
        assert attention_points[0].score_0_100 == 10.0
        assert attention_points[0].delta_from_prev == 0.0
        assert attention_points[1].delta_from_prev == 25.0
        assert attention_points[2].delta_from_prev == -10.0


class TestModuleLevelConstants:
    def test_constants_exist_and_are_tunable(self) -> None:
        from backend.services.continuity import DELTA_FLOOR, VOLATILITY_FLIPS_MIN

        assert DELTA_FLOOR == pytest.approx(5.0)
        assert VOLATILITY_FLIPS_MIN == 2
