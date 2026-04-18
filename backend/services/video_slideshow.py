from __future__ import annotations

import tempfile
from pathlib import Path

import numpy as np
from moviepy import ImageClip, concatenate_videoclips

from backend.core.config import settings
from backend.models.content import Content, ContentType
from backend.models.simulation import SimulationLog


def create_slideshow(
    image_paths: list[str],
    durations: list[float],
    output_path: str | None = None,
    fps: int = 24,
) -> str:
    if len(image_paths) != len(durations):
        raise ValueError("image_paths and durations must have the same length")

    clips = [ImageClip(path, duration=duration) for path, duration in zip(image_paths, durations)]
    video = concatenate_videoclips(clips, method="compose")

    if output_path is None:
        tmp = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
        output_path = tmp.name
        tmp.close()

    resolved_output = Path(output_path)
    video.write_videofile(
        resolved_output.as_posix(),
        fps=fps,
        codec="libx264",
        audio=False,
        logger=None,
    )
    video.close()
    for clip in clips:
        clip.close()

    return resolved_output.as_posix()


def resolve_uploaded_image_paths(content: Content) -> list[str]:
    base = settings.uploads_dir / content.id

    if content.content_type == ContentType.UI_SCREENS.value:
        screen_count = content.screen_count or 0
        if screen_count < 1:
            raise RuntimeError("ui_screens content is missing a valid screen_count")

        paths = [base / f"screen_{index}.jpg" for index in range(1, screen_count + 1)]
    elif content.content_type == ContentType.STATIC.value:
        paths = [base / "image.jpg"]
    else:
        return []

    missing = [path.as_posix() for path in paths if not path.is_file()]
    if missing:
        raise RuntimeError(
            f"Missing uploaded image files for content {content.id}: {', '.join(missing)}"
        )

    return [path.as_posix() for path in paths]


def derive_slideshow_durations(sim_log: SimulationLog, content_type: ContentType | str) -> list[float]:
    resolved_type = (
        content_type
        if isinstance(content_type, ContentType)
        else ContentType(content_type)
    )
    if resolved_type == ContentType.STATIC:
        return [2.0]

    durations: list[float] = []
    previous_end_ms = 0
    for screen in sim_log.screens:
        screen_end_ms = max((event.timestamp_ms for event in screen.events), default=previous_end_ms)
        duration_seconds = max((screen_end_ms - previous_end_ms) / 1000.0, 1.0)
        durations.append(round(duration_seconds, 3))
        previous_end_ms = max(screen_end_ms, previous_end_ms)

    return durations


def split_video_activation_by_screen(
    activation: np.ndarray,
    durations: list[float],
    screen_count: int,
) -> list[np.ndarray]:
    if activation.ndim != 2:
        raise RuntimeError("Video activation must be a 2D array of (timesteps, vertices)")
    if screen_count < 1:
        raise RuntimeError("screen_count must be at least 1")
    if len(durations) != screen_count:
        raise RuntimeError(
            f"Expected {screen_count} slideshow durations, received {len(durations)}"
        )

    timesteps = int(activation.shape[0])
    if timesteps < screen_count:
        raise RuntimeError(
            "Video activation must provide at least one timestep per screen; "
            f"got {timesteps} timesteps for {screen_count} screens"
        )

    total_duration = sum(durations)
    if total_duration <= 0:
        raise RuntimeError("Slideshow durations must sum to a positive value")

    slices: list[np.ndarray] = []
    start = 0
    cumulative_duration = 0.0

    for index, duration in enumerate(durations):
        cumulative_duration += duration
        remaining_screens = screen_count - index
        latest_end = timesteps - (remaining_screens - 1)
        proposed_end = int(round((cumulative_duration / total_duration) * timesteps))
        end = min(max(proposed_end, start + 1), latest_end)
        slices.append(activation[start:end])
        start = end

    if len(slices) != screen_count or any(part.shape[0] < 1 for part in slices):
        raise RuntimeError("Failed to split video activation into non-empty per-screen slices")

    return slices
