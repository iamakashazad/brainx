from __future__ import annotations

import pytest

from backend.models.simulation import Event, Screen, SimulationLog, TargetRegion


@pytest.fixture
def sim_log_3_screens() -> SimulationLog:
    return SimulationLog(
        screens=[
            Screen(
                screen_index=0,
                narrative_text="User opens the welcome screen calmly, reading the headline with focus.",
                summary_emotional_state="calm",
                memorability_hypothesis="Likely remembered because it frames the first impression.",
                events=[
                    Event(
                        timestamp_ms=100,
                        type="fixation",
                        target_region=TargetRegion(
                            x_ratio=0.1,
                            y_ratio=0.1,
                            width_ratio=0.8,
                            height_ratio=0.2,
                        ),
                        intensity=0.6,
                        note="Headline fixation",
                    ),
                    Event(
                        timestamp_ms=900,
                        type="hesitation",
                        target_region=TargetRegion(
                            x_ratio=0.15,
                            y_ratio=0.32,
                            width_ratio=0.55,
                            height_ratio=0.12,
                        ),
                        intensity=0.3,
                        note="Subtitle reread",
                    ),
                ],
            ),
            Screen(
                screen_index=1,
                narrative_text="User scrolls through a dense feature list and feels overwhelmed by the options shown.",
                summary_emotional_state="frustrated",
                memorability_hypothesis="Likely forgotten because the screen is too dense.",
                events=[
                    Event(
                        timestamp_ms=2000,
                        type="scroll",
                        target_region=TargetRegion(
                            x_ratio=0.0,
                            y_ratio=0.5,
                            width_ratio=1.0,
                            height_ratio=0.4,
                        ),
                        intensity=0.8,
                        note="Fast scroll past features",
                    ),
                ],
            ),
            Screen(
                screen_index=2,
                narrative_text="User reaches the CTA button and feels excited to sign up immediately after scanning pricing.",
                summary_emotional_state="excited",
                memorability_hypothesis="Strongly remembered because the CTA creates reward anticipation.",
                events=[
                    Event(
                        timestamp_ms=4000,
                        type="click_intent",
                        target_region=TargetRegion(
                            x_ratio=0.3,
                            y_ratio=0.8,
                            width_ratio=0.4,
                            height_ratio=0.1,
                        ),
                        intensity=0.9,
                        note="Sign up CTA",
                    ),
                    Event(
                        timestamp_ms=4300,
                        type="emotional_shift",
                        target_region=TargetRegion(
                            x_ratio=0.28,
                            y_ratio=0.68,
                            width_ratio=0.44,
                            height_ratio=0.16,
                        ),
                        intensity=0.7,
                        note="Pricing confidence boost",
                    ),
                ],
            ),
        ]
    )


@pytest.fixture
def empty_narrative_screen() -> SimulationLog:
    return SimulationLog(
        screens=[
            Screen(
                screen_index=0,
                narrative_text="Non-empty first screen narrative.",
                summary_emotional_state="calm",
                memorability_hypothesis="baseline",
                events=[],
            ),
            Screen.model_construct(
                screen_index=1,
                narrative_text="   ",
                summary_emotional_state="calm",
                memorability_hypothesis="baseline",
                events=[],
            ),
        ]
    )
