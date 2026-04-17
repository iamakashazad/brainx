---
phase: 3
slug: full-pipeline-integration-and-recommendations-engine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-17
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.x (pytest-asyncio 0.23.x) |
| **Config file** | `backend/pyproject.toml` + `backend/tests/conftest.py` |
| **Quick run command** | `cd backend && pytest -x --ff -q` |
| **Full suite command** | `cd backend && pytest -q` |
| **Estimated runtime** | ~45 seconds (quick), ~3 minutes (full with blind-eval if DEEPSEEK_API_KEY set) |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && pytest -x --ff -q tests/<most-recent-test-file>.py`
- **After every plan wave:** Run `cd backend && pytest -q`
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

- [ ] `backend/tests/test_roi_aggregation_surface.py` — D-15 fsaverage5 atlas wiring, vertex-count assertion (A1), per-region mean/peak math
- [ ] `backend/tests/test_per_screen_inference.py` — BRAIN-01 per-screen activation arrays, `activations/{job_id}/screen_{n}.npy` file layout, retry-once policy
- [ ] `backend/tests/test_continuity.py` — BRAIN-03 deterministic trend classification (rising/dropping/flat/volatile) over fabricated score series
- [ ] `backend/tests/test_recommendations_model.py` — Pydantic schema validation for flat discriminated list, mandatory `evidence` field, score_rank cutoffs
- [ ] `backend/tests/test_recommendations_blind_eval.py` — REC-01..04 blind differentiation (Jaccard < 0.4), live DEEPSEEK_API_KEY gate, pytest.skip fallback
- [ ] `backend/tests/test_result_schema.py` — `result_json` schema_version=1 round-trip, activations path resolution, all required keys present
- [ ] `backend/tests/test_pipeline_e2e.py` — End-to-end `POST /analyze` → queue → DONE with 3-screen fixture flow, asserts all stage transitions via `Job.stage` history
- [ ] `backend/tests/test_stage_enum.py` — ROI_AGGREGATION and RECOMMENDATIONS stages present in StageEnum, order preserved, `transition()` enforcement
- [ ] `backend/tests/fixtures/sim_log_3_screens.py` — Shared 3-screen SimulationLog fixture (referenced by e2e and recommendations tests)

*Test files that already exist in `backend/tests/` from Phase 2 (conftest, test_deepseek_client, test_simulation, test_grounding) are reused as-is — no regressions expected.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| TRIBEv2 output vertex count exactly matches fsaverage5 bilateral total (A1) | BRAIN-01 | Requires live model inference — cannot be pure unit test | Run Phase 1 smoke test, print `preds.shape`, assert matches `map_left.shape[0] + map_right.shape[0]` |
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
