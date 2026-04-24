---
phase: 04-frontend-upload-persona-and-results
plan: 03
subsystem: ui-backend
tags: [fastapi, react, react-three-fiber, msw, playwright, vitest, pytest]
requires:
  - phase: 04-frontend-upload-persona-and-results
    plan: 01
    provides: frontend shell, wizard store, typed API client
  - phase: 04-frontend-upload-persona-and-results
    plan: 02
    provides: run polling, DONE transition to step 4, job result rehydration
provides:
  - Binary activation streaming endpoint at GET /jobs/{job_id}/activations/{screen_index}
  - Baked fsaverage5 mesh and Destrieux parcellation assets for the results view
  - Step 4 results layout with brain canvas, circuit controls, ROI/circuit readouts, and recommendation interactions
  - Browser-side MSW wiring plus Playwright happy-path coverage
affects: [backend, frontend, tests]
tech-stack:
  added:
    - three ^0.184.0
    - @react-three/fiber ^9.6.0
    - @react-three/drei ^10.7.7
  patterns:
    - binary Float32 activation fetch cached by TanStack Query
    - static brain asset loading from frontend/public/brain
    - recommendation grouping/cycling by shared screen_index
    - browser MSW enabled only when VITE_USE_MSW=1
key-files:
  created:
    - backend/routers/activations.py
    - scripts/bake_fsaverage5.py
    - frontend/public/brain/fsaverage5_pial_bilateral.bin
    - frontend/public/brain/fsaverage5_parcellation.json
    - frontend/src/features/results/ResultsLayout.tsx
    - frontend/src/features/results/BrainCanvas.tsx
    - frontend/src/features/results/RecommendationCard.tsx
    - frontend/src/features/results/recommendationsByScreen.ts
    - frontend/tests/msw/browser.ts
    - frontend/public/mockServiceWorker.js
  modified:
    - backend/main.py
    - frontend/package.json
    - frontend/src/main.tsx
    - frontend/src/features/wizard/WizardShell.tsx
    - frontend/tests/msw/handlers.ts
    - frontend/playwright.config.ts
    - frontend/vitest.config.ts
key-decisions:
  - Keep per-screen activation delivery binary and immutable: Float32 bytes plus X-Vertex-Count and Cache-Control headers.
  - Lock circuit-to-chart tokens at Attention→1, Cognitive Load→2, Emotional Response→3, Memory Encoding→4, Reward→5.
  - Resolve secondary recommendation cycling as same-screen group rotation via recommendationsByScreen.ts.
  - Exclude tests/e2e from Vitest and run them only through Playwright to keep unit and browser runners separated.
duration: 53m
completed: 2026-04-24
---

# Phase 04 Plan 03: Results View and Activation Streaming Summary

**Results step shipped with binary activation streaming, baked brain assets, interactive recommendation wiring, and a green browser happy path**

## Accomplishments

- Added `GET /jobs/{job_id}/activations/{screen_index}` in `backend/routers/activations.py`. It validates DONE jobs only, loads the referenced `.npy`, computes the time-mean over axis 0, and returns `application/octet-stream` with `X-Vertex-Count: 20484`, `X-Shape: 20484`, and `Cache-Control: public, max-age=300`.
- Added `scripts/bake_fsaverage5.py` and committed the generated frontend brain assets:
  - `frontend/public/brain/fsaverage5_pial_bilateral.bin` — `720K`
  - `frontend/public/brain/fsaverage5_parcellation.json` — `60K`
- Built the Step 4 results experience:
  - `BrainCanvas` fetches binary activations, loads the baked mesh/parcellation, and applies per-vertex colors.
  - `CircuitSelector`, `TimelineScrubber`, `CircuitScoreBar`, `ROIScoreTable`, and `FlowContinuityChart` render the core controls/readouts.
  - `ResultsLayout`, `RecommendationsPanel`, and `RecommendationCard` wire the side-by-side brain/recommendations flow and same-screen secondary cycling.
- Added browser-side MSW bootstrapping and a Playwright happy path using `frontend/public/mockServiceWorker.js`, `frontend/tests/msw/browser.ts`, and `frontend/playwright.config.ts`.

## Endpoint

- URL: `GET /jobs/{job_id}/activations/{screen_index}`
- Success response:
  - status `200`
  - `Content-Type: application/octet-stream`
  - `X-Vertex-Count: 20484`
  - `X-Shape: 20484`
  - body length `81936` bytes (`20484 * 4`)
- Error response:
  - status `404` for unknown job, non-DONE job, unknown screen, or missing activation file

Pytest proof:
- `tests/test_vertex_endpoint.py`
- Verified locally with `~/.venvs/brainx/bin/python -m pytest tests/test_vertex_endpoint.py -q` → `4 passed`

## Bake Path

- One-shot regeneration command: `~/.venvs/brainx/bin/python scripts/bake_fsaverage5.py`
- Mesh blob format:
  - `uint32 vertex_count`
  - `uint32 triangle_count`
  - `vertex_count * 3 * float32` positions
  - `triangle_count * 3 * uint32` indices
- Parcellation JSON format:
  - `labels`
  - `circuit_of_label_index`
  - `vertex_to_label_index`

## Color Buffer

`frontend/src/features/results/colorBuffer.ts` implements:

- Input: `Float32Array` activations + `circuitOfLabelIndex` + `vertexToLabelIndex` + `activeCircuit`
- Thresholding: collect only vertices belonging to the active circuit, sort them, and use the 20th percentile (`Math.floor(sorted.length * 0.2)`) as the neutral cutoff
- Coloring:
  - below threshold or outside the active circuit → neutral base color
  - above threshold and in the active circuit → interpolate from neutral to the active circuit peak color

Locked `CIRCUIT_CHART_TOKEN` mapping:

- `Attention -> --chart-1`
- `Cognitive Load -> --chart-2`
- `Emotional Response -> --chart-3`
- `Memory Encoding -> --chart-4`
- `Reward -> --chart-5`

## Secondary Cycling

RESEARCH open question #3 was resolved as same-screen recommendation cycling:

```text
Screen 3 group: [A] [B] [C]
Click 1 on A -> A becomes active
Click 2 on A -> cycle to B
Click 3 on A -> cycle to C
Next wrap       -> cycle back to A
```

This lives in `frontend/src/features/results/recommendationsByScreen.ts` via:

- `withStableIds()`
- `groupRecsByScreen()`
- `cycleToSecondary()`

## Verification

- `~/.venvs/brainx/bin/python -m pytest tests/test_vertex_endpoint.py -q`
- `cd frontend && npm run typecheck`
- `cd frontend && npm run test -- --run src/features/results tests/e2e/happy-path.spec.ts`
- `cd frontend && npm run test -- --run`
- `cd frontend && npx playwright test tests/e2e/happy-path.spec.ts --reporter=line`

Observed results:

- backend endpoint pytest: `4 passed`
- frontend typecheck: passed
- targeted results suite: `9 files, 19 tests passed`
- full frontend Vitest suite: `19 files, 59 tests passed`
- Playwright happy path: `1 passed`

Expected local Playwright runtime: about 2 seconds once Chromium is installed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `scripts/bake_fsaverage5.py` could not import `backend` when executed directly**
- **Found during:** Task 1 implementation verification
- **Issue:** Running `python scripts/bake_fsaverage5.py` from the repo root did not place the project root on `sys.path`, so the script crashed before generating assets.
- **Fix:** Added the repo root to `sys.path` at script startup and kept the user-facing invocation unchanged.
- **Files modified:** `scripts/bake_fsaverage5.py`
- **Commit:** `36e1375`

**2. [Rule 3 - Blocking] Vitest was collecting Playwright specs**
- **Found during:** Task 3 verification
- **Issue:** `tests/e2e/happy-path.spec.ts` was being executed by Vitest, triggering Playwright's `test() did not expect to be called here`.
- **Fix:** Added `tests/e2e/**` to `frontend/vitest.config.ts` exclusions and kept Playwright isolated behind its own config/web server path.
- **Files modified:** `frontend/vitest.config.ts`, `frontend/playwright.config.ts`
- **Commit:** `4020509`

**3. [Rule 3 - Blocking] ResultsLayout verification originally hit an unstable test/store wiring path**
- **Found during:** Task 3 verification
- **Issue:** the results-layout verification path needed stable store selectors and a local preset state to avoid recursive subscription/update behavior during test runs.
- **Fix:** `ResultsLayout` now uses plain selector reads (`jobId`, `activeScreenIndex`, `activeCircuit`) plus local `useState` for preset UI, and only initializes `activeCircuit` once when it is `null`.
- **Files modified:** `frontend/src/features/results/ResultsLayout.tsx`
- **Commit:** `4020509`

## Known Limitations

- `FlowContinuityChart` is a 2D SVG chart, not an R3F scene, to keep the bundle and rendering cost modest.
- Reduced-motion behavior currently snaps the results interactions and disables scrubber autoplay rather than attempting a separate low-motion animation system.

## Security / Safety Notes

- No `dangerouslySetInnerHTML` exists anywhere in `frontend/src/features/results/`.
- The results feature uses design tokens and CSS variables instead of hardcoded hex colors.
- Recommendation and persona-derived strings remain React text children and are escaped by default.

## Files Changed

- Backend:
  - `backend/main.py`
  - `backend/routers/activations.py`
  - `scripts/bake_fsaverage5.py`
  - `tests/conftest.py`
  - `tests/test_vertex_endpoint.py`
- Frontend brain/results:
  - `frontend/src/features/results/*`
  - `frontend/tests/msw/handlers.ts`
  - `frontend/tests/msw/browser.ts`
  - `frontend/tests/e2e/happy-path.spec.ts`
  - `frontend/public/brain/*`
  - `frontend/public/mockServiceWorker.js`
  - `frontend/src/main.tsx`
  - `frontend/src/features/wizard/WizardShell.tsx`
  - `frontend/playwright.config.ts`
  - `frontend/vitest.config.ts`
  - `frontend/package.json`
  - `frontend/package-lock.json`

## Task Commits

1. `d870867` — `test(04-03): add failing vertex endpoint specs`
2. `36e1375` — `feat(04-03): add activation streaming endpoint and baked brain assets`
3. `73ac3d6` — `test(04-03): add failing results feature specs`
4. `da1837f` — `feat(04-03): build results brain canvas and score controls`
5. `2d7436a` — `test(04-03): add failing results layout and recommendation specs`
6. `4020509` — `feat(04-03): wire results layout and recommendation interactions`

## Self-Check

- PASSED
- `FOUND: .planning/phases/04-frontend-upload-persona-and-results/04-03-SUMMARY.md`
- `FOUND: d870867`
- `FOUND: 36e1375`
- `FOUND: 73ac3d6`
- `FOUND: da1837f`
- `FOUND: 2d7436a`
- `FOUND: 4020509`
