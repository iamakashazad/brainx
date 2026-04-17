---
phase: 03-full-pipeline-integration-and-recommendations-engine
plan: 02
subsystem: api
tags: [pydantic, pytest, continuity, roi, queue]
requires:
  - phase: 03-full-pipeline-integration-and-recommendations-engine
    provides: native per-screen ROI bundles, activation manifests, ROI_AGGREGATION stage wiring
provides:
  - schema_version 1 analyze result envelope persisted on DONE
  - deterministic per-circuit flow continuity with trend tags
  - globally rescaled per-screen ROI payloads for downstream recommendations and UI consumers
affects: [03-03, phase-4-frontend, phase-5-session-reopen]
tech-stack:
  added: []
  patterns: [schema-versioned result envelope, deterministic continuity classification, global ROI rescaling at write time]
key-files:
  created: [backend/models/continuity.py, backend/models/results.py, backend/services/continuity.py, tests/test_continuity.py]
  modified: [backend/core/queue.py, tests/test_result_schema.py, tests/test_analyze.py]
key-decisions:
  - "Keep `recommendations` as an intentional empty list stub in the envelope so plan 03-03 can fill it without changing the contract."
  - "Write the final envelope directly from in-memory ROI bundles instead of persisting `_roi_native_tmp` to `result_json`."
  - "Treat continuity classification as pure deterministic logic with module-level thresholds, not a prompt-driven interpretation step."
patterns-established:
  - "Analyze jobs validate the final `result_json` through `AnalysisResult` before marking the job DONE."
  - "Global 0..100 ROI rescaling happens once during PROCESSING, then continuity and downstream consumers share that normalized payload."
  - "Stage progression now reaches RECOMMENDATIONS even when that stage is still a placeholder, preserving the final lifecycle contract."
requirements-completed: [BRAIN-03, BRAIN-04]
duration: 4min
completed: 2026-04-17
---

# Phase 03 Plan 02: Continuity and Result Envelope Summary

**Schema-versioned analyze results with rescaled ROI tables, deterministic flow continuity, and a stable recommendations-ready envelope**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-17T19:55:06Z
- **Completed:** 2026-04-17T19:58:40Z
- **Tasks:** 4
- **Files modified:** 7

## Accomplishments
- Added Pydantic v2 models for flow continuity and the `schema_version: 1` analyze result envelope.
- Implemented deterministic continuity scoring with tunable module-level thresholds and full per-circuit per-screen deltas.
- Reworked the analyze queue `PROCESSING` path to rescale ROI globally, compute continuity, transition through `RECOMMENDATIONS`, and persist the final 7-key envelope without `_roi_native_tmp`.
- Added Wave 0 and integration tests that lock the continuity contract, final result schema, and stage progression behavior.

## Task Commits

Each task was committed atomically:

1. **Task 1: Author continuity and schema red tests** - `76e3e8b` (test)
2. **Task 2: Add continuity and result envelope models** - `a9a35bf` (feat)
3. **Task 3: Implement deterministic continuity service** - `5895f99` (feat)
4. **Task 4: Write schema v1 analyze envelope in queue flow** - `a086e9b` (feat)

**Plan metadata:** Summary committed separately. `STATE.md` and `ROADMAP.md` were intentionally left untouched for the orchestrator.

## Files Created/Modified
- `tests/test_continuity.py` - Red-to-green coverage for `classify_trend`, `compute_flow_continuity`, and module-level threshold constants.
- `tests/test_result_schema.py` - End-to-end analyze assertions for the 7-key envelope, per-screen ROI structure, continuity shape, size budget, and recommendations placeholder.
- `backend/models/continuity.py` - Pydantic models for continuity points, per-circuit continuity, and the top-level flow payload.
- `backend/models/results.py` - Pydantic models for the final analyze envelope, activation manifest entries, and per-screen ROI rows.
- `backend/services/continuity.py` - Deterministic continuity classifier and flow continuity builder.
- `backend/core/queue.py` - PROCESSING/RECOMMENDATIONS wiring, global ROI rescaling, final envelope validation, and DONE persistence.
- `tests/test_analyze.py` - Updated analyze integration assertions to the schema v1 envelope and full stage progression logging.

## Decisions Made

- Persisted the final result only after it passes `AnalysisResult` validation so downstream phases consume one stable shape.
- Removed `_roi_native_tmp` from the persisted job payload instead of carrying a transitional internal key forward.
- Kept `recommendations: []` as an explicit placeholder in this plan because 03-03 owns the LLM call, but the envelope contract is already fixed here.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Parallel `git add` calls intermittently hit a transient `.git/index.lock`. Staging was retried serially and did not affect code or verification results.

## User Setup Required

None - no external service configuration required for this plan.

## Known Stubs

- `backend/core/queue.py` writes `recommendations: []` into the final envelope. This is intentional for plan 03-03, which replaces the placeholder with the DeepSeek-backed recommendations bundle.

## Next Phase Readiness

- Plan 03-03 can plug the recommendations generator into the already-stable `schema_version: 1` envelope without changing queue output structure.
- Phase 4 and Phase 5 now have a normalized `roi` table and `flow_continuity` payload to consume directly from `Job.result_json`.
- Relevant tests are green:
  - `~/.venvs/brainx/bin/python -m pytest -q tests/test_result_schema.py`
  - `~/.venvs/brainx/bin/python -m pytest -q tests/test_analyze.py tests/test_continuity.py tests/test_roi.py tests/test_queue_transitions.py tests/test_api.py`

## Self-Check: PASSED

- Verified summary file exists at `.planning/phases/03-full-pipeline-integration-and-recommendations-engine/03-02-SUMMARY.md`.
- Verified task commits `76e3e8b`, `a9a35bf`, `5895f99`, and `a086e9b` are present in git history.

---
*Phase: 03-full-pipeline-integration-and-recommendations-engine*
*Completed: 2026-04-17*
