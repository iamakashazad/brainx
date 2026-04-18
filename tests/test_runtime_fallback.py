from __future__ import annotations

from pathlib import Path

import numpy as np
import pytest

from backend.core.config import settings
from backend.models.content import Content, ContentType
from backend.models.continuity import CircuitContinuity, ContinuityPoint, FlowContinuity
from backend.models.results import AnalysisResult
from backend.models.simulation import Event, Screen, SimulationLog
from backend.services.pathway_config import (
    content_supports_video_fallback,
    resolve_runtime_pathway,
    set_default_pathway,
)
from backend.services.video_slideshow import (
    derive_slideshow_durations,
    resolve_uploaded_image_paths,
    split_video_activation_by_screen,
)


@pytest.fixture(autouse=True)
def _reset_default_pathway() -> None:
    set_default_pathway("text")
    yield
    set_default_pathway("text")


def _make_content(
    *,
    content_type: ContentType,
    content_id: str = "content-123",
    screen_count: int | None = None,
) -> Content:
    return Content(id=content_id, content_type=content_type.value, screen_count=screen_count)


def _make_flow_continuity() -> FlowContinuity:
    return FlowContinuity(
        circuits={
            "Attention": CircuitContinuity(
                per_screen=[ContinuityPoint(screen_index=0, score_0_100=50.0, delta_from_prev=0.0)],
                trend="flat",
            )
        }
    )


def test_runtime_pathway_uses_video_only_for_visual_content() -> None:
    set_default_pathway("video")

    assert content_supports_video_fallback(_make_content(content_type=ContentType.UI_SCREENS, screen_count=2))
    assert content_supports_video_fallback(_make_content(content_type=ContentType.STATIC))
    assert not content_supports_video_fallback(_make_content(content_type=ContentType.TEXT))
    assert resolve_runtime_pathway(_make_content(content_type=ContentType.UI_SCREENS, screen_count=2)) == "video"
    assert resolve_runtime_pathway(_make_content(content_type=ContentType.STATIC)) == "video"
    assert resolve_runtime_pathway(_make_content(content_type=ContentType.TEXT)) == "text"


def test_derive_slideshow_durations_uses_event_deltas_and_minimum_floor() -> None:
    sim_log = SimulationLog(
        screens=[
            Screen(
                screen_index=0,
                narrative_text="First",
                summary_emotional_state="calm",
                memorability_hypothesis="remembered",
                events=[Event(timestamp_ms=200, type="fixation", intensity=0.5)],
            ),
            Screen(
                screen_index=1,
                narrative_text="Second",
                summary_emotional_state="focused",
                memorability_hypothesis="remembered",
                events=[Event(timestamp_ms=1300, type="scroll", intensity=0.7)],
            ),
            Screen(
                screen_index=2,
                narrative_text="Third",
                summary_emotional_state="excited",
                memorability_hypothesis="remembered",
                events=[Event(timestamp_ms=4500, type="click_intent", intensity=0.9)],
            ),
        ]
    )

    assert derive_slideshow_durations(sim_log, ContentType.UI_SCREENS) == [1.0, 1.1, 3.2]
    assert derive_slideshow_durations(sim_log, ContentType.STATIC) == [2.0]


def test_resolve_uploaded_image_paths_uses_workspace_upload_contract(tmp_path, monkeypatch) -> None:
    uploads_dir = tmp_path / "uploads"
    content_dir = uploads_dir / "content-123"
    content_dir.mkdir(parents=True)
    for name in ("screen_1.jpg", "screen_2.jpg"):
        (content_dir / name).write_bytes(b"img")

    monkeypatch.setattr(settings, "uploads_dir", uploads_dir)

    paths = resolve_uploaded_image_paths(
        _make_content(content_type=ContentType.UI_SCREENS, screen_count=2)
    )

    assert paths == [
        str(content_dir / "screen_1.jpg"),
        str(content_dir / "screen_2.jpg"),
    ]


def test_split_video_activation_by_screen_returns_contiguous_slices() -> None:
    activation = np.arange(12, dtype=np.float32).reshape(6, 2)

    slices = split_video_activation_by_screen(
        activation=activation,
        durations=[1.0, 2.0, 3.0],
        screen_count=3,
    )

    assert [part.shape for part in slices] == [(1, 2), (2, 2), (3, 2)]
    assert np.array_equal(slices[0], activation[0:1])
    assert np.array_equal(slices[1], activation[1:3])
    assert np.array_equal(slices[2], activation[3:6])


def test_split_video_activation_by_screen_raises_when_too_short() -> None:
    activation = np.ones((2, 4), dtype=np.float32)

    with pytest.raises(RuntimeError, match="at least one timestep"):
        split_video_activation_by_screen(
            activation=activation,
            durations=[1.0, 1.0, 1.0],
            screen_count=3,
        )


def test_analysis_result_exposes_pathway_metadata() -> None:
    payload = {
        "schema_version": 1,
        "simulation": {"screens": []},
        "overlays": [],
        "activations": [],
        "roi": [],
        "flow_continuity": _make_flow_continuity().model_dump(),
        "recommendations": [],
        "pathway": {
            "selected_pathway": "video",
            "slideshow_path": "activations/job-123/fallback_slideshow.mp4",
            "durations": [1.0, 2.0],
        },
    }

    model = AnalysisResult.model_validate(payload)

    assert model.pathway.selected_pathway == "video"
    assert model.pathway.slideshow_path == "activations/job-123/fallback_slideshow.mp4"
    assert model.pathway.durations == [1.0, 2.0]
