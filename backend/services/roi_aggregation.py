from __future__ import annotations

from pathlib import Path

import numpy as np
from nilearn.datasets import fetch_atlas_destrieux_2009

from backend.core.config import settings

ROI_CIRCUIT_MAP: dict[str, list[str]] = {
    "Attention": [
        "S_front_inf",
        "G_front_inf-Triangul",
        "S_intrapariet_and_P_trans",
    ],
    "Cognitive Load": [
        "G_front_middle",
        "S_front_middle",
        "G_front_sup",
    ],
    "Emotional Response": [
        "G_insular_short",
        "S_cingul-Marginalis",
        "G_cingul-Post-ventral",
    ],
    "Memory Encoding": [
        "G_oc-temp_med-Parahip",
        "S_collat_transv_ant",
    ],
    "Reward": [
        "G_orbital",
        "G_rectus",
        "S_orbital-H_Shaped",
    ],
}

CIRCUIT_NAMES = list(ROI_CIRCUIT_MAP.keys())

SUBCORTICAL_LABELS = [
    "striatum",
    "putamen",
    "caudate",
    "nucleus accumbens",
    "hippocampus",
    "amygdala",
    "thalamus",
    "hypothalamus",
    "substantia nigra",
    "ventral tegmental",
]


def get_atlas_labels() -> list[str]:
    data_dir = Path(settings.model_cache_path) / "nilearn"
    data_dir.mkdir(parents=True, exist_ok=True)
    atlas = fetch_atlas_destrieux_2009(data_dir=data_dir.as_posix())
    return [label.decode("utf-8") if isinstance(label, bytes) else str(label) for label in atlas["labels"]]


def verify_atlas_labels() -> dict[str, list[str]]:
    atlas_labels = get_atlas_labels()
    missing: dict[str, list[str]] = {}

    for circuit, regions in ROI_CIRCUIT_MAP.items():
        not_found = [region for region in regions if region not in atlas_labels]
        if not_found:
            missing[circuit] = not_found

    return missing


def aggregate_roi_scores(
    mean_activation: np.ndarray,
    atlas_labels: list[str],
) -> dict[str, dict[str, float]]:
    results: dict[str, dict[str, float]] = {}

    for circuit_name, region_names in ROI_CIRCUIT_MAP.items():
        indices = [i for i, label in enumerate(atlas_labels) if label in region_names]
        if indices:
            scores = mean_activation[indices]
            results[circuit_name] = {
                "score": float(np.mean(scores)),
                "peak": float(np.max(scores)),
            }
        else:
            results[circuit_name] = {"score": 0.0, "peak": 0.0}

    return results
