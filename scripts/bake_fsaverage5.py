from __future__ import annotations

import json
import struct
from pathlib import Path
import sys

import numpy as np
from nilearn.datasets import fetch_atlas_surf_destrieux, fetch_surf_fsaverage
from nilearn.surface import load_surf_mesh

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.core.config import settings
from backend.services.roi_aggregation import ROI_CIRCUIT_MAP

OUTPUT_DIR = Path("frontend/public/brain")
MESH_PATH = OUTPUT_DIR / "fsaverage5_pial_bilateral.bin"
PARCELLATION_PATH = OUTPUT_DIR / "fsaverage5_parcellation.json"


def _label_to_circuit(labels: list[str]) -> list[str | None]:
    reverse_map = {
        region: circuit
        for circuit, regions in ROI_CIRCUIT_MAP.items()
        for region in regions
    }
    return [reverse_map.get(label) for label in labels]


def main() -> None:
    data_dir = Path(settings.model_cache_path) / "nilearn"
    data_dir.mkdir(parents=True, exist_ok=True)

    fsaverage = fetch_surf_fsaverage(mesh="fsaverage5", data_dir=data_dir.as_posix())
    atlas = fetch_atlas_surf_destrieux(data_dir=data_dir.as_posix())

    left_mesh = load_surf_mesh(fsaverage["pial_left"])
    right_mesh = load_surf_mesh(fsaverage["pial_right"])

    left_positions = np.asarray(left_mesh.coordinates, dtype="<f4")
    right_positions = np.asarray(right_mesh.coordinates, dtype="<f4")
    left_faces = np.asarray(left_mesh.faces, dtype="<u4")
    right_faces = np.asarray(right_mesh.faces, dtype="<u4") + left_positions.shape[0]

    positions = np.concatenate([left_positions, right_positions], axis=0)
    triangles = np.concatenate([left_faces, right_faces], axis=0)

    labels = [
        label.decode("utf-8") if isinstance(label, bytes) else str(label)
        for label in atlas["labels"]
    ]
    vertex_to_label_index = np.concatenate(
        [
            np.asarray(atlas["map_left"], dtype=np.int64),
            np.asarray(atlas["map_right"], dtype=np.int64),
        ]
    )

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with MESH_PATH.open("wb") as mesh_file:
        mesh_file.write(struct.pack("<II", positions.shape[0], triangles.shape[0]))
        mesh_file.write(positions.reshape(-1).tobytes(order="C"))
        mesh_file.write(triangles.reshape(-1).tobytes(order="C"))

    parcellation = {
        "labels": labels,
        "circuit_of_label_index": _label_to_circuit(labels),
        "vertex_to_label_index": vertex_to_label_index.tolist(),
    }
    PARCELLATION_PATH.write_text(json.dumps(parcellation, separators=(",", ":")))


if __name__ == "__main__":
    main()
