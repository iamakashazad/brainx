from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from backend.models.content import Content, ContentType
from backend.models.simulation import HallucinationError, Screen, SimulationLog
from backend.services import grounding

pytestmark = pytest.mark.asyncio


def _sim_log() -> SimulationLog:
    return SimulationLog(
        screens=[
            Screen(
                screen_index=0,
                narrative_text="user clicks the green Submit button",
                summary_emotional_state="confident",
                memorability_hypothesis="high",
                events=[],
            )
        ]
    )


def _ui_content(tmp_path) -> Content:
    content_dir = tmp_path / "c"
    content_dir.mkdir()
    (content_dir / "screen_1.jpg").write_bytes(b"\xff\xd8\xff\xd9")
    content = Content()
    content.id = "c"
    content.content_type = ContentType.UI_SCREENS.value
    content.screen_count = 1
    return content


async def test_hallucination_fails_fast(tmp_path, monkeypatch):
    from backend.core.config import settings

    monkeypatch.setattr(settings, "uploads_dir", tmp_path)
    fake_provider = AsyncMock()
    fake_provider.analyze.return_value = {
        "hallucinations": [
            {"screen_index": 0, "narrative_claim": "Submit button", "reason": "not visible"}
        ],
        "verified_elements": [],
    }
    with patch("backend.services.grounding.get_provider", return_value=fake_provider):
        with pytest.raises(HallucinationError) as exc_info:
            await grounding.judge(_ui_content(tmp_path), _sim_log())

    assert fake_provider.analyze.await_count == 1
    assert "Narrative references" in str(exc_info.value)
    assert "screen 0" in str(exc_info.value)


async def test_clean_passes_through(tmp_path, monkeypatch):
    from backend.core.config import settings

    monkeypatch.setattr(settings, "uploads_dir", tmp_path)
    fake_provider = AsyncMock()
    fake_provider.analyze.return_value = {
        "hallucinations": [],
        "verified_elements": ["Submit button"],
    }
    with patch("backend.services.grounding.get_provider", return_value=fake_provider):
        verdict = await grounding.judge(_ui_content(tmp_path), _sim_log())

    assert verdict.hallucinations == []


async def test_provider_errors_fail_closed(tmp_path, monkeypatch):
    from backend.core.config import settings

    monkeypatch.setattr(settings, "uploads_dir", tmp_path)
    fake_provider = AsyncMock()
    fake_provider.analyze.side_effect = OSError("missing upload")
    with patch("backend.services.grounding.get_provider", return_value=fake_provider):
        with pytest.raises(HallucinationError) as exc_info:
            await grounding.judge(_ui_content(tmp_path), _sim_log())

    assert exc_info.value.items == []
