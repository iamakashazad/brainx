from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from backend.models.simulation import Event, SimulationLog


class HesitationPoint(BaseModel):
    x_ratio: float = Field(ge=0.0, le=1.0)
    y_ratio: float = Field(ge=0.0, le=1.0)
    duration_ms: int = Field(ge=0)
    intensity: float = Field(ge=0.0, le=1.0)


class ScrollPoint(BaseModel):
    t_ms: int = Field(ge=0)
    y_ratio: float = Field(ge=0.0, le=1.0)


class ScreenOverlay(BaseModel):
    screen_index: int
    hesitation_points: list[HesitationPoint] = Field(default_factory=list)
    scroll_path: list[ScrollPoint] | None = None


CLUSTER_RADIUS = 0.1
DEFAULT_HESITATION_DURATION_MS = 300
INTENSITY_NORMALIZER = 3.0


def _cluster_hesitations(events: list[Event]) -> list[HesitationPoint]:
    candidates = [
        (event.intensity, event.timestamp_ms, event.target_region.x_ratio, event.target_region.y_ratio)
        for event in events
        if event.type == "hesitation" and event.target_region is not None
    ]
    candidates.sort(key=lambda item: (-item[0], item[1], item[2], item[3]))

    clusters: list[dict[str, float | int]] = []
    for intensity, _timestamp, x_ratio, y_ratio in candidates:
        assigned = False
        for cluster in clusters:
            distance = (cluster["x"] - x_ratio) ** 2 + (cluster["y"] - y_ratio) ** 2
            if distance <= CLUSTER_RADIUS**2:
                total_intensity = cluster["intensity_sum"] + intensity
                cluster["x"] = (cluster["x"] * cluster["intensity_sum"] + x_ratio * intensity) / total_intensity
                cluster["y"] = (cluster["y"] * cluster["intensity_sum"] + y_ratio * intensity) / total_intensity
                cluster["intensity_sum"] = total_intensity
                cluster["count"] += 1
                assigned = True
                break
        if not assigned:
            clusters.append({"x": x_ratio, "y": y_ratio, "intensity_sum": intensity, "count": 1})

    points = [
        HesitationPoint(
            x_ratio=round(cluster["x"], 6),
            y_ratio=round(cluster["y"], 6),
            duration_ms=int(cluster["count"]) * DEFAULT_HESITATION_DURATION_MS,
            intensity=min(1.0, cluster["intensity_sum"] / INTENSITY_NORMALIZER),
        )
        for cluster in clusters
    ]
    points.sort(key=lambda point: (point.x_ratio, point.y_ratio))
    return points


def _build_scroll_path(events: list[Event]) -> list[ScrollPoint]:
    scroll_points = [
        ScrollPoint(t_ms=event.timestamp_ms, y_ratio=event.target_region.y_ratio)
        for event in events
        if event.type == "scroll" and event.target_region is not None
    ]
    scroll_points.sort(key=lambda point: point.t_ms)
    return scroll_points


def derive_overlays(
    sim_log: SimulationLog,
    content_type: Literal["ui_screens", "static", "text"] = "ui_screens",
) -> list[ScreenOverlay]:
    overlays: list[ScreenOverlay] = []
    for screen in sim_log.screens:
        hesitation_points = _cluster_hesitations(screen.events)
        if content_type in {"text", "static"}:
            scroll_path = None
        else:
            scroll_points = _build_scroll_path(screen.events)
            scroll_path = scroll_points or None
        overlays.append(
            ScreenOverlay(
                screen_index=screen.screen_index,
                hesitation_points=hesitation_points,
                scroll_path=scroll_path,
            )
        )
    overlays.sort(key=lambda overlay: overlay.screen_index)
    return overlays
