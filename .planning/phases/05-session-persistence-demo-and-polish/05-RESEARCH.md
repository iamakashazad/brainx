# Phase 5: Session Persistence, Demo, and Polish - Research

**Researched:** 2026-04-28
**Domain:** React SPA session history, static JSON demo fixture, FastAPI background-job watchdog, async queue guard
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Session History Design**
- D-01: History layout is a card grid — reuses the existing card aesthetic from Phase 4 (card shadows, hover lift, design token colors).
- D-02: Each history card shows minimal info only: date, persona name, and status badge. No brain thumbnail or recommendation snippet required.
- D-03: The app root (`/`) IS the history screen. Session cards are the main content; a prominent "New Analysis" button sits at the top. No sidebar or separate nav link needed.

**Session Reload**
- D-04: Clicking a past session re-enters the wizard at Step 4 (Results). Result data is read from `result_json` on the Job record — no inference re-run. The Phase 4 results view renders with the stored payload.

**Demo Case Study**
- D-05: The pre-built demo is a pinned card always at the top of the history grid, visually distinct (different border/badge). Clicking it loads results identically to any other session — no special route.
- D-06: Demo data is backed by a committed JSON fixture in `frontend/public/demo/` — a real `AnalysisResult` JSON produced by running inference once and committing the output. No backend call required to load the demo.
- D-07: The actual demo content (which screens / persona) is provided by the user later. The planner must leave a clearly documented fixture slot with swap instructions. Claude will use a placeholder UI-screen flow scenario until the real content is supplied.

**Production Hardening**
- D-08: Timeout watchdog — backend marks a stuck job as `FAILED` with a descriptive error message after a configurable timeout (default: 10 minutes). Frontend polls and renders the error state. No auto-retry in this phase.
- D-09: Queue depth guard — backend returns HTTP 503 if `queue_depth >= 3` at the time of `/analyze` submission. Frontend catches 503 and shows a friendly "The system is busy — try again shortly" message without entering the wizard progress flow.
- D-10: UI label audit covers all user-facing text: job status labels, stage descriptions, error messages, empty state copy. Goal: no placeholder or inconsistent strings remain in the shipped UI.

**Deferred Phase 4 Polish (now in scope)**
- D-11: Light theme toggle — wire the `:root` token palette to a theme toggle. Tokens already exist from Phase 4 (`04-DESIGN-TOKENS.css`). Dark remains the default; toggle persists to `localStorage`.
- D-12: Shareable `/results/{job_id}` URLs — each completed session gets a bookmarkable URL. Frontend reads the job by ID from `GET /jobs/{job_id}` and renders the results view directly.

### Claude's Discretion
- Demo fixture placeholder content (UI-screen flow scenario and persona) until user provides the real assets.
- Exact timeout value (suggested: 10 minutes) and whether it's an env var or hard-coded constant.
- Visual treatment of the pinned demo card (border color, badge label).
- How the "New Analysis" CTA is positioned on the home/history screen.
- Exact 503 error message copy and whether it surfaces queue depth to the user.

### Deferred Ideas (OUT OF SCOPE)
- Content library / reuse UI
- AI-assisted persona creation
- Full timeseries / peak-activation-time vertex delivery
- Multiple simultaneous personas
- A/B variant comparison (ADV-01)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FE-03 | Pre-built demo case study — one hardcoded analysis session available without running inference, for portfolio / research preview | Static JSON fixture pattern in `frontend/public/demo/result.json`, fetched by the frontend at runtime; MSW handler pattern already exists for mock job responses in tests |
| FE-04 | Session history view — user can browse and re-open past analysis sessions | `GET /jobs` list endpoint (new), history card grid using existing card pattern, `useWizardStore.setJob` + `setStep(4)` for reload, `result_json` already stored on Job |
</phase_requirements>

---

## Summary

Phase 5 completes BrainX MVP by adding three independent workstreams that do not touch the inference pipeline: (1) a session history view and reload flow, (2) a static demo fixture wired as a pinned card, and (3) production hardening of the backend queue and a frontend label/theme polish pass.

The codebase is well-prepared. `result_json` is already persisted on every completed Job record. The `useWizardStore` already supports injecting a `jobId` and jumping to step 4, and `useJobStatus` / `useJobRehydrate` already do the fetching. The history view needs a new `GET /jobs` endpoint and a `HistoryView` component that replaces the current catch-all route. The demo fixture is a pure static-file concern. The watchdog is a new `asyncio.wait_for` wrapper around `_process_job`; the queue guard is a one-line depth check in `analyze.py` before `gpu_queue.put()`.

The only structural change with wider blast radius is converting `/` from a wizard-entry point to a history/launch-pad screen — the wizard now starts when the user clicks "New Analysis". The existing `WizardShell` can be re-used inside that flow without modification. The shareable `/results/:jobId` URL (D-12) requires adding a second route and a thin wrapper component that fetches by ID and renders `ResultsLayout`.

**Primary recommendation:** Build 05-01 (history API + view), 05-02 (demo fixture), and 05-03 (hardening/polish) as three strictly sequential plans. Each plan touches a different layer (backend endpoint → frontend component → backend policy + UI copy), minimising merge conflicts.

---

## Standard Stack

### Core (already installed — no new installs required for main deliverables)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-router-dom | ^7.14.2 [VERIFIED: package.json] | New `/results/:jobId` route | Already in dep tree |
| zustand (persist middleware) | ^5.0.12 [VERIFIED: package.json] | Theme toggle persisted to localStorage | Already used for wizard state |
| @tanstack/react-query | ^5.99.2 [VERIFIED: package.json] | `listJobs()` query + single-job fetch for shareable URL | Already used for all API queries |
| framer-motion | ^12.38.0 [VERIFIED: package.json] | History card hover lift, empty-state animation | Already used for results animations |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | ^0.545.0 [VERIFIED: package.json] | History-screen icons (clock, external-link, pin) | Already used in ProgressView |

### New backend dependency

No new Python packages needed. The watchdog uses `asyncio.wait_for` (stdlib), the queue guard uses `gpu_queue.qsize()` (already imported in `analyze.py`), and the `GET /jobs` list endpoint uses existing SQLAlchemy + Pydantic patterns.

**Installation:** No install step needed.

---

## Architecture Patterns

### Recommended Project Structure (additions only)

```
frontend/
├── public/
│   └── demo/
│       ├── result.json           # Committed AnalysisResult fixture (swap slot)
│       └── SWAP_INSTRUCTIONS.md  # How to replace with real content
├── src/
│   ├── features/
│   │   └── history/
│   │       ├── HistoryView.tsx        # Root "/" screen — card grid + New Analysis CTA
│   │       ├── SessionCard.tsx        # Individual history card (date, persona name, badge)
│   │       ├── DemoCard.tsx           # Pinned demo card (distinct border/badge)
│   │       └── useJobHistory.ts       # React Query hook for GET /jobs
│   └── stores/
│       └── themeStore.ts             # Zustand persist: dark | light, applied to <html>
backend/
└── routers/
    └── jobs.py  (extend: add GET /jobs list endpoint)
```

### Pattern 1: History View replaces catch-all route

**What:** `App.tsx` gains two routes: `"/"` renders `HistoryView`; `"/results/:jobId"` renders a `SharedResultsPage`. The existing `WizardShell` is wrapped inside `HistoryView` as a modal or a full-page overlay triggered by "New Analysis".

**When to use:** Required — the current `<Route path="*" element={<WizardShell />} />` must give way so that `/results/:jobId` resolves correctly. The simplest approach is: `"/"` = `HistoryView`, `"/results/:jobId"` = `SharedResultsPage`, `"/wizard"` = `WizardShell` (or keep wizard as a client-side modal overlay on top of `/`).

**Key insight:** The wizard does not need its own route if it is launched as a full-screen overlay from the history screen. This avoids breaking the existing `localStorage`-persisted wizard state (`brainx-wizard-state`), which uses step numbers not URLs.

**Example routing shape:**
```tsx
// frontend/src/App.tsx — after Phase 5
<Routes>
  <Route path="/" element={<HistoryView />} />
  <Route path="/results/:jobId" element={<SharedResultsPage />} />
  {/* WizardShell rendered by HistoryView as an overlay/child, not a separate route */}
</Routes>
```
[VERIFIED: codebase — current App.tsx uses single catch-all; react-router-dom v7 supports this shape]

### Pattern 2: Session reload via wizardStore injection

**What:** When a history card is clicked, call `useWizardStore.getState().setJob(jobId)` then `setStep(4)` and show the `WizardShell` overlay. `ResultsLayout` already calls `useJobStatus(jobId)`, which will find the completed job in the React Query cache or re-fetch from `GET /jobs/{id}`. No changes to `ResultsLayout` required.

**When to use:** For all real past-session cards (D-04).

```tsx
// In SessionCard onClick handler
const { setJob, setStep } = useWizardStore.getState();
setJob(card.jobId);
setStep(4);
openWizardOverlay(); // lift state or use router navigate
```
[VERIFIED: codebase — wizardStore.ts has setJob(), setStep(); ResultsLayout reads jobId from store]

### Pattern 3: Demo fixture as static fetch

**What:** `DemoCard` fetches `/demo/result.json` via a normal `fetch()` call (not via the API client). The result is treated as a synthetic "completed job" — injected directly into `ResultsLayout` as a prop override or via a thin `useDemoResult` hook. No job ID is written to `wizardStore`; the demo does not pollute the real session history.

**When to use:** For the pinned demo card only (D-05, D-06).

**Key considerations:**
- `result.json` must be a valid `AnalysisResult` object (schema_version: 1) — the MSW fixture in `handlers.ts` (`buildFixtureResult()`) is a ready-made template for the placeholder.
- `ResultsLayout` currently reads `jobId` from `wizardStore` and calls `useJobStatus`. For the demo, either (a) pass `result` as a prop and skip the query, or (b) set a sentinel `jobId = "demo"` and intercept the fetch to return the static file. Option (a) is cleaner — add an optional `resultOverride?: AnalysisResult` prop to `ResultsLayout`.
- `activations` entries in the demo fixture must reference real `.npy` files OR the activation fetch must return a synthetic Float32 array. For the demo, commit a pre-generated Float32 binary to `frontend/public/demo/activations/screen_1.bin` and wire `useActivation` to detect demo paths.

[VERIFIED: codebase — ResultsLayout.tsx receives result from useJobStatus; no existing prop override mechanism exists yet]

### Pattern 4: Timeout watchdog in gpu_worker_loop

**What:** Wrap `_process_job(job_id)` with `asyncio.wait_for(timeout=600)` (10 minutes). On `asyncio.TimeoutError`, mark job status = `"FAILED"` with a descriptive `error_message`. The frontend already handles `status === "ERROR"` and renders `FailureState`.

**When to use:** Required for D-08. Wrap only the full-pipeline path (the `if not legacy_phase1` branch) since the legacy test-inference path is not user-facing.

```python
# backend/core/queue.py — gpu_worker_loop
WATCHDOG_TIMEOUT_SECONDS = int(os.environ.get("JOB_TIMEOUT_SECONDS", 600))

async def gpu_worker_loop() -> None:
    while True:
        job_id = await gpu_queue.get()
        try:
            await asyncio.wait_for(_process_job(job_id), timeout=WATCHDOG_TIMEOUT_SECONDS)
        except asyncio.TimeoutError:
            await _mark_timed_out(job_id)
        finally:
            gpu_queue.task_done()
```
[VERIFIED: codebase — gpu_worker_loop in queue.py; asyncio.wait_for is stdlib; FAILED status string already used in ProgressView error check (shouldShowFailure reads "ERROR", backend uses "ERROR" not "FAILED" — CRITICAL: keep consistent, see Pitfall 2)]

### Pattern 5: Queue depth guard in analyze.py

**What:** Before `gpu_queue.put(job.id)`, check `gpu_queue.qsize() >= 3` and raise an HTTP 503. The job row should NOT be created before the guard fires — or, if created, must be cleaned up (simpler: do the guard check before the DB insert).

```python
# backend/routers/analyze.py — inside submit_analyze, before job creation
QUEUE_DEPTH_LIMIT = 3
if queue_manager.gpu_queue.qsize() >= QUEUE_DEPTH_LIMIT:
    raise HTTPException(
        status_code=503,
        detail="The system is currently busy. Please try again shortly.",
    )
```

Frontend catches 503 via `parseResponse` which throws on non-ok status. The `useSubmitAnalyze` mutation's `onError` handler must be extended to check for 503 and display a specific message (not enter the wizard progress flow).

[VERIFIED: codebase — analyze.py calls gpu_queue.put(); api.ts parseResponse throws on non-ok; useSubmitAnalyze.ts exists and uses TanStack mutation]

### Pattern 6: Theme toggle with localStorage persistence

**What:** A `themeStore` (Zustand persist) holds `theme: "dark" | "light"`. On mount and on every change, toggle the `.dark` class on `document.documentElement`. The existing CSS already has both `:root` (light palette) and `.dark` (dark palette) defined in `tokens.css`.

```ts
// frontend/src/stores/themeStore.ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type ThemeState = {
  theme: "dark" | "light";
  setTheme: (t: "dark" | "light") => void;
  toggle: () => void;
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "dark",
      setTheme: (t) => set({ theme: t }),
      toggle: () => set({ theme: get().theme === "dark" ? "light" : "dark" }),
    }),
    { name: "brainx-theme", storage: createJSONStorage(() => localStorage) },
  ),
);
```

A `useEffect` in `main.tsx` (or a top-level `ThemeProvider` component) applies the class:
```ts
useEffect(() => {
  document.documentElement.classList.toggle("dark", theme === "dark");
}, [theme]);
```
[VERIFIED: codebase — tokens.css has both :root and .dark palettes; existing wizardStore uses identical persist pattern]

### Anti-Patterns to Avoid

- **Writing job ID "demo" to wizardStore:** The demo card must not insert "demo" as a real jobId — the rehydration hook would try to `GET /jobs/demo` and fail. Use a prop override path in `ResultsLayout` instead.
- **Creating the job record before the 503 guard:** If the job is inserted into the DB before the queue depth is checked, a cleanup step is needed on 503. Avoid by placing the guard check first, before `session.add(job)`.
- **Using `status === "FAILED"` on the frontend:** Backend uses `"ERROR"` as the failure status string (verified in `job.py` and `queue.py`). The watchdog must set `status = "ERROR"`, not `"FAILED"`, so the existing `shouldShowFailure` check in `ProgressView.tsx` triggers correctly.
- **Linking to `/results/:jobId` from the history card for normal sessions:** The shareable URL is a secondary feature (D-12). History cards reload via wizardStore injection (D-04), not navigation. The `/results/:jobId` route is for external bookmarkable links only.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Job list pagination | Custom cursor logic | SQLAlchemy `order_by(Job.created_at.desc()).limit(50)` | Simple offset/limit is fine for single-user MVP; no cursor complexity needed |
| Theme persistence | Custom localStorage read/write | Zustand `persist` middleware (already used in wizardStore) | Identical pattern already proven in codebase |
| 503 retry logic | Custom retry loop in frontend | User-facing message only; no auto-retry in Phase 5 per D-08/D-09 | Auto-retry adds complexity; user retries manually |
| Demo fixture generation | Re-running live inference for placeholder | Copy `buildFixtureResult()` from `tests/msw/handlers.ts` as the placeholder | Already a valid `AnalysisResult` shape; zero inference cost |
| Static file serving | Custom endpoint | Vite dev server and built `public/` dir serve `frontend/public/demo/result.json` directly | Standard Vite static asset behavior |

**Key insight:** The demo fixture and the test MSW fixture are structurally identical — the MSW `buildFixtureResult()` in `handlers.ts` is the exact placeholder to promote into `public/demo/result.json`.

---

## Common Pitfalls

### Pitfall 1: Demo activation fetch fails because paths in fixture don't resolve
**What goes wrong:** `result.json` has `activations[].path` pointing to server-side `.npy` file paths (e.g., `activations/job-abc/screen_1.npy`). `useActivation` calls `GET /jobs/{id}/activations/{screen}` — for a demo with no real job ID, this 404s and the brain canvas never loads.
**Why it happens:** The activation endpoint is a backend route keyed on `job_id`; the demo bypasses the backend entirely.
**How to avoid:** For demo sessions, commit a Float32 binary to `frontend/public/demo/activations/screen_1.bin` and modify `useActivation` to accept an optional `activationUrl` override. Alternatively, hard-code a synthetic all-zeros Float32 array for the demo brain canvas (acceptable for a placeholder).
**Warning signs:** Brain canvas renders but shows no activation color overlay; console shows 404 on activation fetch.

### Pitfall 2: Watchdog marks job as "FAILED" but frontend checks for "ERROR"
**What goes wrong:** If the watchdog writes `status = "FAILED"` to the DB, `ProgressView`'s `shouldShowFailure` check (`status === "ERROR"`) never triggers — the frontend polls forever.
**Why it happens:** Backend uses `"ERROR"` as the failure status string throughout (`queue.py` catch blocks, `job.py` default); a naively written watchdog might write `"FAILED"`.
**How to avoid:** Always set `job.status = "ERROR"` in `_mark_timed_out()`. The frontend `jobStatusSchema` in `api-schemas.ts` only allows `"PENDING" | "RUNNING" | "DONE" | "ERROR"` — any other value would also fail Zod parse.
**Warning signs:** Polling never stops for a timed-out job; no error state rendered.

### Pitfall 3: `GET /jobs` list exposes legacy test-inference jobs
**What goes wrong:** History view shows phantom jobs from Phase 1 test-inference runs that have no `persona_id` and no `result_json` — they appear as broken cards.
**Why it happens:** The `jobs` table contains legacy rows created by `POST /test-inference` with null `persona_id`/`content_id`.
**How to avoid:** `GET /jobs` should filter to `WHERE persona_id IS NOT NULL AND content_id IS NOT NULL`. This restricts history to real user analysis sessions.
**Warning signs:** History grid shows unnamed/empty cards with null persona name.

### Pitfall 4: wizardStore.jobId from a reloaded session breaks "New Analysis" flow
**What goes wrong:** User reloads session A (sets `jobId = "abc"` in store), then clicks "New Analysis". The wizard starts at step 4 because `jobId` is still set and `useJobRehydrate` sees it as a completed job.
**Why it happens:** `wizardStore.reset()` is not called when the user navigates back to the history screen after a reload.
**How to avoid:** Call `useWizardStore.getState().reset()` when returning to the history view (either on history view mount or on "New Analysis" click). The store `initialState` sets `jobId = null`, so reset is sufficient.
**Warning signs:** Clicking "New Analysis" skips persona/content steps and lands directly on results.

### Pitfall 5: MSW handlers missing for new `GET /jobs` endpoint breaks existing tests
**What goes wrong:** Vitest unit tests and the E2E happy-path spec hit unhandled `GET /jobs` requests, causing MSW `onUnhandledRequest: "error"` to throw.
**Why it happens:** `tests/msw/handlers.ts` does not yet have a `GET /jobs` handler.
**How to avoid:** Add `http.get("http://localhost:8000/jobs", ...)` returning the seeded job list to `handlers.ts` in Wave 0 of 05-01.
**Warning signs:** Existing Vitest suite fails with "MSW: unhandled GET /jobs" error after the new endpoint is added.

### Pitfall 6: Theme flash on page load (FOUC)
**What goes wrong:** Page briefly shows light theme before JS hydrates and adds `.dark` to `<html>`, causing a visible flash.
**Why it happens:** The `useEffect` in the theme applier runs after the first render paint.
**How to avoid:** Add an inline `<script>` in `index.html` that reads `localStorage.getItem("brainx-theme")` and adds the `.dark` class before React renders. This is the standard "no-FOUC" pattern for localStorage-based themes.
**Warning signs:** Visible white flash on page load when dark theme is persisted.

---

## Code Examples

### GET /jobs list endpoint (backend)

```python
# Source: existing GET /jobs/{job_id} pattern in backend/routers/jobs.py
from backend.models.schemas import JobSummary  # new Pydantic model

@router.get("/jobs", response_model=list[JobSummary])
async def list_jobs() -> list[JobSummary]:
    async with database.async_session() as session:
        result = await session.execute(
            select(Job)
            .where(Job.persona_id.isnot(None))
            .where(Job.content_id.isnot(None))
            .order_by(Job.created_at.desc())
            .limit(50)
        )
        jobs = result.scalars().all()
    return [
        JobSummary(
            job_id=j.id,
            status=j.status,
            persona_id=j.persona_id,
            created_at=j.created_at.isoformat() if j.created_at else None,
        )
        for j in jobs
    ]
```

Note: `JobSummary` must be added to `backend/models/schemas.py`. Persona name is not available at the job level — two options: (a) include `persona_id` and let the frontend join against its cached persona list, or (b) perform a SQL join to denormalize `persona.name` into the response. Option (a) is simpler and the frontend already caches personas via `listPersonas()`.

### JobSummary Pydantic schema

```python
# backend/models/schemas.py addition
class JobSummary(BaseModel):
    job_id: str
    status: str
    persona_id: Optional[str] = None
    created_at: Optional[str] = None
```

### useJobHistory React Query hook

```typescript
// frontend/src/features/history/useJobHistory.ts
import { useQuery } from "@tanstack/react-query";
import { listJobs } from "@/lib/api"; // new api.ts function

export function useJobHistory() {
  return useQuery({
    queryKey: ["jobs"],
    queryFn: ({ signal }) => listJobs(signal),
    staleTime: 10_000,
  });
}
```

### listJobs api.ts addition

```typescript
// frontend/src/lib/api.ts addition
export async function listJobs(signal?: AbortSignal): Promise<JobSummary[]> {
  const response = await fetch(`${API_BASE_URL}/jobs`, { signal });
  return parseResponse(response, jobSummaryListSchema); // add to api-schemas.ts
}
```

### No-FOUC theme script in index.html

```html
<!-- frontend/index.html — inside <head>, before any stylesheets -->
<script>
  (function () {
    try {
      var stored = JSON.parse(localStorage.getItem("brainx-theme") || "{}");
      var theme = stored.state && stored.state.theme;
      if (theme !== "light") {
        document.documentElement.classList.add("dark");
      }
    } catch (e) {}
  })();
</script>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hard-coded "dark" class on mount (Phase 4 D-20) | Zustand-persisted theme toggle (Phase 5 D-11) | Phase 5 | Requires no-FOUC script in `index.html` |
| Single catch-all route `path="*"` | Explicit `/` history route + `/results/:jobId` shareable route | Phase 5 | `App.tsx` and `routes.tsx` updated |
| No queue guard (jobs accepted unconditionally) | 503 guard at `queue_depth >= 3` | Phase 5 | `analyze.py` changes; frontend error handling extended |

**Deprecated/outdated:**
- The `appRoutes` constant in `routes.tsx` currently exports `["/"]` — it will need to export both `"/"` and `"/results/:jobId"` after Phase 5. This constant may not be used anywhere; verify before updating.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Persona name for history cards is retrieved by cross-referencing `persona_id` against the React Query `listPersonas` cache | Architecture Patterns / Pattern 1 | If personas are deleted, history cards show "Unknown Persona" — acceptable for MVP; low risk |
| A2 | `asyncio.wait_for` with `timeout=` seconds wrapping `_process_job` is safe and will not leave partial DB state on timeout | Architecture Patterns / Pattern 4 | If mid-write on timeout, the job row may have status "RUNNING" permanently; the `_mark_timed_out` handler must be robust to this |
| A3 | `gpu_queue.qsize()` is accurate enough for the 503 guard without a lock | Architecture Patterns / Pattern 5 | asyncio is single-threaded; `qsize()` is reliable in a single-worker asyncio context [VERIFIED: codebase — backend uses `--workers 1` per INFRA-01] |

---

## Open Questions

1. **Persona join for history cards**
   - What we know: `Job` has `persona_id` FK; `Persona` has `name`. The history card needs `persona_name` for display (D-02).
   - What's unclear: Whether to join at the DB level (`JobSummary` includes `persona_name`) or let the frontend cross-reference its cached persona list.
   - Recommendation: Frontend cross-reference using the existing `usePersonas` hook and cache. Simpler endpoint, no join query. If the persona was deleted, show "Deleted Persona" gracefully.

2. **Demo activation data for brain canvas**
   - What we know: `ResultsLayout` calls `useActivation(jobId, screenIndex)` which hits `GET /jobs/{id}/activations/{screen}`. Demo has no real job ID.
   - What's unclear: Whether to commit a real Float32 binary as a static asset or use a synthetic array.
   - Recommendation: For the placeholder, hard-code a flat synthetic Float32 array (all values = 0.5) in a `useDemoActivation` hook. The user can replace with real data when they supply the real demo content (D-07).

3. **WizardShell entry point after route restructure**
   - What we know: `WizardShell` is currently the only route. History screen must become `/`.
   - What's unclear: Whether the wizard becomes a new `/wizard` route or a full-screen overlay rendered on top of `/`.
   - Recommendation: Full-screen overlay pattern — avoids URL confusion and preserves the existing `localStorage` persist behavior which is keyed by step number, not URL. The overlay is managed by a simple boolean in `HistoryView`'s local state or a `isWizardOpen` flag in `wizardStore`.

---

## Environment Availability

Step 2.6: No new external dependencies identified for Phase 5. All required tools (Node.js, npm, Python/FastAPI, SQLite) are already verified from prior phases. No additional environment audit needed.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 + Testing Library React 16 [VERIFIED: package.json] |
| Config file | `frontend/vitest.config.ts` |
| Quick run command | `cd frontend && npx vitest run --reporter=verbose` |
| Full suite command | `cd frontend && npx vitest run` |
| E2E command | `cd frontend && npx playwright test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FE-04 | `GET /jobs` returns list of real analysis jobs | unit (MSW) | `npx vitest run tests/history/` | No — Wave 0 |
| FE-04 | History view renders session cards from job list | unit (RTL) | `npx vitest run tests/history/` | No — Wave 0 |
| FE-04 | Clicking a history card loads results view with stored result | unit (RTL) | `npx vitest run tests/history/` | No — Wave 0 |
| FE-03 | Demo card renders as pinned with distinct badge | unit (RTL) | `npx vitest run tests/history/` | No — Wave 0 |
| FE-03 | Demo card clicking loads results from fixture JSON | unit (RTL) | `npx vitest run tests/history/` | No — Wave 0 |
| D-08 | Timed-out job has status="ERROR" and descriptive error_message | unit (pytest, backend) | `cd backend && pytest tests/test_watchdog.py -x` | No — Wave 0 |
| D-09 | POST /analyze with queue_depth >= 3 returns 503 | unit (pytest, backend) | `cd backend && pytest tests/test_queue_guard.py -x` | No — Wave 0 |
| D-11 | Theme toggle persists to localStorage and toggles .dark class | unit (RTL) | `npx vitest run tests/theme/` | No — Wave 0 |
| D-12 | `/results/:jobId` route renders ResultsLayout for a real job | unit (RTL) or E2E | `npx vitest run tests/shared-results/` | No — Wave 0 |

### Sampling Rate
- **Per task commit:** `cd frontend && npx vitest run --reporter=verbose`
- **Per wave merge:** `cd frontend && npx vitest run && npx playwright test`
- **Phase gate:** Full Vitest suite green + E2E happy-path green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `frontend/tests/history/HistoryView.test.tsx` — covers FE-04 card rendering and session reload
- [ ] `frontend/tests/history/DemoCard.test.tsx` — covers FE-03 demo fixture load
- [ ] `frontend/tests/theme/themeToggle.test.ts` — covers D-11 theme persistence
- [ ] `frontend/tests/shared-results/SharedResultsPage.test.tsx` — covers D-12 shareable URL
- [ ] `frontend/tests/msw/handlers.ts` update — add `GET /jobs` handler (prevents MSW unhandled request errors in existing tests)
- [ ] `backend/tests/test_watchdog.py` — covers D-08 timeout watchdog
- [ ] `backend/tests/test_queue_guard.py` — covers D-09 503 guard

---

## Security Domain

No new authentication surface is introduced in Phase 5. The app remains single-user with no auth (per REQUIREMENTS.md Out of Scope). The following ASVS categories apply at low risk:

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No auth in MVP |
| V3 Session Management | No | No server sessions; localStorage only |
| V4 Access Control | No | Single-user tool |
| V5 Input Validation | Yes (low) | Zod schema on `jobSummaryListSchema`; FastAPI Pydantic on `GET /jobs` response |
| V6 Cryptography | No | No new crypto surface |

**Threat specific to Phase 5:** The shareable `/results/:jobId` URL exposes analysis results to anyone with the URL (no auth). This is acceptable per REQUIREMENTS.md (no OAuth for v1) and is a portfolio/research sharing feature. No mitigation required for MVP.

---

## Sources

### Primary (HIGH confidence)
- Codebase: `backend/core/queue.py` — verified `gpu_worker_loop`, `_process_job`, error status strings
- Codebase: `backend/routers/analyze.py` — verified `gpu_queue.put()` call site for queue guard placement
- Codebase: `backend/routers/jobs.py` — verified `GET /jobs/{job_id}` pattern for new list endpoint
- Codebase: `frontend/src/stores/wizardStore.ts` — verified `persist` middleware pattern for theme store
- Codebase: `frontend/src/features/results/ResultsLayout.tsx` — verified no existing `resultOverride` prop; requires addition for demo
- Codebase: `frontend/src/lib/api-schemas.ts` — verified Zod `jobStatusSchema` only allows `"PENDING" | "RUNNING" | "DONE" | "ERROR"`
- Codebase: `frontend/tests/msw/handlers.ts` — verified `buildFixtureResult()` as valid placeholder for demo fixture
- Codebase: `frontend/src/App.tsx` and `routes.tsx` — verified current single catch-all route
- Codebase: `frontend/package.json` — verified all dependency versions

### Secondary (MEDIUM confidence)
- [ASSUMED] `asyncio.wait_for` behavior on timeout in a running coroutine — standard Python stdlib behavior; cancels the coroutine and raises `TimeoutError`
- [ASSUMED] Zustand v5 `persist` middleware API unchanged from v4 for `createJSONStorage` — same pattern already works in `wizardStore.ts` at v5.0.12

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified against package.json
- Architecture: HIGH — patterns derived directly from existing codebase code
- Backend changes: HIGH — queue.py and analyze.py read verbatim
- Pitfalls: HIGH (P1-P4) — derived from codebase contradictions; MEDIUM (P5-P6) — common patterns

**Research date:** 2026-04-28
**Valid until:** 2026-05-28 (stable dependencies; 30-day window)
