from __future__ import annotations

import functools
from collections import Counter
from pathlib import Path

import numpy as np
from nilearn.datasets import fetch_atlas_surf_destrieux

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
    atlas = get_surf_atlas()
    return atlas["labels"]


@functools.lru_cache(maxsize=1)
def get_surf_atlas() -> dict[str, np.ndarray | list[str]]:
    data_dir = Path(settings.model_cache_path) / "nilearn"
    data_dir.mkdir(parents=True, exist_ok=True)
    atlas = fetch_atlas_surf_destrieux(data_dir=data_dir.as_posix())
    labels = [
        label.decode("utf-8") if isinstance(label, bytes) else str(label)
        for label in atlas["labels"]
    ]
    return {
        "map_left": np.asarray(atlas["map_left"], dtype=np.int64),
        "map_right": np.asarray(atlas["map_right"], dtype=np.int64),
        "labels": labels,
    }


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


def _build_vertex_label_map(atlas: dict[str, np.ndarray | list[str]]) -> np.ndarray:
    return np.concatenate(
        [
            np.asarray(atlas["map_left"], dtype=np.int64),
            np.asarray(atlas["map_right"], dtype=np.int64),
        ]
    )


def _region_to_circuit(region_name: str) -> str:
    for circuit, regions in ROI_CIRCUIT_MAP.items():
        if region_name in regions:
            return circuit
    return ""


def aggregate_screen_roi(
    activation: np.ndarray,
    atlas: dict[str, np.ndarray | list[str]],
) -> dict[str, dict[str, dict[str, float]] | list[dict[str, str | float]]]:
    vertex_labels = _build_vertex_label_map(atlas)
    expected = vertex_labels.shape[0]
    if activation.shape[1] != expected:
        raise ValueError(
            f"Activation vertex count {activation.shape[1]} does not match "
            f"fsaverage5 bilateral count {expected}. Check TRIBEv2 output shape "
            f"and Assumption A1 (left-then-right bilateral concatenation)."
        )

    mean_per_vertex = activation.mean(axis=0)
    peak_per_vertex = activation.max(axis=0)
    labels = atlas["labels"]
    if not isinstance(labels, list):
        raise TypeError("atlas labels must be a list of region names")

    region_rows: list[dict[str, str | float]] = []
    for region_idx, region_name in enumerate(labels):
        if region_idx == 0 or region_name.lower() == "unknown":
            continue
        circuit = _region_to_circuit(region_name)
        if not circuit:
            continue
        mask = vertex_labels == region_idx
        if not mask.any():
            continue
        region_rows.append(
            {
                "atlas_label": region_name,
                "circuit": circuit,
                "score": float(mean_per_vertex[mask].mean()),
                "peak": float(peak_per_vertex[mask].max()),
            }
        )

    circuits: dict[str, dict[str, float]] = {
        name: {"score": 0.0, "peak": 0.0} for name in ROI_CIRCUIT_MAP
    }
    per_circuit_count = Counter(row["circuit"] for row in region_rows)
    for row in region_rows:
        circuit = circuits[str(row["circuit"])]
        circuit["score"] += float(row["score"])
        circuit["peak"] = max(circuit["peak"], float(row["peak"]))
    for name, agg in circuits.items():
        count = per_circuit_count.get(name, 0)
        if count:
            agg["score"] = agg["score"] / count

    return {"circuits": circuits, "regions": region_rows}


def _rescale_value(value: float, min_score: float, max_score: float) -> float:
    if max_score == min_score:
        return 0.0
    return ((value - min_score) / (max_score - min_score)) * 100.0


def rescale_to_0_100(per_screen_bundles: list[dict]) -> list[dict]:
    if not per_screen_bundles:
        return []

    all_scores: list[float] = []
    for bundle in per_screen_bundles:
        for circuit in bundle["circuits"].values():
            all_scores.extend([float(circuit["score"]), float(circuit["peak"])])
        for row in bundle["regions"]:
            all_scores.extend([float(row["score"]), float(row["peak"])])

    min_score = min(all_scores)
    max_score = max(all_scores)

    scaled_bundles: list[dict] = []
    for bundle in per_screen_bundles:
        scaled_circuits = {
            name: {
                "score": _rescale_value(float(values["score"]), min_score, max_score),
                "peak": _rescale_value(float(values["peak"]), min_score, max_score),
            }
            for name, values in bundle["circuits"].items()
        }
        scaled_regions = [
            {
                **row,
                "score": _rescale_value(float(row["score"]), min_score, max_score),
                "peak": _rescale_value(float(row["peak"]), min_score, max_score),
            }
            for row in bundle["regions"]
        ]
        scaled_bundles.append({"circuits": scaled_circuits, "regions": scaled_regions})

    return scaled_bundles
