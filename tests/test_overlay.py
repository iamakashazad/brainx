from __future__ import annotations

from backend.models.simulation import Event, Screen, SimulationLog, TargetRegion
from backend.services.overlay import derive_overlays


def _hesitation_event(ts: int, x: float, y: float, intensity: float = 0.5) -> Event:
    return Event(
        timestamp_ms=ts,
        type="hesitation",
        target_region=TargetRegion(x_ratio=x, y_ratio=y, width_ratio=0.05, height_ratio=0.05),
        intensity=intensity,
        note=None,
    )


def _scroll_event(ts: int, y: float) -> Event:
    return Event(
        timestamp_ms=ts,
        type="scroll",
        target_region=TargetRegion(x_ratio=0.5, y_ratio=y, width_ratio=1.0, height_ratio=0.01),
        intensity=0.5,
        note=None,
    )


def _make_log(events: list[Event], n_screens: int = 1) -> SimulationLog:
    screens = [
        Screen(
            screen_index=index,
            narrative_text=f"screen {index} narrative",
            summary_emotional_state="neutral",
            memorability_hypothesis="medium",
            events=events if index == 0 else [],
        )
        for index in range(n_screens)
    ]
    return SimulationLog(screens=screens)


def test_hesitation_clustering():
    events = [
        _hesitation_event(100, 0.50, 0.50, 0.6),
        _hesitation_event(200, 0.52, 0.48, 0.5),
        _hesitation_event(300, 0.51, 0.51, 0.4),
        _hesitation_event(400, 0.90, 0.90, 0.7),
    ]
    overlays = derive_overlays(_make_log(events), content_type="ui_screens")
    assert len(overlays) == 1
    assert len(overlays[0].hesitation_points) == 2
    merged = overlays[0].hesitation_points[0]
    assert 0.50 <= merged.x_ratio <= 0.52
    assert 0.49 <= merged.y_ratio <= 0.51


def test_scroll_path_order():
    events = [_scroll_event(300, 0.7), _scroll_event(50, 0.1), _scroll_event(200, 0.5), _scroll_event(100, 0.3)]
    overlays = derive_overlays(_make_log(events), content_type="ui_screens")
    assert overlays[0].scroll_path is not None
    assert [point.t_ms for point in overlays[0].scroll_path] == [50, 100, 200, 300]


def test_text_no_scroll():
    events = [_hesitation_event(100, 0.5, 0.5), _scroll_event(200, 0.6)]
    overlays = derive_overlays(_make_log(events), content_type="text")
    assert overlays[0].scroll_path is None
    assert overlays[0].hesitation_points


def test_deterministic():
    events = [
        _hesitation_event(100, 0.50, 0.50, 0.6),
        _hesitation_event(200, 0.52, 0.48, 0.5),
        _hesitation_event(300, 0.90, 0.90, 0.7),
        _scroll_event(400, 0.3),
        _scroll_event(150, 0.1),
    ]
    runs = [derive_overlays(_make_log(events), content_type="ui_screens") for _ in range(10)]
    assert len({run[0].model_dump_json() for run in runs}) == 1
