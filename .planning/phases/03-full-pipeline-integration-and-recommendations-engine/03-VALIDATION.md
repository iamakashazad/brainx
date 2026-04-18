---
phase: 3
slug: full-pipeline-integration-and-recommendations-engine
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-17
updated: 2026-04-18
---

# Phase 3 — Validation Strategy

> Retroactive Nyquist validation audit for the completed Phase 3 codebase.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.x (pytest-asyncio 0.23.x) |
| **Config file** | `pytest.ini` (repo root) + `tests/conftest.py` |
| **Primary phase run** | `~/.venvs/brainx/bin/python -m pytest -q tests/test_roi.py tests/test_per_screen_inference.py tests/test_queue_transitions.py tests/test_analyze.py tests/test_continuity.py tests/test_result_schema.py tests/test_recommendations_model.py tests/test_recommendations_prompt.py tests/test_recommendations_integration.py tests/test_recommendations_behavioral.py tests/test_recommendations_blind_eval.py` |
| **Observed result** | `81 passed, 2 skipped` |
| **Live gate command** | `DEEPSEEK_API_KEY=[set] ~/.venvs/brainx/bin/python -m pytest -q tests/test_recommendations_blind_eval.py::test_blind_eval_differentiates_opposite_profiles -s` |
| **Live gate proof** | Passing metrics recorded in `03-BLIND-EVAL.md` for commit `9912e3f` |
| **Estimated runtime** | ~3 seconds local phase suite, ~60–90 seconds live blind-eval |

---

## Sampling Rate

- After recommendation/ROI implementation changes: run the focused slice for `tests/test_roi.py`, `tests/test_recommendations_integration.py`, `tests/test_recommendations_behavioral.py`, and `tests/test_recommendations_prompt.py`
- Before Phase 3 verification or handoff to Phase 4: run the full Phase 3 surface listed above
- Before shipping recommendation changes that touch live behavior: rerun the live blind-eval with `DEEPSEEK_API_KEY` set

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-XX | 01 | — | BRAIN-01, BRAIN-02 | — | Vertex-count mismatches fail closed before ROI reduction | unit/integration | `~/.venvs/brainx/bin/python -m pytest -q tests/test_roi.py tests/test_per_screen_inference.py tests/test_queue_transitions.py tests/test_analyze.py` | ✅ | ✅ green |
| 03-02-XX | 02 | — | BRAIN-03, BRAIN-04 | — | Final `result_json` envelope validated before DONE persistence | unit/integration | `~/.venvs/brainx/bin/python -m pytest -q tests/test_continuity.py tests/test_result_schema.py tests/test_analyze.py` | ✅ | ✅ green |
| 03-03-XX | 03 | — | REC-01 | — | Recommendation schema failures and API failures sanitize correctly | unit/integration | `~/.venvs/brainx/bin/python -m pytest -q tests/test_recommendations_model.py tests/test_recommendations_prompt.py tests/test_recommendations_integration.py tests/test_recommendations_blind_eval.py` | ✅ | ✅ green |
| 03-04-XX | 04 | — | REC-02, REC-03, REC-04 | — | Missing behavioral coverage fails closed with sanitized error | unit/integration | `~/.venvs/brainx/bin/python -m pytest -q tests/test_recommendations_behavioral.py tests/test_recommendations_integration.py tests/test_analyze.py tests/test_result_schema.py` | ✅ | ✅ green |
| 03-05-XX | 05 | — | REC-01, REC-02, REC-03, REC-04 | — | Live model output must differentiate profiles and cite valid ROI evidence | live integration | `DEEPSEEK_API_KEY=[set] ~/.venvs/brainx/bin/python -m pytest -q tests/test_recommendations_blind_eval.py::test_blind_eval_differentiates_opposite_profiles -s` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Coverage Summary

- `tests/test_roi.py` covers fsaverage5 atlas wiring, region/circuit reduction, global rescaling, and the flat-bundle normalization edge case
- `tests/test_per_screen_inference.py` covers retry-once inference, screen file naming, empty narrative guards, and A1 vertex-count invariants
- `tests/test_queue_transitions.py` covers StageEnum ordering and transition-only stage writes
- `tests/test_continuity.py` and `tests/test_result_schema.py` cover continuity math and the schema-versioned result envelope
- `tests/test_recommendations_model.py`, `tests/test_recommendations_prompt.py`, `tests/test_recommendations_integration.py`, `tests/test_recommendations_behavioral.py`, and `tests/test_recommendations_blind_eval.py` cover the recommendation contract from schema through live-key blind differentiation
- `tests/test_analyze.py` proves the queue-owned end-to-end analyze lifecycle and persisted recommendation payload shape

---

## Manual-Only Verifications

None required for Phase 3 requirement closure.

Optional higher-confidence checks that remain useful but are not required for Nyquist compliance:

- Live TRIBEv2 A1 probe with `RUN_LIVE_TRIBEV2=1`
- Human review of recommendation prose quality on a real analyze job

---

## Validation Audit 2026-04-18

| Metric | Count |
|--------|-------|
| Gaps found | 1 |
| Resolved | 1 |
| Escalated | 0 |

Resolved gap:

- `tests/test_recommendations_model.py::test_rec_type_discriminator_values` still reflected the pre-03-04 `layout_flag` contract and was updated to require a simulation identifier payload.

---

## Validation Sign-Off

- [x] All Phase 3 requirement groups have automated verification
- [x] Wave 0 test infrastructure exists on disk
- [x] No validation gap remains open after audit
- [x] Live blind-eval proof artifact exists for a passing keyed run
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** complete
