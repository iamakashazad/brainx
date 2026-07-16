---
phase: 05-session-persistence-demo-and-polish
plan: 03
subsystem: production-hardening
tags: [fastapi, queue, watchdog, react, errors, tests]
provides:
  - Job timeout watchdog
  - Queue-depth 503 guard
  - Frontend ApiError and queue-busy UI
status: complete
completed: 2026-04-30
---

# Phase 05 Plan 03: Production Hardening Summary

## Accomplishments

- Added `settings.job_timeout_seconds = 600`.
- Wrapped `gpu_worker_loop` processing with `asyncio.wait_for` and added `_mark_timed_out`, which marks timed-out jobs as `ERROR` with a descriptive message and keeps the worker alive for subsequent jobs.
- Added `QUEUE_DEPTH_LIMIT = 3` to `/analyze`; submissions at or above the limit return HTTP 503 before creating a `Job` row.
- Added `ApiError` and updated API parsing so frontend mutation handlers can inspect HTTP status.
- Added queue-busy handling in `WizardShell` and the routed `ContentStepPage`, keeping users on content submission with the exact UI-SPEC copy.
- Added timeout-aware failure copy via `displayFailureBodyFor` and wired it into both legacy `ProgressView` and routed `RunningPage`.
- Added backend pytest coverage for queue guard and watchdog behavior plus frontend test scaffolds for queue busy and label copy.

## Verification

- `pytest tests/test_jobs_list.py tests/test_queue_guard.py tests/test_watchdog.py -q` -> `12 passed`
- `cd frontend && npm run typecheck` -> passed
- `rg "QUEUE_DEPTH_LIMIT|asyncio\\.wait_for|ApiError|displayFailureBodyFor|The analysis queue is full" frontend backend tests -n` confirmed key wiring.

## Deviations

- Frontend Vitest could not be completed because the runner hung before importing tests. The process was killed after repeated no-output waits.
- No git commit was created because the working tree was already dirty with prior Phase 5 work.

## Self-Check: PASSED

- Timed-out jobs become `ERROR`, not `FAILED`.
- Queue-full submissions return 503 and do not create jobs.
- Frontend 503 handling does not enter progress.
- Timeout failures use the Phase 5 copywriting contract.

