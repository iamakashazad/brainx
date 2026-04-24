---
phase: 04-frontend-upload-persona-and-results
plan: 02
subsystem: ui
tags: [react, tanstack-query, zustand, vitest, msw]
requires:
  - phase: 04-frontend-upload-persona-and-results
    plan: 01
    provides: persisted wizard shell, analyze kickoff, jobId storage, API client contracts
provides:
  - Full-screen Step 3 progress flow for queued/running/terminal job states
  - Single mapping boundary from backend stages/statuses to UI-SPEC progress copy
  - One-shot run rehydration after refresh plus terminal-stop polling pattern for later plans
affects: [04-03, frontend]
tech-stack:
  added: []
  patterns:
    - stage/status display translation isolated in frontend/src/lib/stageLabels.ts
    - TanStack Query polling stops automatically on DONE or ERROR
    - persisted wizard job rehydration primes the job query cache before polling resumes
key-files:
  created:
    - frontend/src/lib/stageLabels.ts
    - frontend/src/features/run/useJobStatus.ts
    - frontend/src/features/run/useJobRehydrate.ts
    - frontend/src/features/run/ProgressView.tsx
    - frontend/src/features/run/StageIndicator.tsx
    - frontend/src/features/run/QueueBadge.tsx
    - frontend/src/features/run/ProgressSummary.tsx
  modified:
    - frontend/src/features/wizard/WizardShell.tsx
    - frontend/tests/msw/handlers.ts
    - frontend/tests/setup.ts
    - frontend/src/lib/__tests__/stageLabels.test.ts
    - frontend/src/features/run/__tests__/useJobStatus.test.ts
    - frontend/src/features/run/__tests__/ProgressView.test.tsx
    - frontend/src/features/run/__tests__/rehydrate-polling.test.ts
key-decisions:
  - Use query-cache priming via useJobRehydrate plus refetchOnMount:false in useJobStatus to avoid duplicate fetches after refresh.
  - Keep ProgressSummary local-store driven so the optional side panel never adds blocking network work to the run screen.
  - Leave .planning/STATE.md and .planning/ROADMAP.md untouched because the user reserved those writes for the orchestrator.
requirements-completed: [FE-02]
duration: 12m
completed: 2026-04-24
---

# Phase 04 Plan 02: Run Progress Polling and Rehydration Summary

**Full-screen job progress polling with refresh-safe resume, terminal stop behavior, and UI-SPEC-exact stage copy**

## Accomplishments

- Added `frontend/src/lib/stageLabels.ts` as the only display boundary for backend `status` and `stage` values, folding the six backend stages into the four UI-SPEC progress labels while keeping backend enums unchanged everywhere else.
- Replaced the Step 3 wizard stub with a full-screen `ProgressView` backed by `useJobStatus()` and `useJobRehydrate()`, including 2-second polling, queue badge display, terminal-stop behavior, and immediate transition to Step 4 on `DONE`.
- Implemented the static failure state required by the threat model: `ERROR` and exhausted poll failures render only the fixed UI-SPEC copy, never the backend `error` string.
- Extended the MSW job fixture system so tests can drive `PENDING`, `RUNNING`, `DONE`, and `ERROR` transitions deterministically.

## Verification

- `cd frontend && npm run test -- --run src/features/run src/lib/__tests__/stageLabels.test.ts`
- `cd frontend && npm run typecheck`
- Result: 22 tests passed and `tsc --noEmit` passed.

## Task Commits

1. `5fee472` — `test(04-02): add failing stage label mapping spec`
2. `3192be3` — `feat(04-02): add stage label translation boundary`
3. `d48357f` — `test(04-02): add failing run polling and rehydrate specs`
4. `b784b94` — `feat(04-02): implement run polling and rehydration flow`

## Deviations from Plan

### Implementation Deviations

**1. ProgressSummary stayed store-driven instead of issuing an extra persona query**
- **Why:** The summary panel is optional per `04-CONTEXT.md`, while the run screen itself is non-optional and latency-sensitive.
- **What changed:** `ProgressSummary` renders selected persona id and content type from the existing persisted wizard state instead of fetching persona detail.
- **Impact:** No effect on required Step 3 behavior, polling, or verification. The optional summary remains non-blocking.

**2. Orchestrator-owned planning files were intentionally not updated**
- **Why:** The user explicitly reserved `.planning/STATE.md` and `.planning/ROADMAP.md` for the orchestrator.
- **What changed:** This execution created only the code/task commits and this summary file.
- **Impact:** No product behavior impact. This is an execution-policy deviation only.

## Known Stubs

- `frontend/src/features/wizard/WizardShell.tsx:18` — Step 4 still renders `"Results - delivered by plan 04-03"` because results visualization remains owned by plan 04-03.

## Files Changed

- `frontend/src/lib/stageLabels.ts`
- `frontend/src/lib/__tests__/stageLabels.test.ts`
- `frontend/src/features/run/useJobStatus.ts`
- `frontend/src/features/run/useJobRehydrate.ts`
- `frontend/src/features/run/ProgressView.tsx`
- `frontend/src/features/run/StageIndicator.tsx`
- `frontend/src/features/run/QueueBadge.tsx`
- `frontend/src/features/run/ProgressSummary.tsx`
- `frontend/src/features/run/__tests__/useJobStatus.test.ts`
- `frontend/src/features/run/__tests__/ProgressView.test.tsx`
- `frontend/src/features/run/__tests__/rehydrate-polling.test.ts`
- `frontend/src/features/wizard/WizardShell.tsx`
- `frontend/tests/msw/handlers.ts`
- `frontend/tests/setup.ts`

## Self-Check

- PASSED
- `FOUND: .planning/phases/04-frontend-upload-persona-and-results/04-02-SUMMARY.md`
- `FOUND: 5fee472`
- `FOUND: 3192be3`
- `FOUND: d48357f`
- `FOUND: b784b94`
