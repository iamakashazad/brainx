# Phase 5: Session Persistence, Demo, and Polish - Context

**Gathered:** 2026-04-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Past sessions are browsable and reloadable without rerunning inference; a pre-built demo loads quickly from a committed fixture; production hardening closes silent-failure and queue-overflow scenarios. Phase 4's results view is the foundation — this phase wraps it in persistence, a demo entry point, and polish.

</domain>

<decisions>
## Implementation Decisions

### Session History Design
- **D-01:** History layout is a **card grid** — reuses the existing card aesthetic from Phase 4 (card shadows, hover lift, design token colors).
- **D-02:** Each history card shows **minimal info only**: date, persona name, and status badge. No brain thumbnail or recommendation snippet required.
- **D-03:** The **app root (`/`) IS the history screen**. Session cards are the main content; a prominent "New Analysis" button sits at the top. No sidebar or separate nav link needed.

### Session Reload
- **D-04:** Clicking a past session **re-enters the wizard at Step 4 (Results)**. Result data is read from `result_json` on the Job record — no inference re-run. The Phase 4 results view renders with the stored payload.

### Demo Case Study
- **D-05:** The pre-built demo is a **pinned card always at the top of the history grid**, visually distinct (different border/badge). Clicking it loads results identically to any other session — no special route.
- **D-06:** Demo data is backed by a **committed JSON fixture in `frontend/public/demo/`** — a real `AnalysisResult` JSON produced by running inference once and committing the output. No backend call required to load the demo.
- **D-07:** The actual demo content (which screens / persona) is **provided by the user later**. The planner must leave a clearly documented fixture slot with swap instructions. Claude will use a placeholder UI-screen flow scenario until the real content is supplied.

### Production Hardening
- **D-08:** **Timeout watchdog** — backend marks a stuck job as `FAILED` with a descriptive error message after a configurable timeout (default: 10 minutes). Frontend polls and renders the error state. No auto-retry in this phase (Job model has `retry_count` for future use).
- **D-09:** **Queue depth guard** — backend returns HTTP 503 if `queue_depth >= 3` at the time of `/analyze` submission. Frontend catches 503 and shows a friendly "The system is busy — try again shortly" message without entering the wizard progress flow.
- **D-10:** **UI label audit** covers all user-facing text: job status labels, stage descriptions, error messages, empty state copy (empty history, failed job). Goal: no placeholder or inconsistent strings remain in the shipped UI.

### Deferred Phase 4 Polish (now in scope)
- **D-11:** **Light theme toggle** — wire the `:root` token palette to a theme toggle. Tokens already exist from Phase 4 (`04-DESIGN-TOKENS.css`). Dark remains the default; toggle persists to `localStorage`.
- **D-12:** **Shareable `/results/{job_id}` URLs** — each completed session gets a bookmarkable URL. Frontend reads the job by ID from `GET /jobs/{job_id}` and renders the results view directly. Good for portfolio sharing.

### Claude's Discretion
- Demo fixture placeholder content (UI-screen flow scenario and persona) until user provides the real assets.
- Exact timeout value (suggested: 10 minutes) and whether it's an env var or hard-coded constant.
- Visual treatment of the pinned demo card (border color, badge label).
- How the "New Analysis" CTA is positioned on the home/history screen.
- Exact 503 error message copy and whether it surfaces queue depth to the user.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 4 design system and decisions
- `.planning/phases/04-frontend-upload-persona-and-results/04-CONTEXT.md` — All locked Phase 4 decisions: design tokens, wizard structure, results view, dark-first theme. Phase 5 builds on all of these.
- `.planning/phases/04-frontend-upload-persona-and-results/04-DESIGN-TOKENS.css` — Canonical design system. Phase 5 components must consume these tokens; no color literals.

### Project-level
- `.planning/PROJECT.md` — Core value prop and MVP scope.
- `.planning/REQUIREMENTS.md` — FE-03 (pre-built demo) and FE-04 (session history) are the Phase 5 frontend requirements.
- `.planning/ROADMAP.md` §Phase 5 — Phase goal and plan breakdown (05-01: history API + view, 05-02: demo, 05-03: hardening).

### Backend contract (what Phase 5 consumes)
- `backend/models/job.py` — Job model with `created_at`, `persona_id`, `content_id`, `status`, `result_json`, `retry_count`. History view reads these; watchdog marks `status = FAILED`.
- `backend/routers/jobs.py` — `GET /jobs/{id}` — the load-session and shareable-URL read endpoint. Needs a `GET /jobs` list endpoint added for history.
- `backend/routers/analyze.py` — `POST /analyze` — needs queue-depth guard before enqueuing.
- `backend/core/queue.py` (or equivalent) — Queue depth check location for the 503 guard.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Phase 4 results view** (`frontend/src/features/results/`) — Already built. Session reload (D-04) re-uses it directly by injecting stored `result_json` instead of live job data.
- **`useJobStatus` / `useJobRehydrate`** (`frontend/src/features/run/`) — Polling and rehydration hooks. The shareable URL feature (D-12) will reuse the rehydrate pattern.
- **`PersonaCard`** (`frontend/src/features/persona/PersonaCard.tsx`) — Existing card component for persona display. History cards can follow the same card pattern.
- **`wizardStore`** (`frontend/src/stores/wizardStore.ts`) — Zustand store for wizard state. Session reload will need to hydrate this store from stored job data to re-enter at step 4.
- **`api.ts` + `api-types.ts`** (`frontend/src/lib/`) — Typed API client. A `listJobs()` call needs to be added for the history view.

### Established Patterns
- Route structure is minimal (currently only `/` in `routes.tsx`). Shareable URLs need a `/results/:jobId` route added.
- `localStorage` is already used for wizard state persistence (D-18 from Phase 4). Theme toggle preference follows the same pattern.
- Job model already has `retry_count` column — watchdog can read/write without a migration.

### Integration Points
- **New backend endpoint needed**: `GET /jobs` — paginated list of all jobs (for history view). Currently only `GET /jobs/{id}` exists.
- **Queue depth check**: needs to read `gpu_queue.qsize()` before enqueuing in `POST /analyze`.
- **Demo fixture**: `frontend/public/demo/result.json` — a static file that bypasses the API entirely. The frontend checks for this path when rendering the pinned demo card.

</code_context>

<specifics>
## Specific Ideas

- "I'll give the demo stuff later." — Demo content (screens + persona) is user-supplied. The planner must build a clearly documented swap mechanism so the user can drop in their assets without code changes.
- The home screen should feel like a launch pad — history cards are the main content, but "New Analysis" should be unmissable. Not buried.
- Pinned demo card should be visually distinct enough that a first-time visitor immediately understands it's a starting point, not a past run.

</specifics>

<deferred>
## Deferred Ideas

- **Content library / reuse UI** — Still deferred. Phase 5 doesn't add a content browser; the backend tracks uploaded content in DB already, cheap to add later.
- **AI-assisted persona creation** — Deferred from Phase 4, still deferred.
- **Full timeseries / peak-activation-time vertex delivery** — Only time-mean shipped in Phase 4. Full timeseries remains deferred.
- **Multiple simultaneous personas** — Out of scope per PROJECT.md.
- **A/B variant comparison (ADV-01)** — v2 requirement; depends on stable session persistence (now being built) but explicitly out of MVP scope.

### Reviewed Todos (not folded)
None — no pending todos existed when this phase was discussed.

</deferred>

---

*Phase: 05-session-persistence-demo-and-polish*
*Context gathered: 2026-04-28*
