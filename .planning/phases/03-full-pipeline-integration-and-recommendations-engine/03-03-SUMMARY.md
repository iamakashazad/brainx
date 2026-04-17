---
phase: 03-full-pipeline-integration-and-recommendations-engine
plan: 03
subsystem: api
tags: [deepseek, pydantic, pytest, queue, recommendations]
requires:
  - phase: 03-full-pipeline-integration-and-recommendations-engine
    provides: schema-versioned analyze envelope, ROI bundles, flow continuity, RECOMMENDATIONS stage placeholder
provides:
  - DeepSeek-backed recommendations model and service with evidence-grounded output
  - analyze queue wiring that persists populated recommendations in result_json
  - blind-eval and mocked integration coverage for grounded recommendation behavior
affects: [phase-4-frontend, phase-5-session-reopen, analyze-api]
tech-stack:
  added: []
  patterns: [response-model-validated LLM recommendations, sanitized queue error propagation, deterministic queue-stage test stubbing]
key-files:
  created: [backend/models/recommendations.py, backend/services/recommendations.py, tests/test_recommendations_model.py, tests/test_recommendations_prompt.py, tests/test_recommendations_integration.py, tests/test_recommendations_blind_eval.py]
  modified: [backend/core/queue.py, backend/models/results.py, tests/conftest.py, tests/test_analyze.py, tests/test_result_schema.py]
key-decisions:
  - "Keep recommendations as dumped dicts inside AnalysisResult while validating them upstream with the Recommendations Pydantic model."
  - "Normalize persona inputs at the service boundary so queue-time ORM Persona instances and API-time PersonaRead models both work."
  - "Stub queue-level recommendation generation in shared analyze-path tests so end-to-end suites stay deterministic without a live DeepSeek key."
patterns-established:
  - "Recommendations service wraps persona, simulation, ROI, and continuity data inside BEGIN/END USER CONTENT delimiters."
  - "Repeated recommendation schema failures are re-raised as DeepSeekClientError(SANITIZED_ERROR) before queue persistence."
  - "Analyze-path tests monkeypatch backend.core.queue.generate_recommendations instead of mocking raw HTTP when they only need envelope coverage."
requirements-completed: [REC-01, REC-02, REC-03, REC-04]
duration: 5min
completed: 2026-04-17
---

# Phase 03 Plan 03: Recommendations Engine Summary

**Evidence-grounded DeepSeek recommendations with blind-eval coverage and populated analyze-job recommendation envelopes**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-17T20:07:02Z
- **Completed:** 2026-04-17T20:12:26Z
- **Tasks:** 4
- **Files modified:** 11

## Accomplishments
- Added the Phase 3 recommendations schema with mandatory evidence, score ranking helpers, and prompt/integration/blind-eval test coverage.
- Implemented the recommendation service with BAD/GOOD grounding examples, BEGIN/END USER CONTENT delimiters, and sanitized re-raising for repeated schema failures.
- Replaced the queue-stage placeholder so analyze jobs now persist populated `result_json.recommendations` and analyze/result-envelope tests assert non-empty recommendation output.

## Task Commits

Each task was committed atomically:

1. **Task 1: Author recommendations Wave 0 tests** - `edb9e3e` (test)
2. **Task 2: Implement recommendations model contract** - `fdb25ab` (feat)
3. **Task 3: Implement recommendations service** - `132df0c` (feat)
4. **Task 4: Wire recommendations into analyze jobs** - `3134443` (feat)

Additional deviation fix commit:

- `d25f392` - register shared simulation fixtures for the new recommendation suites

**Plan metadata:** Not committed here. `STATE.md` and `ROADMAP.md` were intentionally left untouched for the orchestrator.

## Files Created/Modified
- `backend/models/recommendations.py` - Defines `RecEvidence`, `Recommendation`, `Recommendations`, `ScoreRank`, and `rank_score`.
- `backend/services/recommendations.py` - Builds the recommendation prompt bundle and calls `deepseek_text_completion` with sanitized failure handling.
- `backend/core/queue.py` - Calls `generate_recommendations(...)` during the RECOMMENDATIONS stage and persists dumped recommendation rows.
- `backend/models/results.py` - Documents why the envelope stores recommendation dicts after upstream validation.
- `tests/conftest.py` - Adds `persona_model_fixture`, shared sim-log fixture registration, and a deterministic queue-level recommendation stub for analyze-path tests.
- `tests/test_recommendations_model.py` - Covers mandatory evidence, `rec_type` values, bounds, and score-rank cutoffs.
- `tests/test_recommendations_prompt.py` - Locks prompt composition, BAD/GOOD example presence, and delimiter usage.
- `tests/test_recommendations_integration.py` - Verifies happy-path parsing, repair retry, and sanitized recommendation errors with respx.
- `tests/test_recommendations_blind_eval.py` - Provides the live-key-gated opposite-profile blind evaluation and skip-path smoke test.
- `tests/test_analyze.py` - Confirms analyze jobs return populated recommendations in the final result envelope.
- `tests/test_result_schema.py` - Updates the schema-envelope expectation from placeholder `[]` to populated recommendation rows.

## Decisions Made

- Kept queue persistence JSON-shaped by dumping `Recommendations` before writing to `AnalysisResult`, which avoids circular coupling in the result-envelope model.
- Reused the Phase 2 BEGIN/END USER CONTENT delimiter pattern verbatim so persona and simulation text stay bounded as data instead of instructions.
- Used a queue-level recommendation stub in shared API tests because those tests validate pipeline wiring, not live DeepSeek behavior.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Used `PersonaRead` for the new persona model fixture**
- **Found during:** Task 1 (Author recommendations Wave 0 tests)
- **Issue:** The plan assumed `backend/models/persona.py::Persona` was a Pydantic model, but the repo uses a SQLAlchemy ORM model there. A direct `.model_dump()` fixture target did not exist.
- **Fix:** Built `persona_model_fixture` around the existing `GET /personas/{id}` route and validated the response through `backend.models.schemas.PersonaRead`.
- **Files modified:** `tests/conftest.py`
- **Verification:** `~/.venvs/brainx/bin/python -c "import tests.test_recommendations_model, tests.test_recommendations_prompt, tests.test_recommendations_integration, tests.test_recommendations_blind_eval; print('parse OK')"`
- **Committed in:** `edb9e3e`

**2. [Rule 3 - Blocking] Registered the shared 3-screen simulation fixture bundle for pytest**
- **Found during:** Task 3 (Implement recommendations service)
- **Issue:** The new recommendations prompt/integration suites could not see `sim_log_3_screens`, even though Phase 3 already created the fixture module.
- **Fix:** Added `pytest_plugins = ("tests.fixtures.sim_log_3_screens",)` to `tests/conftest.py`.
- **Files modified:** `tests/conftest.py`
- **Verification:** `~/.venvs/brainx/bin/python -m pytest tests/test_recommendations_prompt.py tests/test_recommendations_integration.py tests/test_recommendations_model.py -q`
- **Committed in:** `d25f392`

**3. [Rule 3 - Blocking] Updated analyze-path test harnesses from placeholder recommendations to populated output**
- **Found during:** Task 4 (Wire recommendations into analyze jobs)
- **Issue:** Existing analyze/result-envelope tests were authored against the 03-02 placeholder `recommendations: []`, so queue integration would have broken the regression suite despite correct product behavior.
- **Fix:** Added a deterministic queue-level recommendation stub in the shared client fixture and updated analyze/result-envelope assertions to expect a populated recommendation list.
- **Files modified:** `tests/conftest.py`, `tests/test_analyze.py`, `tests/test_result_schema.py`
- **Verification:** `~/.venvs/brainx/bin/python -m pytest tests/test_recommendations_model.py tests/test_recommendations_prompt.py tests/test_recommendations_integration.py tests/test_recommendations_blind_eval.py tests/test_analyze.py tests/test_result_schema.py -q`
- **Committed in:** `3134443`

---

**Total deviations:** 3 auto-fixed (3 blocking)
**Impact on plan:** All three fixes were required to align the plan with the actual repo contracts and keep the regression suite green. No product-scope drift.

## Issues Encountered

- The workspace does not currently expose `DEEPSEEK_API_KEY`, so the live blind-eval gate could only be verified through its skip path here.

## User Setup Required

- `DEEPSEEK_API_KEY` is required for the live blind-eval (`tests/test_recommendations_blind_eval.py`) and for production recommendation generation in the analyze queue.
- In this workspace the key was absent, so the blind-eval suite ran as `1 passed, 1 skipped`.

## Next Phase Readiness

- Phase 4 can now consume populated `result_json.recommendations` alongside ROI and continuity data without another queue contract change.
- The queue-stage recommendation call is isolated behind `backend/services/recommendations.py`, so future prompt or model changes stay out of the pipeline orchestration path.
- A live DeepSeek blind-eval run is still required in a keyed environment to record the actual Jaccard score for the Phase 3 gate.

## Self-Check: PASSED

- Verified summary file exists at `.planning/phases/03-full-pipeline-integration-and-recommendations-engine/03-03-SUMMARY.md`.
- Verified commits `edb9e3e`, `fdb25ab`, `d25f392`, `132df0c`, and `3134443` are present in git history.

---
*Phase: 03-full-pipeline-integration-and-recommendations-engine*
*Completed: 2026-04-17*
