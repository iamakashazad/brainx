---
phase: 1
slug: foundation-and-tribev2-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-08
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `python -m pytest tests/ -x -q` |
| **Full suite command** | `python -m pytest tests/ -v` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `python -m pytest tests/ -x -q`
- **After every plan wave:** Run `python -m pytest tests/ -v`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | INFRA-01 | — | N/A | integration | `python -m pytest tests/test_env.py -x` | ❌ W0 | ⬜ pending |
| 1-02-01 | 02 | 1 | INFRA-02, INFRA-03 | — | N/A | integration | `python -m pytest tests/test_api.py -x` | ❌ W0 | ⬜ pending |
| 1-03-01 | 03 | 2 | SIM-03 | — | N/A | integration | `python -m pytest tests/test_tribev2.py -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/conftest.py` — shared fixtures
- [ ] `tests/test_env.py` — stubs for INFRA-01
- [ ] `tests/test_api.py` — stubs for INFRA-02, INFRA-03
- [ ] `tests/test_tribev2.py` — stubs for SIM-03
- [ ] `pip install pytest` — framework install

*Existing infrastructure covers none — this is a greenfield project.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| MPS/CPU device detection | INFRA-01 | Hardware-dependent; CI may differ | Run `python -c "import torch; print(torch.backends.mps.is_available())"` on target machine |
| GPU OOM under concurrent load | INFRA-02 | Requires multiple simultaneous requests | Send 3+ concurrent POST requests and verify queue ordering |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
