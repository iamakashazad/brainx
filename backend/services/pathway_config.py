"""Pathway configuration for TRIBEv2 input."""

from __future__ import annotations

from backend.models.content import Content, ContentType

DEFAULT_PATHWAY: str = "text"
VISUAL_FALLBACK_CONTENT_TYPES = {
    ContentType.UI_SCREENS.value,
    ContentType.STATIC.value,
}


def get_default_pathway() -> str:
    return DEFAULT_PATHWAY


def set_default_pathway(pathway: str) -> None:
    global DEFAULT_PATHWAY

    if pathway not in {"text", "video"}:
        raise ValueError(f"Invalid pathway: {pathway}")

    DEFAULT_PATHWAY = pathway


def content_supports_video_fallback(content: Content) -> bool:
    return content.content_type in VISUAL_FALLBACK_CONTENT_TYPES


def resolve_runtime_pathway(content: Content) -> str:
    if get_default_pathway() == "video" and content_supports_video_fallback(content):
        return "video"
    return "text"
