from __future__ import annotations

import tempfile
from pathlib import Path

from moviepy import ImageClip, concatenate_videoclips


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
