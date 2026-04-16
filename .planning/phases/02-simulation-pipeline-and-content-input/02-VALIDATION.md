---
phase: 2
slug: simulation-pipeline-and-content-input
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-15
updated: 2026-04-16
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `02-RESEARCH.md` §Validation Architecture. All rows below
> are verified against the shipped implementation (commit `8e53611`).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.x + pytest-asyncio 0.24.x (inherited from Phase 1) |
| **Config file** | `pytest.ini` (root; `testpaths = tests`) |
| **Quick run command** | `pytest tests/test_personas_api.py tests/test_content_api.py tests/test_analyze.py -x -q` |
| **Full suite command** | `pytest -x` |
| **Measured runtime** | 1.19 s for the full 48-test Phase 1+2 suite |
| **HTTP mocking** | `respx` for all DeepSeek / Replicate calls |
| **DB isolation** | per-test `tmp_path / test.db` via `tests/conftest.py` fixture |
| **GPU isolation** | monkeypatch of `run_tribev2_text` / `run_tribev2_video` |

---

## Sampling Rate

- **After every task commit:** Run `pytest -x -q`
- **After every plan wave:** Run `pytest -x` (Phase 1 + Phase 2 combined)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~2 seconds (measured)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 02-01 | 1 | PERS-01 | — | persona round-trip persists | integration | `pytest tests/test_personas_api.py::test_create_roundtrip -x` | ✅ existing | ✅ green |
| 02-01-01 | 02-01 | 1 | PERS-01 | — | missing-required → 422 | integration | `pytest tests/test_personas_api.py::test_create_rejects_missing -x` | ✅ existing | ✅ green |
| 02-01-02 | 02-01 | 1 | PERS-02 | — | cognitive_state persists | integration | `pytest tests/test_personas_api.py::test_cognitive_state_persists -x` | ✅ existing | ✅ green |
| 02-01-02 | 02-01 | 1 | PERS-02 | — | cognitive_state enum reject | integration | `pytest tests/test_personas_api.py::test_cognitive_state_enum_reject -x` | ✅ existing | ✅ green |
| 02-01-03 | 02-01 | 1 | PERS-03 | — | environment persists + enum reject | integration | `pytest tests/test_personas_api.py::test_environment_persists -x` | ✅ existing | ✅ green |
| 02-01-04 | 02-01 | 1 | PERS-04 | — | same persona reused across 2 jobs | integration | `pytest tests/test_persona_reuse.py::test_persona_reused_across_jobs -x` | ✅ existing | ✅ green |
| 02-01-05 | 02-01 | 1 | PERS CRUD | — | list + get 404 | integration | `pytest tests/test_personas_api.py::test_list_personas tests/test_personas_api.py::test_get_persona_404 -x` | ✅ existing | ✅ green |
| 02-01-05 | 02-01 | 1 | PERS CRUD | T-02-01-4 | PATCH whole-dict reassignment persists | integration | `pytest tests/test_personas_api.py::test_patch_persona -x` | ✅ existing | ✅ green |
| 02-01-05 | 02-01 | 1 | PERS CRUD | — | delete + 204 + FK guard | integration | `pytest tests/test_personas_api.py::test_delete_persona tests/test_personas_api.py::test_delete_persona_rejects_referenced_jobs -x` | ✅ existing | ✅ green |
| 02-02-01 | 02-02 | 2 | CONT-01 | T-02-02-1 (MIME) | single-screen upload + on-disk file | integration | `pytest tests/test_content_api.py::test_ui_screens_single -x` | ✅ existing | ✅ green |
| 02-02-01 | 02-02 | 2 | CONT-01 | — | 5-screen upload, all files written | integration | `pytest tests/test_content_api.py::test_ui_screens_five -x` | ✅ existing | ✅ green |
| 02-02-01 | 02-02 | 2 | CONT-01 | T-02-02-2 (DoS) | 6 screens → 400 | integration | `pytest tests/test_content_api.py::test_ui_screens_too_many -x` | ✅ existing | ✅ green |
| 02-02-01 | 02-02 | 2 | CONT-01 | — | 0 screens → 400 | integration | `pytest tests/test_content_api.py::test_ui_screens_zero -x` | ✅ existing | ✅ green |
| 02-02-02 | 02-02 | 2 | CONT-02 | — | static image happy path | integration | `pytest tests/test_content_api.py::test_static_happy -x` | ✅ existing | ✅ green |
| 02-02-03 | 02-02 | 2 | CONT-03 | — | text paste inline, no disk file | integration | `pytest tests/test_content_api.py::test_text_happy -x` | ✅ existing | ✅ green |
| 02-02-04 | 02-02 | 2 | CONT (MIME) | T-02-02-1 | MIME spoof rejected via magic sniff | integration | `pytest tests/test_content_api.py::test_mime_spoofing_rejected -x` | ✅ existing | ✅ green |
| 02-02-04 | 02-02 | 2 | CONT (size) | T-02-02-2 | > 5MB → 400 | integration | `pytest tests/test_content_api.py::test_oversize_rejected -x` | ✅ existing | ✅ green |
| 02-02-05 | 02-02 | 2 | CONT (Pillow) | T-02-02-3 (EXIF) | resize ≤1024px, EXIF stripped, orientation applied | unit | `pytest tests/test_content_processing.py::test_pillow_pipeline -x` | ✅ existing | ✅ green |
| 02-02-05 | 02-02 | 2 | CONT (size) | T-02-02-2 | oversize raises at service layer | unit | `pytest tests/test_content_processing.py::test_oversize_raises -x` | ✅ existing | ✅ green |
| 02-02-05 | 02-02 | 2 | CONT (MIME) | T-02-02-1 | MIME spoof raises at service layer | unit | `pytest tests/test_content_processing.py::test_mime_spoof_raises -x` | ✅ existing | ✅ green |
| 02-02-05 | 02-02 | 2 | CONT (Pillow) | T-02-02-4 | empty/corrupt decode raises ImageValidationError | unit | `pytest tests/test_content_processing.py::test_empty_raises -x` | ✅ existing | ✅ green |
| 02-03-01 | 02-03 | 3 | SIM-01 | — | text content happy path → DONE with narrative | integration | `pytest tests/test_simulation_pipeline.py::test_text_sim_happy -x` | ✅ existing | ✅ green |
| 02-03-01 | 02-03 | 3 | SIM-01 | T-02-03-3 | invalid JSON → repair retry → success | integration | `pytest tests/test_simulation_pipeline.py::test_repair_retry -x` | ✅ existing | ✅ green |
| 02-03-01 | 02-03 | 3 | SIM-01 | T-02-03-3 | invalid JSON twice → ERROR schema message | integration | `pytest tests/test_simulation_pipeline.py::test_repair_retry_exhausted -x` | ✅ existing | ✅ green |
| 02-03-01 | 02-03 | 3 | SIM-01 | T-02-03-3 | VL2 malformed JSON still retries | integration | `pytest tests/test_simulation_pipeline.py::test_vl2_malformed_json_still_retries -x` | ✅ existing | ✅ green |
| 02-03-02 | 02-03 | 3 | SIM-01 (D-03) | T-02-03-4 | hallucination → ERROR fast, inference not called | integration | `pytest tests/test_grounding.py::test_hallucination_fails_fast -x` | ✅ existing | ✅ green |
| 02-03-02 | 02-03 | 3 | SIM-01 (D-03) | — | clean grounding → proceed to inference | integration | `pytest tests/test_grounding.py::test_clean_passes_through -x` | ✅ existing | ✅ green |
| 02-03-02 | 02-03 | 3 | SIM-01 (D-03) | T-02-03-2 | provider errors fail closed (no key leak) | integration | `pytest tests/test_grounding.py::test_provider_errors_fail_closed -x` | ✅ existing | ✅ green |
| 02-03-03 | 02-03 | 3 | SIM-01 (D-01) | — | UI-screens → VL2 dispatch only | unit | `pytest tests/test_simulation_dispatch.py::test_vl2_dispatch -x` | ✅ existing | ✅ green |
| 02-03-03 | 02-03 | 3 | SIM-01 (D-01) | — | text → deepseek-chat dispatch only | unit | `pytest tests/test_simulation_dispatch.py::test_v3_dispatch -x` | ✅ existing | ✅ green |
| 02-03-04 | 02-03 | 3 | SIM-04 | — | GET /jobs/{id} exposes per-screen narrative | integration | `pytest tests/test_simulation_pipeline.py::test_log_viewable -x` | ✅ existing | ✅ green |
| 02-04-01 | 02-04 | 4 | SIM-02 | — | hesitation clustering correct | unit | `pytest tests/test_overlay.py::test_hesitation_clustering -x` | ✅ existing | ✅ green |
| 02-04-01 | 02-04 | 4 | SIM-02 | — | scroll_path timestamp-ordered | unit | `pytest tests/test_overlay.py::test_scroll_path_order -x` | ✅ existing | ✅ green |
| 02-04-01 | 02-04 | 4 | SIM-02 | — | text content → scroll_path absent | unit | `pytest tests/test_overlay.py::test_text_no_scroll -x` | ✅ existing | ✅ green |
| 02-04-01 | 02-04 | 4 | SIM-02 | — | deterministic ordering | unit | `pytest tests/test_overlay.py::test_deterministic -x` | ✅ existing | ✅ green |
| 02-04-02 | 02-04 | 4 | D-11 | — | /analyze happy → job PENDING + FKs set | integration | `pytest tests/test_analyze.py::test_happy_path -x` | ✅ existing | ✅ green |
| 02-04-02 | 02-04 | 4 | D-11 | — | /analyze bad persona → 404 | integration | `pytest tests/test_analyze.py::test_bad_persona -x` | ✅ existing | ✅ green |
| 02-04-02 | 02-04 | 4 | D-11 | — | /analyze bad content → 404 | integration | `pytest tests/test_analyze.py::test_bad_content -x` | ✅ existing | ✅ green |
| 02-04-03 | 02-04 | 4 | D-12 | — | Phase 1 /test-inference still green | integration | `pytest tests/test_api.py::test_submit_and_poll_job -x` | ✅ existing | ✅ green |
| 02-04-03 | 02-04 | 4 | D-12 | — | Phase 1 model status still exposed | integration | `pytest tests/test_api.py::test_model_status -x` | ✅ existing | ✅ green |
| 02-04-03 | 02-04 | 4 | D-12 | — | Phase 1 404 path unchanged | integration | `pytest tests/test_api.py::test_missing_job_returns_404 -x` | ✅ existing | ✅ green |
| 02-04-04 | 02-04 | 4 | D-18..D-20 | T-02-04-2 | stage transitions observable via polling | integration | `pytest tests/test_analyze.py::test_stage_transitions -x` | ✅ existing | ✅ green |
| 02-04-04 | 02-04 | 4 | D-19 | T-02-04-2 | `transition()` writes DB + log line | unit | `pytest tests/test_queue_transitions.py::test_transition_writes -x` | ✅ existing | ✅ green |
| 02-04-04 | 02-04 | 4 | D-20 | T-02-03-3 | per-stage: simulation retry policy | integration | `pytest tests/test_analyze.py::test_failure_policy_simulation_retry -x` | ✅ existing | ✅ green |
| 02-04-04 | 02-04 | 4 | D-20 | T-02-03-4 | per-stage: grounding no-retry policy | integration | `pytest tests/test_analyze.py::test_failure_policy_grounding_no_retry -x` | ✅ existing | ✅ green |
| 02-04-04 | 02-04 | 4 | D-20 | — | per-stage: processing fail-hard policy | integration | `pytest tests/test_analyze.py::test_failure_policy_processing_fail_hard -x` | ✅ existing | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Automated test total:** 45 test cases mapped to 15 tasks across 4 plans. Full suite: 48 tests (includes 3 Phase 1 regression cases). All ✅ green in 1.19s.

---

## Wave 0 Requirements (satisfied)

All new test files created and populated during phase execution:

- [x] `tests/test_personas_api.py` — persona CRUD (PERS-01..04) — 10 cases
- [x] `tests/test_persona_reuse.py` — PERS-04 reuse across jobs — 1 case
- [x] `tests/test_content_api.py` — CONT-01/02/03 + negatives — 8 cases
- [x] `tests/test_content_processing.py` — Pillow + MIME — 4 cases
- [x] `tests/test_simulation_pipeline.py` — SIM-01 / SIM-04 w/ respx — 5 cases
- [x] `tests/test_simulation_dispatch.py` — D-01 dispatch — 2 cases
- [x] `tests/test_grounding.py` — D-03 judge — 3 cases
- [x] `tests/test_overlay.py` — SIM-02 deterministic overlays — 4 cases
- [x] `tests/test_analyze.py` — /analyze composition + lifecycle — 7 cases
- [x] `tests/test_queue_transitions.py` — D-19 helper — 1 case

Fixtures in `tests/conftest.py`:
- [x] shared AsyncClient + per-test DB isolation
- [x] persona/content fixtures used across suites

Framework install:
- [x] `respx` in `backend/requirements.txt`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live DeepSeek-VL2 screen-grounding judge against a real ad screenshot | SIM-01 D-03 | Cannot mock real model behavior — confirms hallucination rate ~zero on a representative flow before phase gate | Set `DEEPSEEK_API_KEY`, unset respx, run against a live screenshot fixture |
| Frontend consumption of `result_json.simulation` shape | SIM-04 | Phase 4 is the downstream consumer; Phase 2 only contracts the shape | Spot-check one `GET /jobs/{id}` JSON against the documented schema |
| Cold-start smoke (server reboot + migration re-apply) | cross-phase | Requires killing running server | Verified manually during UAT — commit `8e53611` |

---

## Validation Audit 2026-04-16

| Metric | Count |
|--------|-------|
| Requirements in map | 15 tasks |
| Test cases mapped | 45 |
| Covered (green) | 45 |
| Partial / missing | 0 |
| Manual-only | 3 |
| Nyquist-compliant | ✅ yes |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (10 new test files)
- [x] No watch-mode flags
- [x] Feedback latency < 30s (measured: 1.19s)
- [x] `nyquist_compliant: true` confirmed against shipped code (commit `8e53611`)

**Approval:** approved 2026-04-16 via `/gsd-validate-phase 02`
