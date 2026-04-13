---
phase: 1
slug: foundation-and-tribev2-integration
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-08
updated: 2026-04-14
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.3 + pytest-asyncio + pytest-timeout |
| **Config file** | `pytest.ini` (defines `integration` marker, asyncio loop scope) |
| **Quick run command** | `python -m pytest tests/ -x -q -m "not integration"` |
| **Full suite command** | `RUN_TRIBEV2_INTEGRATION=1 python -m pytest tests/ -v --timeout=900` |
| **Estimated runtime** | ~4s fast suite · ~45 min full suite (first run) / ~5 min warm |

---

## Sampling Rate

- **After every task commit:** Run `python -m pytest tests/ -x -q -m "not integration"`
- **After every plan wave:** Run the fast suite plus any touched integration test
- **Before `/gsd-verify-work`:** Full integration suite must be green with `RUN_TRIBEV2_INTEGRATION=1`
- **Max feedback latency (fast suite):** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | INFRA-01 | T-01-01/02/03 | N/A (local env) | integration | `python -m pytest tests/test_env.py -v` | ✅ | ✅ green |
| 1-01-02 | 01 | 1 | INFRA-01 | — | N/A | unit | `python -m pytest tests/test_env.py::test_model_loader_contract` | ✅ | ✅ green |
| 1-02-01 | 02 | 2 | INFRA-02, INFRA-03 | T-02-02/03/05 | Pydantic validates; async queue serializes | integration | `python -m pytest tests/test_api.py -v` | ✅ | ✅ green |
| 1-02-02 | 02 | 2 | INFRA-02, INFRA-03 | T-02-01/04 | 404 on unknown job; status lifecycle | integration | `python -m pytest tests/test_api.py -v` | ✅ | ✅ green |
| 1-03-01 | 03 | 3 | SIM-03 | T-03-01..04 | Cortical-only labels; temp file hygiene | unit | `python -m pytest tests/test_roi.py -v` | ✅ | ✅ green |
| 1-03-02 | 03 | 3 | SIM-03 | — | N/A | integration (gated) | `RUN_TRIBEV2_INTEGRATION=1 python -m pytest tests/test_tribev2.py::TestVideoSlideshowPathway -v` | ✅ | ✅ green |
| 1-04-01 | 04 | 1 | INFRA-02 | T-01-04-01/02 | Device fallback; no hang | unit+integration | `python -m pytest tests/test_env.py::test_settings_defaults` | ✅ | ✅ green |
| 1-04-02 | 04 | 1 | SIM-03 (D-04 gate) | — | N/A | integration (gated) | `RUN_TRIBEV2_INTEGRATION=1 python -m pytest tests/test_tribev2.py::TestTextPathway -v --timeout=900` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Fast-suite latest run (2026-04-14):** 15 passed, 0 failed, 5 deselected (integration).
**Integration-suite latest run (2026-04-13, per 01-04-SUMMARY):** 5 passed, 0 skipped, 0 failed.

---

## Wave 0 Requirements

*Satisfied.* All test files and fixtures are committed and green:

- ✅ `pytest.ini` — framework config with `integration` marker
- ✅ `tests/conftest.py` — shared fixtures (project root on sys.path)
- ✅ `tests/test_env.py` — INFRA-01 env + loader contract (7 tests)
- ✅ `tests/test_api.py` — INFRA-02/03 FastAPI endpoints with mocked TRIBEv2 (3 tests)
- ✅ `tests/test_tribev2.py` — SIM-03 pathway smoke tests + D-04 differentiation gate (5 tests, integration-gated)
- ✅ `tests/test_roi.py` — D-10/D-11 ROI label audit + aggregation (5 tests)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| MPS/CPU device detection on hardware | INFRA-01 | Hardware-dependent; CI may differ from the researcher's Mac | Run `python -c "import torch; print(torch.backends.mps.is_available())"` on target machine |
| Concurrent GPU request ordering under load | INFRA-02 | Requires multiple simultaneous HTTP clients and live GPU | Send 3+ concurrent `POST /test-inference` requests and confirm `queue_position` increments monotonically |
| TRIBEv2 weights provenance (Llama-3.2, VJEPA2) | SIM-03 | Requires interactive HF token + license acceptance | Confirm `HF_TOKEN` set, licenses accepted, and first-run fetch completes (~23 min for Llama-3.2-3B) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s (fast suite: ~4s)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-04-14

---

## Validation Audit 2026-04-14

| Metric | Count |
|--------|-------|
| Gaps found | 1 |
| Resolved | 1 |
| Escalated | 0 |

**Resolved:**
- `tests/test_env.py::test_settings_defaults` asserted `device == "mps"`, stale after Plan 01-04 changed default to `cpu`. Assertion updated to `"cpu"`; test now green.
