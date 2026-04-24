Phase 04-03 bakes and commits the fsaverage5 results assets in this directory.

Files:
- `fsaverage5_pial_bilateral.bin`
- `fsaverage5_parcellation.json`

`fsaverage5_pial_bilateral.bin` layout:
- bytes `0..3`: little-endian `uint32` vertex count
- bytes `4..7`: little-endian `uint32` triangle count
- next `vertex_count * 3 * 4` bytes: `float32` XYZ positions, left hemisphere then right
- remaining `triangle_count * 3 * 4` bytes: `uint32` triangle indices, with right hemisphere faces offset by the left vertex count

Regenerate:
- `~/.venvs/brainx/bin/python scripts/bake_fsaverage5.py`

The bake script reads the Nilearn cache under `model_cache/nilearn`, loads the fsaverage5 pial meshes and Destrieux atlas, then writes the compact mesh blob and the parcellation lookup JSON for the frontend results view.
