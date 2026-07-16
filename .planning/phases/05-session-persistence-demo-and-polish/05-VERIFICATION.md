---
phase: 05-session-persistence-demo-and-polish
verified: 2026-04-30T12:15:15Z
status: human_needed
score: 17/17 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Root dashboard/session history browser flow"
    expected: "Open `/`; past sessions and the pinned demo card are visible, and New Analysis starts the routed analysis flow."
    why_human: "The active implementation is a visual routed DashboardPage/AppShell flow rather than the original plan-era wizard overlay."
  - test: "Reload completed session without rerunning inference"
    expected: "Click a completed session card; results render from GET /jobs/{jobId}. No POST /analyze is fired."
    why_human: "Network no-mutation behavior and rendered results need browser/devtools confirmation."
  - test: "Demo case study browser flow"
    expected: "Click the pinned demo card; ResultsLayout renders from /demo/result.json and /demo/activations/screen_1.bin. No POST /analyze is fired."
    why_human: "The demo overlay and canvas/asset rendering are browser-visible behaviors; Vitest hangs in this environment."
  - test: "Theme persistence and no-FOUC"
    expected: "Toggle theme, reload the page, and confirm the selected palette is applied before React hydrates."
    why_human: "FOUC is timing/visual behavior that cannot be proven by static grep alone."
---

# Phase 5: Session Persistence, Demo, and Polish Verification Report

**Phase Goal:** Past sessions are browsable and reloadable without rerunning inference; a pre-built demo loads quickly; production hardening closes silent-failure and queue-overflow scenarios
**Verified:** 2026-04-30T12:15:15Z
**Status:** human_needed
**Re-verification:** No - initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User opens `/` and sees session history instead of the wizard | VERIFIED | `App.tsx` routes `/` to `DashboardPage`; `DashboardPage` uses `useJobHistory`, renders loading/error states, a demo card, and mapped session cards. |
| 2 | User can start a new analysis from history/dashboard | VERIFIED | Active app uses persistent `AppShell` New Analysis CTA to navigate to `/analysis/new`; plan-era `HistoryView` still has a New Analysis overlay path. |
| 3 | User can browse past sessions | VERIFIED | Backend `GET /jobs` returns filtered, newest-first `JobSummary` rows; frontend `useJobHistory` feeds the dashboard/history grids. |
| 4 | User can re-open past completed sessions without rerunning inference | VERIFIED | Dashboard session click navigates to `/analysis/{jobId}/results`; `ResultsPage` fetches `GET /jobs/{jobId}` and renders `job.result`. No `/analyze` call exists in the reload path. |
| 5 | Backend `GET /jobs` returns only real analysis sessions | VERIFIED | `backend/routers/jobs.py` filters `persona_id.isnot(None)` and `content_id.isnot(None)`, orders by `created_at.desc()`, and caps at 50. |
| 6 | Closing/reset behavior prevents stale wizard state | VERIFIED | `WizardOverlay` calls `wizardStore.reset()` on close; `HistoryView` resets before opening a new wizard. Active routed flow sets job IDs from route params. |
| 7 | Pinned demo card is visually distinct and always present in history grid | VERIFIED | `DemoCard` has `border-2 border-primary`, DEMO badge, Pin icon; `DashboardPage` renders it before session cards. |
| 8 | Demo opens results from a static fixture without backend inference | VERIFIED | `DemoOverlay` passes `resultOverride` and `jobIdOverride="demo"` to `ResultsLayout`; `useDemoResult` fetches `/demo/result.json`; no `/analyze` call exists. |
| 9 | Demo activation data is static and canvas-compatible | VERIFIED | `frontend/public/demo/activations/screen_1.bin` is 81,936 bytes = 20,484 Float32 vertices; `useActivation("demo")` fetches `/demo/activations/screen_1.bin`. |
| 10 | Demo swap slot is documented | VERIFIED | `frontend/public/demo/SWAP_INSTRUCTIONS.md` is 34 lines and documents replacing `result.json` and activation binaries. |
| 11 | Shareable `/results/:jobId` URL renders results without wizard chrome | VERIFIED | `App.tsx` routes `/results/:jobId` to `SharedResultsPage`, which fetches `GET /jobs/{id}` and renders `ResultsLayout resultOverride`. |
| 12 | Theme toggle switches and persists dark/light preference | VERIFIED | `themeStore` persists under `brainx-theme`, applies `documentElement.classList`, and `ThemeToggle` toggles the store. |
| 13 | Dark-theme reload avoids light flash before hydration | VERIFIED | `frontend/index.html` inline script reads `localStorage["brainx-theme"]` and applies `.dark` before `/src/main.tsx` loads. |
| 14 | Timed-out jobs become terminal `ERROR` with descriptive message | VERIFIED | `gpu_worker_loop` wraps `_process_job` in `asyncio.wait_for`; `_mark_timed_out` sets `status="ERROR"` and error text. |
| 15 | Worker continues after a timeout | VERIFIED | `gpu_queue.task_done()` is in `finally`; `tests/test_watchdog.py::test_watchdog_does_not_block_subsequent_jobs` passed. |
| 16 | Queue depth guard returns 503 before job creation | VERIFIED | `submit_analyze` holds `queue_capacity_lock`, checks `gpu_queue.qsize() >= 3`, raises 503, and only then creates/enqueues a job. |
| 17 | Frontend queue-full response stays on content submission with inline error | VERIFIED | `ApiError` carries HTTP status; `isQueueBusyError` detects 503; `ContentStepPage` and `WizardShell` render the required queue-full copy. |

**Score:** 17/17 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/routers/jobs.py` | `GET /jobs`, `GET /jobs/{id}` | VERIFIED | Real-session filter, result reload response, 404 behavior present. |
| `backend/models/schemas.py` | `JobSummary`, `JobStatusResponse` | VERIFIED | Frontend schema-compatible fields include `persona_id`, `result`, `error`, `created_at`. |
| `tests/test_jobs_list.py` | History endpoint tests | VERIFIED | Empty list, filtering, ordering, cap, shape coverage. |
| `frontend/src/pages/DashboardPage.tsx` | Active root history/dashboard | VERIFIED | Uses history query, demo card, session cards, route navigation. |
| `frontend/src/features/history/HistoryView.tsx` | Plan-era history + overlay | VERIFIED | Still implemented and tested for New Analysis overlay behavior. |
| `frontend/src/features/history/SessionCard.tsx` | Session card | VERIFIED | Persona/date/status display and click callback. |
| `frontend/src/features/history/DemoCard.tsx` | Pinned demo card | VERIFIED | Visual distinction and click callback. |
| `frontend/src/features/history/DemoOverlay.tsx` | Demo results overlay | VERIFIED | Fetches fixture and renders `ResultsLayout` with override. |
| `frontend/src/features/history/useDemoResult.ts` | Demo fixture query | VERIFIED | Fetches `/demo/result.json` and validates with `analysisResultSchema`. |
| `frontend/src/features/history/useJobHistory.ts` | Job history query | VERIFIED | React Query wrapper around `listJobs`. |
| `frontend/src/features/results/ResultsLayout.tsx` | Reusable results rendering | VERIFIED | `resultOverride` skips job status polling; renders result sections. |
| `frontend/src/features/results/SharedResultsPage.tsx` | `/results/:jobId` route body | VERIFIED | Fetches job status, handles missing sessions, avoids wizard chrome. |
| `frontend/src/features/results/useActivation.ts` | Demo activation fetch | VERIFIED | `jobId === "demo"` maps to static binary path. |
| `frontend/public/demo/result.json` | Static `AnalysisResult` fixture | VERIFIED | Parsed JSON: schema version 1, one ROI screen, one activation, two recommendations, five circuits. |
| `frontend/public/demo/activations/screen_1.bin` | Static activation binary | VERIFIED | 81,936 bytes = 20,484 Float32 values. |
| `frontend/public/demo/SWAP_INSTRUCTIONS.md` | Demo replacement docs | VERIFIED | Documents fixture, activation, and validation process. |
| `frontend/src/stores/themeStore.ts` | Persisted theme store | VERIFIED | Zustand persist under `brainx-theme`; applies `.dark`. |
| `frontend/src/components/ThemeToggle.tsx` | Theme toggle control | VERIFIED | Icon-only 44px button wired to store toggle. |
| `backend/core/queue.py` | Timeout watchdog | VERIFIED | `asyncio.wait_for`, `_mark_timed_out`, `task_done` finally block. |
| `backend/core/config.py` | Timeout setting | VERIFIED | `job_timeout_seconds: int = 600`. |
| `backend/routers/analyze.py` | Queue-depth guard | VERIFIED | Locked capacity check and 503 before job insert. |
| `frontend/src/lib/errors.ts` | `ApiError` | VERIFIED | HTTP status available to mutation handlers. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `App.tsx` | root dashboard/history | `/` route to `DashboardPage` | VERIFIED | Active route differs from plan-era `HistoryView`, but satisfies root history intent. |
| `DashboardPage.tsx` | `GET /jobs` | `useJobHistory` -> `listJobs` | VERIFIED | Data flows into session card mapping. |
| `DashboardPage.tsx` | completed session reload | `navigate("/analysis/{jobId}/results")` | VERIFIED | Results route fetches stored result JSON. |
| `ResultsPage.tsx` | backend result JSON | `useJobStatus(jobId)` | VERIFIED | `result = job?.result`; no analyze mutation in path. |
| `DemoCard.tsx` | demo overlay | `onOpen` callback | VERIFIED | Dashboard and HistoryView both open `DemoOverlay`. |
| `DemoOverlay.tsx` | static fixture | `useDemoResult(open)` | VERIFIED | Fetches `/demo/result.json`; renders `ResultsLayout resultOverride`. |
| `ResultsLayout.tsx` | skip polling for demo/shared result | `useJobStatus(resultOverride ? null : jobId)` | VERIFIED | Static/demo result does not refetch job status. |
| `useActivation.ts` | demo activation binary | `jobId === "demo"` | VERIFIED | Uses `/demo/activations/screen_N.bin`. |
| `index.html` | no-FOUC dark class | inline localStorage script | VERIFIED | Runs before React root script. |
| `submit_analyze` | queue capacity | `queue_capacity_lock` + `qsize() >= QUEUE_DEPTH_LIMIT` | VERIFIED | Guard happens before `session.add(job)`. |
| `gpu_worker_loop` | timeout watchdog | `asyncio.wait_for(_process_job(...))` | VERIFIED | Timeout path marks job `ERROR`; finally calls `task_done`. |
| `useSubmitAnalyze` | 503 UI path | `ApiError` + `isQueueBusyError` | VERIFIED | UI reads mutation error and renders inline copy. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `DashboardPage.tsx` | `jobs` | `useJobHistory` -> `GET /jobs` -> DB query | Yes | FLOWING |
| `ResultsPage.tsx` | `result` | `useJobStatus(jobId)` -> `GET /jobs/{id}` -> `job.result_json` | Yes | FLOWING |
| `SharedResultsPage.tsx` | `jobQuery.data.result` | `useJobStatus(jobId)` -> `GET /jobs/{id}` | Yes | FLOWING |
| `DemoOverlay.tsx` | `demoQuery.data` | `/demo/result.json` validated by `analysisResultSchema` | Yes | FLOWING |
| `ResultsLayout.tsx` | `result` | `resultOverride` or `GET /jobs/{id}` | Yes | FLOWING |
| `useActivation.ts` | `activation` | Backend activation endpoint or static demo binary | Yes | FLOWING |
| `ContentStepPage.tsx` / `WizardShell.tsx` | queue-busy error | `submitAnalyze` -> `ApiError(503)` | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Backend history, queue guard, watchdog, analyze regressions | `pytest tests/test_analyze.py tests/test_queue_transitions.py tests/test_jobs_list.py tests/test_queue_guard.py tests/test_watchdog.py -q` | `30 passed in 6.75s` | PASS |
| Frontend type contracts | `npm run typecheck` in `frontend/` | `tsc --noEmit` passed | PASS |
| Demo fixture shape | `node -e` parse of `frontend/public/demo/result.json` | `schema_version=1`, 1 ROI, 1 activation, 2 recommendations, 5 circuits | PASS |
| Demo activation size | `wc -c frontend/public/demo/activations/screen_1.bin` | `81936` bytes | PASS |
| Frontend Vitest runtime | Focused Vitest files | Not rerun; known environment hangs before importing focused files | SKIP/RISK |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| FE-03 | 05-02 | Pre-built demo case study - one hardcoded analysis session available without running inference | SATISFIED | Static result + activation assets, DemoCard, DemoOverlay, `resultOverride`, no `/analyze` in demo path. |
| FE-04 | 05-01 | Session history view - user can browse and re-open past analysis sessions | SATISFIED | `/jobs` endpoint, root DashboardPage/history grid, session card navigation to results backed by `GET /jobs/{id}`. |

No additional Phase 5 requirements are orphaned in `REQUIREMENTS.md`.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| - | - | None blocking found | - | Static scan found only benign route/component guard `return null` cases. |

### Human Verification Required

#### 1. Root Dashboard/Session History Browser Flow

**Test:** Open `/` with empty history and with at least one completed session.
**Expected:** The app shows the dashboard/history surface rather than the wizard; past session cards and the pinned demo card are visible; New Analysis starts the routed analysis flow.
**Why human:** The active implementation is visual and route-based, with an intentional deviation from the original `HistoryView` overlay wording.

#### 2. Reload Completed Session Without Rerunning Inference

**Test:** Open browser devtools Network tab, click a completed session card, and inspect network calls.
**Expected:** The page requests `GET /jobs/{jobId}` and activation assets as needed; it does not send `POST /analyze`.
**Why human:** No-mutation behavior through a browser click path is best confirmed through runtime network observation.

#### 3. Demo Case Study Browser Flow

**Test:** Click the pinned demo card.
**Expected:** Results render from `/demo/result.json` and `/demo/activations/screen_1.bin`; no `POST /analyze` request is fired.
**Why human:** Demo overlay, canvas rendering, and static asset behavior are browser-visible; Vitest currently hangs in this environment.

#### 4. Theme Persistence and No-FOUC

**Test:** Toggle light/dark, reload, and watch the initial paint.
**Expected:** The selected theme persists and dark-theme users do not see a light flash before React hydrates.
**Why human:** FOUC is timing/visual behavior.

### Gaps Summary

No blocking gaps were found against the Phase 5 goal. The implementation intentionally uses the active routed `DashboardPage`/`AppShell` architecture instead of only the original plan-era `HistoryView` overlay, but the user-facing goal is satisfied: sessions are browsable, completed results reload from stored job data, demo data bypasses inference, and queue/timeout hardening is in place.

The remaining status is `human_needed` because frontend browser behavior and visual/timing checks need manual confirmation, and the Vitest runner is a known environment risk.

---

_Verified: 2026-04-30T12:15:15Z_
_Verifier: Claude (gsd-verifier)_
