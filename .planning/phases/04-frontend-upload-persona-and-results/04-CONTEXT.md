# Phase 4: Frontend — Upload, Persona, and Results - Context

**Gathered:** 2026-04-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the complete React frontend for BrainX: a step wizard that lets users pick/create a persona, upload or paste content, run an analysis job against the existing backend, watch it progress, and view the results — including the 3D brain visualization, per-screen scrubber, five-circuit score readouts, and recommendations grounded to brain regions. Session persistence, the pre-built demo case study, and production polish belong to Phase 5.

</domain>

<decisions>
## Implementation Decisions

### Project Shape & Stack
- **D-01:** React app lives at `frontend/` as a sibling to `backend/`.
- **D-02:** Vite + React 18 or 19 + TypeScript. No Next.js; no CSR-only JS. _(Updated 2026-04-24: widened from "React 18" to "18 or 19" to accommodate `@react-three/fiber@9` peer dep; planner pins React 19 with user approval per /gsd-plan-phase verification loop.)_
- **D-03:** Tailwind CSS + Radix UI primitives for unstyled a11y components. No shadcn/ui install — components authored against Radix + Tailwind directly, consuming the token layer in `04-DESIGN-TOKENS.css`.

### Vertex & Atlas Delivery
- **D-04:** A new backend endpoint serves per-screen vertex activation arrays as **binary Float32** (not JSON). The `activations` manifest in `AnalysisResult` already points to on-disk paths; the new endpoint reads those and streams them.
- **D-05:** The per-screen vertex endpoint returns **time-mean only** — a single Float32 array of ~20,481 vertices (fsaverage5 whole-brain). No peak, no full timeseries in this phase.
- **D-06:** The fsaverage5 parcellation (vertex→ROI mapping + mesh geometry) is bundled as a **one-time static asset in the frontend**, not an endpoint. Referenced from `frontend/public/` or imported at build time.

### Results Panel & 3D Brain
- **D-07:** Results layout is **brain-primary**: the 3D brain occupies 60–70% of the viewport as the hero; recommendations panel sits alongside (side or below) as secondary. Reflects the core value prop ("not a heatmap").
- **D-08:** Per-screen navigation uses a **timeline scrubber** that auto-plays once through all screens on results load, settles on the final screen, and remains scrubbable by the user afterward.
- **D-09:** Only **one circuit is rendered at a time** on the brain. A toggle/selector lets the user switch between the five circuits. Default: the highest-scoring circuit for this job.
- **D-10:** Recommendations are **clickable → brain highlights** the referenced region and scrubs to the referenced screen. When a recommendation cites multiple screens/regions, jump to the primary (strongest-evidence) location and subtly mark the others on the timeline/brain; clicking the same rec again cycles through them.
- **D-11:** The 3D brain camera is **user-rotatable with preset view buttons** (lateral-L, lateral-R, superior, anterior). Uses Three.js OrbitControls + four quick-jump buttons.

### Upload + Persona Flow
- **D-12:** Flow is a **4-step wizard**: Persona → Content → Run → Results.
- **D-13:** Persona creation uses a **tabbed form**, one tab per backend sub-object (demographics, psychographics, cognitive_state, environment), with a progress indicator across the four tabs.
- **D-14:** Step 1 opens on a **persona library** populated by `GET /personas`; user picks a saved persona or opens the tabbed form to create a new one (which hits `POST /personas` and returns to the library with it selected).
- **D-15:** Content step uses **three explicit tabs** that map 1:1 to backend endpoints: **Text** (`POST /content/text`), **UI screens** (`POST /content/screens`, 1–5 images), **Static image** (`POST /content/static`).
- **D-16:** After Analyze is clicked, the app shows a **full-screen progress view** with the current stage (PENDING/SIMULATING/INFERRING/AGGREGATING/COMPLETE) and queue position, polling `GET /jobs/{id}`. It is non-dismissable until the job completes.
- **D-17:** On `COMPLETE` status, the progress view **auto-transitions immediately** to the results view — no click required.
- **D-18:** Wizard navigation is **free between completed steps** (stepper lets you jump back). Form state is persisted to `localStorage` so a browser refresh restores the user's in-progress wizard exactly where they left off.

### Visual Style
- **D-19:** `04-DESIGN-TOKENS.css` (in this phase directory) is the **canonical design system**. All colors, fonts, radii, and shadows flow through these CSS variables. Components must not introduce color literals.
- **D-20:** **Dark theme is the default.** The `.dark` class is applied to the root `<html>` element on app mount; `:root` tokens remain available for a future light toggle but are not wired for Phase 4.
- **D-21:** Typography: Inter (sans, default), Lora (serif, reserved for display if used), Roboto Mono (numeric readouts and circuit/region scores). Base radius `0.5rem`.
- **D-22:** 3D brain mesh uses **anatomical realism**: fsaverage5 mesh with proper per-vertex shading, matte MeshStandardMaterial, and subtle ambient occlusion so gyri/sulci read credibly.
- **D-23:** Overall motion is **rich/cinematic** — motion is part of the story. Hero moments animate: brain assembles on first results load, circuit-swap morphs the color field across vertices, timeline scrubber has satisfying easing, stage transitions in the progress view carry small flourishes.
- **D-24:** Data viz for circuit/region scores is **expressive**: bar gradients using the `--chart-1`→`--chart-5` tokens, animated fill on mount, larger presence than a minimal dashboard would use.
- **D-25:** Overall aesthetic echoes **Figma/Framer** — product-designer polish: defined card shadows, subtle playful hover states (e.g., tilt/lift on interactive cards), generous whitespace paired with moments of delight.

### Claude's Discretion
- **Content reuse / library**: user said "Claude's discretion" — default to **fresh upload only** for Phase 4 (no content library UI). Phase 5 owns persistence and can introduce a content library if needed. The backend tracks uploaded content in the DB already, so adding a list endpoint later is cheap.
- Exact loading-skeleton design and error-state treatments.
- Three.js camera start pose (within anatomical convention); easing curves; specific motion timings.
- Whether the progress view renders the target persona summary / content preview while waiting.
- How circuit names are spelled/ordered in the toggle (use whatever the backend returns in `ScreenROI.circuits`).
- Whether the stepper is horizontal at the top or vertical on the side.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 4 artifacts
- `.planning/phases/04-frontend-upload-persona-and-results/04-DESIGN-TOKENS.css` — Canonical design system (OKLCH color tokens, typography, radius, shadows). Both `:root` and `.dark` palettes; dark is default. Every component consumes these via Tailwind `@theme inline` mappings.

### Project-level
- `.planning/PROJECT.md` — Core value prop ("not a heatmap"), current focus Phase 4.
- `.planning/REQUIREMENTS.md` — Frontend requirements and backend requirements now satisfied.
- `.planning/ROADMAP.md` §Phase 4 — Phase goal and scope boundary.

### Upstream phase context
- `.planning/phases/03-full-pipeline-integration-and-recommendations-engine/03-CONTEXT.md` — Decisions that produced the `AnalysisResult` envelope and 5-circuit aggregation.

### Backend contract (what the frontend consumes)
- `backend/models/results.py` — `AnalysisResult` envelope: `simulation`, `overlays`, `activations[]` (vertex manifest), `roi[]` (per-screen circuits + regions, score/peak 0–100), `flow_continuity`, `recommendations[]`, `pathway`. Schema version 1.
- `backend/models/persona.py` — Persona shape: `demographics`, `psychographics`, `cognitive_state`, `environment` sub-objects (informs the 4-tab form).
- `backend/models/job.py` — Job states: PENDING / SIMULATING / INFERRING / AGGREGATING / COMPLETE / FAILED; `queue_position`; `stage`; `result_json`.
- `backend/routers/analyze.py` — `POST /analyze` with `persona_id` + `content_id` → returns `job_id` + `status`.
- `backend/routers/jobs.py` — `GET /jobs/{id}` → `JobStatusResponse` (status, stage, queue_position, result, error). **This is the poll target for the progress view.**
- `backend/routers/personas.py` — Full CRUD: list, create, read, update, delete personas.
- `backend/routers/content.py` — Three content endpoints: `/text`, `/screens` (1-5 images multipart), `/static` (single image multipart).
- `backend/main.py` — FastAPI app wiring, CORS setup (needed for `frontend/` dev server).

### Missing (to be created this phase)
- A new backend endpoint that reads `ActivationManifestEntry.path` and streams the Float32 binary array for a given `(job_id, screen_index)`. Exact path + shape is a planning task.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (backend)
- **`AnalysisResult` envelope (`backend/models/results.py`)** — Already includes per-screen ROI with circuits + regions and a Float32 activation manifest. Frontend consumes this directly from `result_json` in the job response; no envelope reshape needed.
- **Persona CRUD (`backend/routers/personas.py`)** — Full list/create/read/update/delete already exist. Persona library step wires straight into these.
- **Content endpoints (`backend/routers/content.py`)** — Three endpoints already 1:1 with the planned content tabs. No backend work needed for upload.
- **Job polling (`backend/routers/jobs.py`)** — `GET /jobs/{id}` returns status + stage + queue_position + result. Progress view polls this; no new status endpoint required.

### Missing / To Build (backend side of Phase 4)
- Per-screen vertex binary endpoint (**single new endpoint**) that reads the `.npy` (or equivalent) referenced by `ActivationManifestEntry.path` and returns Float32 bytes. Sets `Content-Type: application/octet-stream` and an `X-Shape` header (or query echo) so the client knows the array length.
- CORS config in `backend/main.py` to allow the Vite dev server origin.

### Established Patterns
- Backend is FastAPI + async SQLAlchemy; JSON envelopes are Pydantic models; file uploads via multipart. Frontend uses `fetch` or a light wrapper; no GraphQL, no tRPC.
- SQLite in dev; nothing in the DB that isn't already exposed via a router.

### Integration Points
- **Dev server**: Vite on a dedicated port; backend on its own; Vite proxy OR CORS. Planner picks.
- **API client**: A typed client in `frontend/src/lib/api.ts` derived from the Pydantic shapes. TypeScript types hand-mirrored or via a minimal OpenAPI codegen — planner decides.
- **Design tokens**: `04-DESIGN-TOKENS.css` copied/symlinked into `frontend/src/styles/tokens.css` and imported from `main.tsx`. Tailwind config reads the `@theme inline` block.
- **fsaverage5 mesh + parcellation**: Bundled under `frontend/public/brain/` as a binary mesh (e.g., `.gz` of vertex positions + triangle indices) plus a parcellation JSON mapping vertex indices to atlas labels.

</code_context>

<specifics>
## Specific Ideas

- "We gonna use this as a design system so I can modify ui later." → 04-DESIGN-TOKENS.css is the single source of truth. Every color/radius/shadow lives here; components consume via Tailwind tokens. Changing the UI later = editing one file.
- "Needs to proper dark theme." → Dark theme is the default on first mount, not a toggled alternative. Light palette exists in `:root` for a future light mode but is not wired in Phase 4.
- Aesthetic references: Figma/Framer polish (defined shadows, hover playfulness), combined with rich cinematic motion (brain assembly on first load, circuit morphing). Brain itself reads as real neuroanatomy — not a stylized abstraction — so the measurement feels credible.
- Results hero is the brain. Recommendations are the action, but the brain is the proof.
- Scrubber auto-plays once — the "look what happened in their brain as they moved through your content" moment is designed in.

</specifics>

<deferred>
## Deferred Ideas

- **Content library / reuse UI** — Claude's discretion for Phase 4 → default to fresh upload. If Phase 5 persistence needs a content browser, add it there.
- **AI-assisted persona ("describe in plain text, auto-fill fields")** — considered and declined in favor of the tabbed form. Worth revisiting after Phase 5 if persona creation friction is a real drag.
- **Light theme toggle** — tokens exist for both; wiring the toggle belongs with Phase 5 polish.
- **Shareable `/results/{job_id}` URLs** — considered during run-state discussion, not chosen for Phase 4 (user picked full-screen progress view). Relevant for Phase 5 session persistence; add then.
- **Queueing multiple jobs from the UI** — considered, not chosen. The current flow is one-at-a-time. Revisit if users ask for it.
- **Full timeseries / peak-activation-time vertex delivery** — only time-mean is shipped. If future viz needs per-timestep animation, the backend endpoint can add a second mode.
- **Scheduled / automated analysis runs** — out of scope for the whole milestone.

### Reviewed Todos (not folded)
None — no pending todos existed when this phase was discussed.

</deferred>

---

*Phase: 04-frontend-upload-persona-and-results*
*Context gathered: 2026-04-22*
