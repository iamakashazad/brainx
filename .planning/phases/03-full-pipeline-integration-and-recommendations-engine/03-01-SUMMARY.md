---
phase: 03-full-pipeline-integration-and-recommendations-engine
plan: 01
subsystem: api
tags: [nilearn, tribev2, roi, queue, pytest]
requires:
  - phase: 01-foundation-and-tribev2-integration
    provides: TRIBEv2 text inference, legacy /test-inference queue flow, ROI circuit naming
  - phase: 02-simulation-pipeline-and-content-input
    provides: SimulationLog output, analyze job orchestration, transition helper
provides:
  - fsaverage5 Destrieux surface ROI aggregation with per-region and per-circuit outputs
  - per-screen analyze-branch inference with `activations/{job_id}/screen_{n}.npy` manifests
  - ROI_AGGREGATION stage wiring and A1 vertex-count guard rails
affects: [03-02, 03-03, phase-4-frontend]
tech-stack:
  added: []
  patterns: [per-screen inference loop, fsaverage5 surface atlas mapping, transition-only stage writes]
key-files:
  created: [tests/fixtures/__init__.py, tests/fixtures/sim_log_3_screens.py, tests/test_per_screen_inference.py]
  modified: [backend/models/job.py, backend/services/roi_aggregation.py, backend/core/queue.py, tests/test_roi.py, tests/test_queue_transitions.py, tests/test_analyze.py]
key-decisions:
  - "Keep `aggregate_roi_scores` as a legacy helper and route new analyze work through `aggregate_screen_roi`."
  - "Patch nilearn fetch calls in unit tests so the surface-atlas path is exercised without introducing a network dependency."
  - "Persist native per-screen ROI bundles temporarily under `_roi_native_tmp` so plan 03-02 can wrap them into the final result envelope."
patterns-established:
  - "Per-screen analyze jobs write one `.npy` per screen using 1-indexed filenames while preserving 0-indexed `screen_index` in metadata."
  - "ROI aggregation validates the bilateral fsaverage5 vertex count before any region reduction happens."
  - "Analyze-stage tests patch inference outputs to 20,484 vertices whenever ROI aggregation is expected to succeed."
requirements-completed: [BRAIN-01, BRAIN-02]
duration: 10min
completed: 2026-04-17
---

# Phase 03 Plan 01: Per-Screen Inference and ROI Foundation Summary

**fsaverage5 surface ROI aggregation, per-screen analyze inference manifests, and A1 vertex-count guard rails for TRIBEv2 screen flows**

## Performance

- **Duration:** 10 min
- **Started:** 2026-04-17T19:39:00Z
- **Completed:** 2026-04-17T19:48:38Z
- **Tasks:** 4
- **Files modified:** 9

## Accomplishments
- Added `ROI_AGGREGATION` and `RECOMMENDATIONS` to `StageEnum` and locked the canonical order with transition tests.
- Replaced volumetric ROI lookup with nilearn's fsaverage5 surface Destrieux atlas and shipped per-screen `circuits` plus `regions` outputs with global 0..100 rescaling support.
- Reworked the analyze branch to infer one TRIBEv2 activation array per screen, save `screen_{n}.npy` files, and stash native ROI bundles for the next plan while leaving legacy `/test-inference` behavior untouched.
- Added A1 guard rails so shape mismatches fail loudly in both ROI aggregation and queue error reporting, with a gated live probe for real-model verification.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend StageEnum + add Wave 0 test files** - `d9a8f1d` (feat)
2. **Task 2: Fix ROI aggregation correctness with fsaverage5 surface atlas** - `f927aee` (feat)
3. **Task 3: Wire per-screen inference loop and ROI stage into analyze branch** - `48d374c` (feat)
4. **Task 4: Add A1 empirical vertex-count guard rails** - `1d97fab` (fix)

**Plan metadata:** Not committed here. `STATE.md` and `ROADMAP.md` were intentionally left untouched for the orchestrator.

## Files Created/Modified
- `backend/models/job.py` - Extends `StageEnum` with `ROI_AGGREGATION` and `RECOMMENDATIONS`.
- `backend/services/roi_aggregation.py` - Fetches the Destrieux fsaverage5 surface atlas, aggregates per-screen ROI bundles, and rescales native scores globally.
- `backend/core/queue.py` - Runs per-screen analyze inference, writes activation manifests, records temporary native ROI bundles, and surfaces A1 invariant failures clearly.
- `tests/test_roi.py` - Covers atlas fetch caching, region/circuit reduction, mismatch failures, and rescaling math with deterministic patched atlas payloads.
- `tests/test_per_screen_inference.py` - Covers per-screen retry behavior, empty narrative validation, 1-indexed activation paths, and A1 shape checks.
- `tests/test_queue_transitions.py` - Locks stage ordering and prevents inline string stage writes in `queue.py`.
- `tests/test_analyze.py` - Verifies per-screen analyze outputs, empty-narrative failure behavior, manifest shape, and legacy `/test-inference` isolation.
- `tests/fixtures/sim_log_3_screens.py` - Provides reusable 3-screen and empty-narrative simulation fixtures for Phase 3 tests.

## Decisions Made

- Kept the old `aggregate_roi_scores` helper for legacy compatibility instead of breaking existing Phase 1-style expectations.
- Used patched surface-atlas payloads in unit tests because the real nilearn fetch is network-backed and would make the Wave 0 and A1 suites non-deterministic in this workspace.
- Preserved `_run_inference_only` exactly as the legacy `/test-inference` path so analyze-branch changes remain scoped to jobs with linked persona/content records.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed network dependency from surface-atlas tests**
- **Found during:** Task 2 (Fix ROI aggregation correctness with fsaverage5 surface atlas)
- **Issue:** `fetch_atlas_surf_destrieux` would require a download on first test execution, which would make the unit suite fail or hang in a restricted workspace.
- **Fix:** Patched the nilearn fetch in ROI and A1 tests with deterministic fsaverage5-shaped payloads while keeping production code on the real fetch path.
- **Files modified:** `tests/test_roi.py`, `tests/test_per_screen_inference.py`
- **Verification:** `~/.venvs/brainx/bin/python -m pytest tests/test_roi.py tests/test_per_screen_inference.py -q`
- **Committed in:** `f927aee`, `1d97fab`

**2. [Rule 3 - Blocking] Upgraded analyze-path test stubs to 20,484 vertices**
- **Found during:** Task 3 (Wire per-screen inference loop and ROI stage into analyze branch)
- **Issue:** The shared Phase 2 client fixture still returns `(2, 8)` text activations, which would fail ROI aggregation before the analyze-path assertions under this plan could run.
- **Fix:** Added local analyze-test monkeypatch helpers that return `(2, 20484)` activations and a deterministic surface atlas only in tests that exercise ROI aggregation.
- **Files modified:** `tests/test_analyze.py`
- **Verification:** `~/.venvs/brainx/bin/python -m pytest tests/test_analyze.py tests/test_api.py tests/test_queue_transitions.py -q`
- **Committed in:** `48d374c`

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes were required to keep the plan executable and verifiable in the local workspace. No product-scope drift.

## Issues Encountered

- Polling for the transient `roi_aggregation` stage in `tests/test_analyze.py` was timing-sensitive. The assertion was moved to the durable `_roi_native_tmp` artifact instead of relying on race-prone stage sampling.

## User Setup Required

None - no external service configuration required for this plan's code paths.

## Known Stubs

- `backend/core/queue.py:172` stores native per-screen ROI bundles under `_roi_native_tmp`. This is an intentional temporary field for plan 03-02, which will replace it with the final schema-versioned `result_json.roi` envelope.

## Next Phase Readiness

- Plan 03-02 can now build the final `schema_version: 1` result envelope on top of persisted `activations` and `_roi_native_tmp`.
- The analyze branch now produces one activation array per screen and numerically meaningful cortical ROI bundles, which unblocks continuity and recommendations work.
- The gated `RUN_LIVE_TRIBEV2=1` probe remains available to confirm A1 against a real model without slowing the default test suite.

## Self-Check: PASSED

- Verified summary file exists at `.planning/phases/03-full-pipeline-integration-and-recommendations-engine/03-01-SUMMARY.md`.
- Verified task commits `d9a8f1d`, `f927aee`, `48d374c`, and `1d97fab` are present in git history.

---
*Phase: 03-full-pipeline-integration-and-recommendations-engine*
*Completed: 2026-04-17*
