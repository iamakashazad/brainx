"""Pathway configuration for TRIBEv2 input."""

DEFAULT_PATHWAY: str = "text"


def get_default_pathway() -> str:
    return DEFAULT_PATHWAY


def set_default_pathway(pathway: str) -> None:
    global DEFAULT_PATHWAY

    if pathway not in {"text", "video"}:
        raise ValueError(f"Invalid pathway: {pathway}")

    DEFAULT_PATHWAY = pathway
