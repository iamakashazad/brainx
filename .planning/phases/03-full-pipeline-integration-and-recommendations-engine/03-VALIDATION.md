---
phase: 3
slug: full-pipeline-integration-and-recommendations-engine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-17
updated: 2026-04-17
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.x (pytest-asyncio 0.23.x) |
| **Config file** | `pytest.ini` (repo root) + `tests/conftest.py` — `testpaths = tests` |
| **Quick run command** | `pytest -x --ff -q` |
| **Full suite command** | `pytest -q` |
| **Estimated runtime** | ~45 seconds (quick), ~3 minutes (full with blind-eval if DEEPSEEK_API_KEY set) |

---

## Sampling Rate

- **After every task commit:** Run `pytest -x --ff -q tests/<most-recent-test-file>.py`
- **After every plan wave:** Run `pytest -q`
- **Before `/gsd-verify-work`:** Full suite must be green; blind-eval test must run at least once with live DEEPSEEK_API_KEY
- **Max feedback latency:** 45 seconds for quick, 180 seconds for full

---

## Per-Task Verification Map

> Populated by gsd-planner at planning time from PLAN.md task IDs. Each row maps a task to the automated command that proves it.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-XX | 01 | — | BRAIN-01/02 | — | — | unit/integration | TBD by planner | ❌ W0 | ⬜ pending |
| 03-02-XX | 02 | — | BRAIN-03/04 | — | — | unit/integration | TBD by planner | ❌ W0 | ⬜ pending |
| 03-03-XX | 03 | — | REC-01..04 | — | — | integration/blind-eval | TBD by planner | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

> Test infrastructure gaps identified in 03-RESEARCH.md Validation Architecture. Planner MUST ensure these are authored before any task claims them as its automated verification.
>
> **Note:** All test paths below are under `tests/` (matching `pytest.ini testpaths = tests`). Several assertions are NOT net-new files — they **extend** existing test files that already live in `tests/`. This map reflects the actual files the plans create or extend.

### Extensions to existing test files

- [ ] `tests/test_roi.py` — D-15 fsaverage5 atlas wiring, vertex-count assertion (A1), per-region mean/peak math.
  - **Plan 03-01 Task 1** appends these classes (existing `TestROICircuitMap` is preserved):
    - `TestSurfaceAtlas` — atlas shape, LRU cache, label encoding, label-id range
    - `TestAggregateScreenROI` — 5 circuits + ≤15 regions, vertex-count mismatch ValueError, mean/peak reductions
    - `TestRescale` — 0..100 bounds, global rescale scope
- [ ] `tests/test_analyze.py` — End-to-end `POST /analyze` → queue → DONE assertions.
  - **Plan 03-01 Task 3** appends: `test_per_screen_files_written`, `test_empty_narrative_errors`, `test_activations_manifest_shape`, `test_legacy_test_inference_single_shot`
  - **Plan 03-02 Task 4** appends: `test_stage_progression` (caplog over SIMULATION → GROUNDING_CHECK → INFERENCE → ROI_AGGREGATION → PROCESSING → RECOMMENDATIONS)
  - **Plan 03-03 Task 4** appends: `test_analyze_populates_recommendations_via_mock`
- [ ] `tests/test_queue_transitions.py` — ROI_AGGREGATION + RECOMMENDATIONS stages in StageEnum, declaration order preserved, `transition()` enforcement.
  - **Plan 03-01 Task 1** appends: `test_stage_enum_order`, `test_stage_enum_values`, `test_no_inline_stage_writes`

### New test files created by Phase 3 plans

- [ ] `tests/test_per_screen_inference.py` — BRAIN-01/02 per-screen activation arrays, retry-once policy, A1 guard-rails.
  - **Plan 03-01 Task 1** creates the file with `TestRunScreenInferenceWithRetry`, `TestActivationsFilesystem`, `TestEmptyNarrativeGuard` (xfail until Task 3 wires the analyze branch)
  - **Plan 03-01 Task 4** appends `TestAssumptionA1VertexCount` (live-gated via `RUN_LIVE_TRIBEV2`)
- [ ] `tests/test_continuity.py` — BRAIN-03 deterministic trend classification + compute_flow_continuity + module-level constants.
  - **Plan 03-02 Task 1** creates with `TestClassifyTrend` (rising/dropping/flat/volatile), `TestComputeFlowContinuity`, `TestModuleLevelConstants`
- [ ] `tests/test_result_schema.py` — D-19 `result_json` schema_version=1 envelope + round-trip + size budget + per-screen roi shape.
  - **Plan 03-02 Task 1** creates with `TestResultEnvelope` (keys, schema_version round-trip, per-screen ROI shape, size < 100KB, activations-not-inlined, recommendations slot is list, stage progression caplog) and `TestModelImports`
- [ ] `tests/test_recommendations_model.py` — D-09 Pydantic schema validation for flat discriminated list, mandatory `evidence`, `score_rank` cutoffs.
  - **Plan 03-03 Task 1** creates with `TestRecommendationsPydantic`, `TestRankScore`, `TestScoreRankThresholdsIsModuleLevel`
- [ ] `tests/test_recommendations_prompt.py` — Prompt composition (4-bundle input, BEGIN/END USER CONTENT delimiters, no image data).
  - **Plan 03-03 Task 1** creates with `TestBuildRecUserPrompt`, `TestBuildRecSystemPrompt`
- [ ] `tests/test_recommendations_integration.py` — Respx-mocked DeepSeek call through `generate_recommendations`: happy path, repair retry, sanitized error.
  - **Plan 03-03 Task 1** creates with `TestGenerateRecommendationsHappyPath`, `TestGenerateRecommendationsRepairRetry`, `TestGenerateRecommendationsErrorSanitization`
- [ ] `tests/test_recommendations_blind_eval.py` — REC-01..04 blind differentiation (Jaccard < 0.4), live `DEEPSEEK_API_KEY` gate, `pytest.skip` fallback.
  - **Plan 03-03 Task 1** creates the file + `test_skips_cleanly_without_key` (always-runs); `test_blind_eval_differentiates_opposite_profiles` is gated by `@skip_without_live_key`

### New fixtures

- [ ] `tests/fixtures/sim_log_3_screens.py` — Shared 3-screen `SimulationLog` fixture (referenced by per-screen inference, result-schema, and recommendations tests). Also defines `empty_narrative_screen` for the D-03 guard test.
  - **Plan 03-01 Task 1** creates this + `tests/fixtures/__init__.py`
- [ ] `persona_model_fixture` added to `tests/conftest.py` — returns a Pydantic `Persona` model loaded by ID, distinct from the existing `persona_fixture` which returns a `str` (persona_id).
  - **Plan 03-03 Task 1** adds this fixture alongside the test file creations (see 03-03 Task 1 action step for exact shape).
  - **Consumers:** `tests/test_recommendations_integration.py`, `tests/test_recommendations_blind_eval.py`, and any `generate_recommendations(...)` call in `tests/test_analyze.py` (Plan 03-03 Task 4).

*Existing test files from Phase 2 (`conftest.py`, `test_deepseek_client.py`, `test_simulation.py`, `test_grounding.py`) remain unchanged — no regressions expected. `test_api.py` continues to cover the legacy `/test-inference` path (D-04).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| TRIBEv2 output vertex count exactly matches fsaverage5 bilateral total (A1) | BRAIN-01 | Requires live model inference — cannot be pure unit test | Run Phase 1 smoke test with `RUN_LIVE_TRIBEV2=1`, print `preds.shape`, assert matches `map_left.shape[0] + map_right.shape[0]` (20,484). The gated `TestAssumptionA1VertexCount::test_live_tribev2_output_shape` in `tests/test_per_screen_inference.py` automates this check when the env var is set. |
| Recommendations prose quality (beyond schema validity) | REC-01..04 | LLM output semantic quality cannot be unit-tested | Read `result_json.recommendations` from a real 3-screen analyze job; verify rationales reference cited regions meaningfully |
| Destrieux atlas fetch caches to `model_cache/nilearn/` | D-15, PITFALLS | Network side-effect; first run populates cache, subsequent runs offline | Delete `model_cache/nilearn/`, run ROI aggregation once, confirm cache directory repopulated and second run works without network |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s quick / 180s full
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
