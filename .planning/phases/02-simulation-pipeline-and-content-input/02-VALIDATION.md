---
phase: 2
slug: simulation-pipeline-and-content-input
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-15
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `02-RESEARCH.md` §Validation Architecture. Planner MUST
> populate the per-task verification map with concrete task IDs.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.x + pytest-asyncio 0.24.x (inherited from Phase 1) |
| **Config file** | `pyproject.toml` (existing `[tool.pytest.ini_options]`) |
| **Quick run command** | `pytest tests/test_phase2_*.py -x -q` |
| **Full suite command** | `pytest -x` |
| **Estimated runtime** | ~30 seconds (mocked DeepSeek + Replicate — no live GPU) |
| **HTTP mocking** | `respx` for all DeepSeek / Replicate calls |
| **DB isolation** | per-test `tmp_path / test.db` via existing `conftest.py` fixture |
| **GPU isolation** | existing monkeypatch of `run_tribev2_text` / `run_tribev2_video` |

---

## Sampling Rate

- **After every task commit:** Run `pytest tests/test_phase2_*.py -x -q`
- **After every plan wave:** Run `pytest -x` (Phase 1 + Phase 2 combined)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

> Populated by the planner as tasks are authored. Each task row must map to
> a concrete `pytest` invocation and identify the requirement / threat it
> defends. Rows below are pre-seeded placeholders grouped by plan —
> replace task IDs (`02-0X-NN`) once plans are finalized.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-?? | 02-01 | ? | PERS-01 | — | persona round-trip persists | integration | `pytest tests/test_personas_api.py::test_create_roundtrip -x` | ❌ W0 | ⬜ pending |
| 02-01-?? | 02-01 | ? | PERS-01 | — | missing-required → 422 | integration | `pytest tests/test_personas_api.py::test_create_rejects_missing -x` | ❌ W0 | ⬜ pending |
| 02-01-?? | 02-01 | ? | PERS-02 | — | cognitive_state persists + enum reject | integration | `pytest tests/test_personas_api.py::test_cognitive_state_persists -x` | ❌ W0 | ⬜ pending |
| 02-01-?? | 02-01 | ? | PERS-03 | — | environment persists + enum reject | integration | `pytest tests/test_personas_api.py::test_environment_persists -x` | ❌ W0 | ⬜ pending |
| 02-01-?? | 02-01 | ? | PERS-04 | — | same persona reused across 2 jobs | integration | `pytest tests/test_persona_reuse.py::test_persona_reused_across_jobs -x` | ❌ W0 | ⬜ pending |
| 02-01-?? | 02-01 | ? | PERS CRUD | — | list/get/patch/delete happy + 404s | integration | `pytest tests/test_personas_api.py -x` | ❌ W0 | ⬜ pending |
| 02-02-?? | 02-02 | ? | CONT-01 | T-02-02 (size/MIME) | single-screen upload + on-disk file | integration | `pytest tests/test_content_api.py::test_ui_screens_single -x` | ❌ W0 | ⬜ pending |
| 02-02-?? | 02-02 | ? | CONT-01 | — | 5-screen upload, all files written | integration | `pytest tests/test_content_api.py::test_ui_screens_five -x` | ❌ W0 | ⬜ pending |
| 02-02-?? | 02-02 | ? | CONT-01 | — | 6 screens → 400 | integration | `pytest tests/test_content_api.py::test_ui_screens_too_many -x` | ❌ W0 | ⬜ pending |
| 02-02-?? | 02-02 | ? | CONT-01 | — | 0 screens → 400 | integration | `pytest tests/test_content_api.py::test_ui_screens_zero -x` | ❌ W0 | ⬜ pending |
| 02-02-?? | 02-02 | ? | CONT-02 | — | static image happy path | integration | `pytest tests/test_content_api.py::test_static_happy -x` | ❌ W0 | ⬜ pending |
| 02-02-?? | 02-02 | ? | CONT-03 | — | text paste inline, no disk file | integration | `pytest tests/test_content_api.py::test_text_happy -x` | ❌ W0 | ⬜ pending |
| 02-02-?? | 02-02 | ? | CONT (MIME) | T-02-02 | MIME spoof rejected via magic sniff | integration | `pytest tests/test_content_api.py::test_mime_spoofing_rejected -x` | ❌ W0 | ⬜ pending |
| 02-02-?? | 02-02 | ? | CONT (size) | T-02-02 | > 5MB → 400 | integration | `pytest tests/test_content_api.py::test_oversize_rejected -x` | ❌ W0 | ⬜ pending |
| 02-02-?? | 02-02 | ? | CONT (Pillow) | — | resize ≤1024px, EXIF stripped, orientation applied | unit | `pytest tests/test_content_processing.py::test_pillow_pipeline -x` | ❌ W0 | ⬜ pending |
| 02-03-?? | 02-03 | ? | SIM-01 | — | text content happy path → DONE with narrative | integration | `pytest tests/test_simulation_pipeline.py::test_text_sim_happy -x` | ❌ W0 | ⬜ pending |
| 02-03-?? | 02-03 | ? | SIM-01 | — | invalid JSON → repair retry → success | integration | `pytest tests/test_simulation_pipeline.py::test_repair_retry -x` | ❌ W0 | ⬜ pending |
| 02-03-?? | 02-03 | ? | SIM-01 | — | invalid JSON twice → ERROR schema message | integration | `pytest tests/test_simulation_pipeline.py::test_repair_retry_exhausted -x` | ❌ W0 | ⬜ pending |
| 02-03-?? | 02-03 | ? | SIM-01 (D-03) | T-02-03 | hallucination → ERROR fast, inference not called | integration | `pytest tests/test_grounding.py::test_hallucination_fails_fast -x` | ❌ W0 | ⬜ pending |
| 02-03-?? | 02-03 | ? | SIM-01 (D-03) | — | clean grounding → proceed to inference | integration | `pytest tests/test_grounding.py::test_clean_passes_through -x` | ❌ W0 | ⬜ pending |
| 02-03-?? | 02-03 | ? | SIM-01 (D-01) | — | UI-screens → VL2 dispatch only | unit | `pytest tests/test_simulation_dispatch.py::test_vl2_dispatch -x` | ❌ W0 | ⬜ pending |
| 02-03-?? | 02-03 | ? | SIM-01 (D-01) | — | text → deepseek-chat dispatch only | unit | `pytest tests/test_simulation_dispatch.py::test_v3_dispatch -x` | ❌ W0 | ⬜ pending |
| 02-03-?? | 02-03 | ? | SIM-04 | — | GET /jobs/{id} exposes per-screen narrative | integration | `pytest tests/test_simulation_pipeline.py::test_log_viewable -x` | ❌ W0 | ⬜ pending |
| 02-04-?? | 02-04 | ? | SIM-02 | — | hesitation clustering correct | unit | `pytest tests/test_overlay.py::test_hesitation_clustering -x` | ❌ W0 | ⬜ pending |
| 02-04-?? | 02-04 | ? | SIM-02 | — | scroll_path monotonic & timestamp-ordered | unit | `pytest tests/test_overlay.py::test_scroll_path_order -x` | ❌ W0 | ⬜ pending |
| 02-04-?? | 02-04 | ? | SIM-02 | — | text content → scroll_path null | unit | `pytest tests/test_overlay.py::test_text_no_scroll -x` | ❌ W0 | ⬜ pending |
| 02-04-?? | 02-04 | ? | SIM-02 | — | deterministic across 10 runs | unit | `pytest tests/test_overlay.py::test_deterministic -x` | ❌ W0 | ⬜ pending |
| 02-04-?? | 02-04 | ? | D-11 | — | /analyze happy → job PENDING + FKs set | integration | `pytest tests/test_analyze.py::test_happy_path -x` | ❌ W0 | ⬜ pending |
| 02-04-?? | 02-04 | ? | D-11 | — | /analyze bad persona → 404 | integration | `pytest tests/test_analyze.py::test_bad_persona -x` | ❌ W0 | ⬜ pending |
| 02-04-?? | 02-04 | ? | D-11 | — | /analyze bad content → 404 | integration | `pytest tests/test_analyze.py::test_bad_content -x` | ❌ W0 | ⬜ pending |
| 02-04-?? | 02-04 | ? | D-12 | — | Phase 1 /test-inference still green | integration | `pytest tests/test_api.py::test_submit_and_poll_job` | ✅ existing | ⬜ pending |
| 02-04-?? | 02-04 | ? | D-18..D-20 | — | stage transitions observable via polling | integration | `pytest tests/test_analyze.py::test_stage_transitions -x` | ❌ W0 | ⬜ pending |
| 02-04-?? | 02-04 | ? | D-19 | — | `transition()` writes DB + log line | unit | `pytest tests/test_queue_transitions.py::test_transition_writes -x` | ❌ W0 | ⬜ pending |
| 02-04-?? | 02-04 | ? | D-20 | — | per-stage failure policies (sim retry / grounding no-retry / processing fail-hard) | integration | `pytest tests/test_analyze.py::test_failure_policy_* -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

New test files to stub before plan-implementation tasks start:

- [ ] `tests/test_personas_api.py` — persona CRUD (PERS-01..04)
- [ ] `tests/test_persona_reuse.py` — PERS-04 reuse across jobs
- [ ] `tests/test_content_api.py` — CONT-01, CONT-02, CONT-03 + negative cases
- [ ] `tests/test_content_processing.py` — Pillow pipeline, MIME sniff
- [ ] `tests/test_simulation_pipeline.py` — SIM-01 / SIM-04 end-to-end w/ respx
- [ ] `tests/test_simulation_dispatch.py` — D-01 content-type dispatch
- [ ] `tests/test_grounding.py` — D-03 judge pass/fail
- [ ] `tests/test_overlay.py` — SIM-02 deterministic overlay derivation
- [ ] `tests/test_analyze.py` — /analyze composition + lifecycle
- [ ] `tests/test_queue_transitions.py` — D-19 helper

New `tests/conftest.py` fixtures:
- [ ] `respx_mock` pytest-asyncio-compatible activation fixture
- [ ] `persona_fixture` — create one persona via POST, yield id
- [ ] `text_content_fixture`, `ui_screens_fixture`, `static_content_fixture`
- [ ] `deepseek_mock_ok(respx_mock)` — schema-valid responses
- [ ] `deepseek_mock_hallucinate(respx_mock)` — judge flags referenced-unseen
- [ ] `sample_jpeg_bytes()`, `sample_jpeg_with_exif(orientation)`

Framework install:
- [ ] `pip install respx==0.23.1` (add to `backend/requirements.txt` dev section)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live DeepSeek-VL2 screen-grounding judge against a real ad screenshot | SIM-01 D-03 | Cannot mock model behaviour — verifies real hallucination rate is ~zero on a representative flow before phase gate | Set `DEEPSEEK_API_KEY`, unset respx, run `pytest tests/smoke_deepseek_live.py -m live --runslow` |
| Frontend consumption of `result_json.simulation` shape | SIM-04 | Phase 4 is the downstream consumer; Phase 2 only contracts the shape | Spot-check one `GET /jobs/{id}` JSON against `docs/simulation_schema.md` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (10 new test files)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter once planner finalises rows

**Approval:** pending
