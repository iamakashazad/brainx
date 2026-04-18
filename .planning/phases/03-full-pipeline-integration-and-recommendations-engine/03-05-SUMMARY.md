---
phase: 03-full-pipeline-integration-and-recommendations-engine
plan: 05
subsystem: verification
tags: [deepseek, blind-eval, verification-gap, live-api]
requires:
  - phase: 03-full-pipeline-integration-and-recommendations-engine
    provides: live blind-eval test path and 03-04 behavioral recommendation enforcement
provides:
  - machine-readable blind-eval metrics path in the live test
  - durable blind-eval evidence artifact with a real PASS verdict
affects: [03-VERIFICATION, phase-4-frontend, analyze-api]
tech-stack:
  added: []
  patterns: [live-api proof artifact, prompt-guided behavioral retries, evidence-region normalization, roi-grounded evidence validation, redacted command recording]
key-files:
  created: [.planning/phases/03-full-pipeline-integration-and-recommendations-engine/03-BLIND-EVAL.md]
  modified: [backend/services/recommendations.py, backend/services/roi_aggregation.py, tests/test_recommendations_integration.py, tests/test_recommendations_prompt.py, tests/test_recommendations_blind_eval.py, tests/test_roi.py]
key-decisions:
  - "Retry once with explicit behavioral requirements when the live model misses required recommendation coverage."
  - "Normalize invalid evidence-region labels to a valid atlas label for the cited circuit before final validation."
  - "Validate recommendation activation scores against the ROI bundle and correct stale score_rank labels at the service boundary."
  - "Redact the command secret while still preserving enough execution metadata to audit the live run."
patterns-established:
  - "The recommendation prompt now states the exact per-screen behavioral obligations inferred from simulation, ROI, and continuity inputs."
  - "Live blind-eval failures can be repaired by a single deterministic retry that feeds the missing coverage back into the prompt."
  - "Recommendation evidence is now checked against real ROI values before persistence."
  - "Phase verification artifacts must preserve the live metrics payload and verdict for auditability."
requirements-completed: [D-18]
duration: 1h47m
completed: 2026-04-18
---

# Phase 03 Plan 05: Live Blind Eval Summary

**The live DeepSeek blind-eval now passes with differentiated, score-citing, atlas-valid, ROI-validated recommendation bundles**

## Performance

- **Duration:** 1h47m
- **Started:** 2026-04-18T10:58:00Z
- **Completed:** 2026-04-18T12:44:47Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Added `BLIND_EVAL_METRICS=` support and a reusable metrics helper to the live blind-eval test file.
- Verified the no-key path still behaves correctly (`1 passed, 1 skipped`).
- Hardened the recommendation service so live runs retry with explicit behavioral requirements when `layout_flag`, `memorability`, or `emotional_dropoff` coverage is missing.
- Normalized invalid evidence-region labels to valid atlas labels for the cited circuit before final validation.
- Added service-side validation that recommendation evidence cites real ROI scores, and corrected the flat-bundle ROI normalization edge case.
- Re-ran the real keyed blind-eval against DeepSeek on commit `9912e3f` and recorded the passing result in `03-BLIND-EVAL.md`.

## Task Commits

1. **Task 1: Make the live blind-eval emit auditable metrics**
   - `25a6829` (`test`) — add blind-eval metrics output
2. **Task 2: Unblock the live blind-eval and record the passing rerun**
   - `dba7554` (`feat`) — harden live recommendation grounding
   - `9912e3f` (`fix`) — harden recommendation evidence validation

## Files Created/Modified

- `backend/services/recommendations.py` - Adds prompt-level behavioral requirement summaries, one retry on missing coverage, evidence-region normalization, strict circuit/region validation, and ROI-grounded evidence checks.
- `backend/services/roi_aggregation.py` - Fixes flat-bundle normalization so zero-signal bundles remain at `0.0`.
- `tests/test_recommendations_prompt.py` - Verifies the user prompt includes the inferred behavioral requirements and retry reason.
- `tests/test_recommendations_integration.py` - Verifies retry-on-missing-coverage, invalid-region normalization, and invalid-score rejection behavior.
- `tests/test_roi.py` - Verifies flat ROI bundles normalize to zero rather than `100.0`.
- `tests/test_recommendations_blind_eval.py` - Emits `BLIND_EVAL_METRICS=` for live keyed runs.
- `.planning/phases/03-full-pipeline-integration-and-recommendations-engine/03-BLIND-EVAL.md` - Records the live keyed rerun with a redacted command, commit sha, metrics payload, and `PASS` verdict.

## Outcome

The live DeepSeek call now passes the full opposite-profile blind-eval:

- `jaccard_similarity = 0.2395`
- `recommendation_count_high = 5`
- `recommendation_count_low = 4`
- `cited_scores_verified = true`
- `valid_circuit_region_pairs = true`

The earlier failure mode was eliminated by making the prompt explicitly enumerate required behavioral outputs, normalizing invalid evidence-region labels, and validating recommendation evidence against the ROI bundle before final persistence.

## User Setup Required

None for re-running the same live blind-eval, provided a valid `DEEPSEEK_API_KEY` is available.

## Next Phase Readiness

- Phase 03 no longer has an open live blind-eval blocker.
- The backend contract is stable enough for Phase 4 UI work.

## Verification

- `~/.venvs/brainx/bin/python -m pytest -q tests/test_roi.py tests/test_recommendations_integration.py tests/test_recommendations_behavioral.py tests/test_recommendations_prompt.py` → `33 passed`
- `~/.venvs/brainx/bin/python -m pytest -q tests/test_recommendations_behavioral.py tests/test_recommendations_integration.py tests/test_recommendations_prompt.py tests/test_analyze.py tests/test_result_schema.py tests/test_roi.py` → `53 passed`
- Live keyed run of `tests/test_recommendations_blind_eval.py::test_blind_eval_differentiates_opposite_profiles -s` → `PASS`

## Self-Check: PASSED

- Summary artifact exists and matches the passing live rerun.
- `03-BLIND-EVAL.md` records the passing metrics payload for commit `9912e3f`.

---
*Phase: 03-full-pipeline-integration-and-recommendations-engine*
*Completed: 2026-04-18*
