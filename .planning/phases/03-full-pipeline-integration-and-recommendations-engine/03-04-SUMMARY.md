---
phase: 03-full-pipeline-integration-and-recommendations-engine
plan: 04
subsystem: api
tags: [recommendations, pytest, queue, verification-gap]
requires:
  - phase: 03-full-pipeline-integration-and-recommendations-engine
    provides: recommendations service, queue persistence, verification gap report
provides:
  - enforced REC-02/03/04 behavioral coverage at the recommendations boundary
  - analyze/result-schema persistence coverage for mixed recommendation types
  - removal of the hidden copy-only queue stub from the shared client fixture
affects: [03-05, phase-4-frontend, analyze-api]
tech-stack:
  added: []
  patterns: [behavioral recommendation enforcement, scoped queue stubs, mixed recommendation persistence]
key-files:
  created: [tests/test_recommendations_behavioral.py]
  modified: [backend/models/recommendations.py, backend/services/recommendations.py, tests/conftest.py, tests/test_recommendations_integration.py, tests/test_analyze.py, tests/test_result_schema.py]
key-decisions:
  - "Enforce REC-02/03/04 at the service boundary with deterministic trigger rules instead of relying on prompt text alone."
  - "Move recommendation stubbing out of the shared client fixture so queue integration tests can opt into the payload they need."
  - "Use a mixed recommendation bundle aligned to `sim_log_3_screens` so persisted queue assertions prove layout_flag, memorability, and emotional_dropoff survive end-to-end."
patterns-established:
  - "layout_flag recommendations must preserve a simulation-derived target_region and/or element_description."
  - "Trigger-heavy recommendation bundles fail closed with a sanitized DeepSeekClientError when required behavior coverage is missing."
  - "Analyze-path tests explicitly assert mixed recommendation types instead of inferring recommendation success from a single copy-only stub."
requirements-completed: [REC-02, REC-03, REC-04]
duration: 20min
completed: 2026-04-18
---

# Phase 03 Plan 04: Behavioral Recommendation Gap Closure Summary

**REC-02/03/04 are now enforced and demonstrated end-to-end, not merely allowed by the schema**

## Performance

- **Duration:** 20 min
- **Started:** 2026-04-18T10:36:00Z
- **Completed:** 2026-04-18T10:58:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Added deterministic service-side enforcement for `layout_flag`, `memorability`, and `emotional_dropoff` when ROI/simulation/continuity inputs clearly require them.
- Tightened the recommendation model so `layout_flag` cannot validate without a simulation-derived identifier payload.
- Removed the hidden copy-only queue recommendation stub from the shared `client` fixture and replaced it with explicit test-side installation.
- Updated analyze/result-schema/integration coverage to prove mixed recommendation types persist through `result_json.recommendations`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Enforce REC-02/03/04 coverage at the recommendation boundary**
   - `e0faea7` (`test`) — add failing behavioral recommendation coverage tests
   - `5ab2718` (`feat`) — enforce behavioral recommendation coverage
2. **Task 2: Prove mixed recommendation types survive the analyze pipeline**
   - `65785ce` (`test`) — preserve mixed recommendation types in analyze flow

**Plan metadata:** `STATE.md` and `ROADMAP.md` were intentionally left untouched for the orchestrator.

## Files Created/Modified
- `tests/test_recommendations_behavioral.py` - Adds trigger-heavy behavioral tests for `layout_flag`, `memorability`, and `emotional_dropoff`.
- `backend/models/recommendations.py` - Enforces layout-flag identifier requirements at model validation time.
- `backend/services/recommendations.py` - Adds `validate_behavioral_coverage(...)` and deterministic trigger thresholds for missing recommendation categories.
- `tests/conftest.py` - Replaces the hidden client-fixture recommendation stub with explicit mixed-payload helper fixtures.
- `tests/test_recommendations_integration.py` - Verifies the service accepts and parses a mixed recommendation bundle aligned to `sim_log_3_screens`.
- `tests/test_analyze.py` - Confirms queue-persisted recommendations include the mixed gap-closure types.
- `tests/test_result_schema.py` - Confirms `result_json.recommendations` preserves `layout_flag`, `memorability`, and `emotional_dropoff` with identifiers and screen references.

## Decisions Made

- Used simulation-derived event identifiers from `sim_log_3_screens` in the mixed persistence bundle so the stricter layout validation matches real fixture data.
- Kept the service failure mode sanitized by re-raising incomplete behavioral coverage as `DeepSeekClientError(SANITIZED_ERROR)`.
- Left blind-eval execution out of this plan; that remains owned by `03-05`.

## Deviations from Plan

None - the plan executed as intended after the interrupted first worker left only a red-test commit and partial model work.

## Issues Encountered

- The first Wave 4 executor stalled after landing the red behavioral test commit. The remaining work was resumed from the partial tree without reverting its changes.
- A transient `.git/index.lock` surfaced while committing task slices in parallel; the second task commit was retried sequentially and completed cleanly.

## User Setup Required

None - this gap-closure plan remains fully local and does not require external services.

## Next Phase Readiness

- `03-05` can now focus exclusively on the live DeepSeek blind-eval metrics and proof artifact.
- The remaining Phase 3 verification gap is narrowed to the keyed blind-eval run and its recorded evidence.

## Verification

- `~/.venvs/brainx/bin/python -m pytest -q tests/test_recommendations_behavioral.py tests/test_recommendations_integration.py` → `8 passed`
- `~/.venvs/brainx/bin/python -m pytest -q tests/test_recommendations_behavioral.py tests/test_recommendations_integration.py tests/test_analyze.py tests/test_result_schema.py` → `28 passed`
- `rg -n "copy_rewrite" tests/conftest.py` → no matches

## Self-Check: PASSED

- Verified summary file exists at `.planning/phases/03-full-pipeline-integration-and-recommendations-engine/03-04-SUMMARY.md`.
- Verified commits `e0faea7`, `5ab2718`, and `65785ce` are present in git history.

---
*Phase: 03-full-pipeline-integration-and-recommendations-engine*
*Completed: 2026-04-18*
