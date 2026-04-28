---
phase: 5
slug: session-persistence-demo-and-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-28
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x (backend) + vitest (frontend) |
| **Config file** | `backend/pytest.ini` / `frontend/vite.config.ts` |
| **Quick run command** | `cd backend && pytest -x -q && cd ../frontend && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd backend && pytest && cd ../frontend && npx vitest run` |
| **Estimated runtime** | ~45 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && pytest -x -q && cd ../frontend && npx vitest run --reporter=verbose`
- **After every plan wave:** Run full suite (`cd backend && pytest && cd ../frontend && npx vitest run`)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 0 | FE-03 | — | N/A | unit | `cd frontend && npx vitest run src/features/history` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | FE-03 | — | N/A | integration | `cd backend && pytest tests/test_jobs_list.py -x -q` | ❌ W0 | ⬜ pending |
| 05-01-03 | 01 | 1 | FE-03 | — | N/A | unit | `cd frontend && npx vitest run src/features/history` | ❌ W0 | ⬜ pending |
| 05-01-04 | 01 | 2 | FE-03 | — | N/A | e2e | `cd frontend && npx vitest run src/features/history` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 1 | FE-04 | — | N/A | unit | `cd frontend && npx vitest run src/features/demo` | ❌ W0 | ⬜ pending |
| 05-02-02 | 02 | 1 | FE-04 | — | N/A | integration | `cd frontend && npx vitest run` | ❌ W0 | ⬜ pending |
| 05-03-01 | 03 | 1 | — | — | N/A | integration | `cd backend && pytest tests/test_watchdog.py -x -q` | ❌ W0 | ⬜ pending |
| 05-03-02 | 03 | 1 | — | — | N/A | integration | `cd backend && pytest tests/test_queue_guard.py -x -q` | ❌ W0 | ⬜ pending |
| 05-03-03 | 03 | 2 | — | — | N/A | unit | `cd frontend && npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend/src/features/history/__tests__/HistoryView.test.tsx` — stubs for FE-03 history view
- [ ] `backend/tests/test_jobs_list.py` — stubs for GET /jobs API endpoint
- [ ] `backend/tests/test_watchdog.py` — stubs for timeout watchdog behavior
- [ ] `backend/tests/test_queue_guard.py` — stubs for queue depth guard behavior
- [ ] `frontend/src/msw/handlers.ts` — add `GET /jobs` MSW handler (required: `onUnhandledRequest: "error"` in test config)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Demo page loads < 2s without inference | FE-04 | Requires Lighthouse/browser timing | Open /demo in browser, observe network tab — no /analyze call fired |
| Session history scrollable with 50+ entries | FE-03 | Requires production-scale seed data | Run seed script, open /history, verify virtual scroll behavior |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
