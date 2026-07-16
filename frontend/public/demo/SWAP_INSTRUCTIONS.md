# Demo Swap Instructions

This directory contains the static sample analysis shown by the pinned demo card.

## Files

- `result.json` is a complete `AnalysisResult` fixture.
- `activations/screen_1.bin` is the Float32 activation buffer used by the brain canvas.

## How The Demo Loads

The history screen renders `DemoCard` as the first card. Clicking it opens `DemoOverlay`, which calls `useDemoResult` and fetches `/demo/result.json`.

`ResultsLayout` receives that fixture through `resultOverride`, so no `/analyze` request is made and no backend job is created.

When the brain canvas needs activation data, `useActivation("demo", screenIndex)` fetches `/demo/activations/screen_${screenIndex + 1}.bin`.

## Replacing The Placeholder

1. Run a real analysis in the app.
2. Save the completed result envelope as `frontend/public/demo/result.json`.
3. Export each screen activation as a raw little-endian Float32 binary.
4. Put those files under `frontend/public/demo/activations/` using names like `screen_1.bin`.
5. Update each `activations[*].path` entry in `result.json`.
6. Keep `schema_version` set to `1`.
7. Keep circuit names exactly as `Attention`, `Cognitive Load`, `Emotional Response`, `Memory Encoding`, and `Reward`.
8. Restart the frontend dev server if static asset caching gets stale.

## Validation

Open the app root and click the pinned demo card. The results overlay should render immediately and the Network panel should show requests to `/demo/result.json` and `/demo/activations/screen_1.bin`, but no `POST /analyze`.

For a shareable real result, use `/results/{job_id}` instead of modifying this demo fixture.

