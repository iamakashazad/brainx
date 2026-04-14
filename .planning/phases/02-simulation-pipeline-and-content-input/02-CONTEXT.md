# Phase 2: Simulation Pipeline and Content Input - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Bridge user input to the GPU worker built in Phase 1. This phase delivers:
- Persona CRUD (save/reuse across sessions — PERS-01..PERS-04)
- Content input across three paths: 1–5 UI screens, static content, pasted text (CONT-01..CONT-03)
- DeepSeek simulation service that produces a schema-conformant, screen-grounded session log (SIM-01, SIM-04)
- Backend-derived scroll/hesitation overlay from the simulation log (SIM-02)
- Expansion of the Phase 1 job lifecycle to include simulation + grounding stages before inference

Out of scope: TRIBEv2 ROI aggregation (Phase 3), recommendations engine (Phase 3), any frontend work (Phase 4), persistent session history UI (Phase 5). Phase 2's `/analyze` hands off to the existing GPU queue worker but does not yet guarantee ROI outputs.

</domain>

<decisions>
## Implementation Decisions

### DeepSeek Simulation Service
- **D-01:** DeepSeek-VL2 for any content containing images (UI-screen flows CONT-01 and static image content CONT-02). DeepSeek-V3 for pasted-text content (CONT-03). Content type dispatches model choice — no cross-routing.
- **D-02:** Simulation output is a strict JSON schema enforced via DeepSeek's `response_format` (JSON mode) and validated by a Pydantic v2 model on return. Schema violations trigger a single "repair" retry prompt before failing the job.
- **D-03:** Screen grounding is validated by a second DeepSeek-VL2 pass acting as judge: given the uploaded screens and the narrative produced by D-01, return a list of referenced UI elements not visible in the images. Any hallucination returned ⇒ job fails grounding. No threshold — zero-tolerance for v1 since Phase 2 success criterion #3 gates on this.
- **D-04:** Failure policy mirrors Phase 1 D-07. Transient/schema failures retry once (schema failures use a "repair" prompt; API errors use identical prompt). Hallucination failures do NOT retry (deterministic). After retry exhaustion, job transitions to ERROR with a descriptive `error_message` visible via `GET /jobs/{id}`.

### Persona Builder API
- **D-05:** Personas live in a single `personas` SQLAlchemy table with typed JSON columns per group: `demographics`, `psychographics`, `cognitive_state`, `environment`, plus `id`, `name`, `created_at`, `updated_at`. Each JSON blob is validated by a dedicated Pydantic v2 model on write. Matches the JSON-in-SQLite pattern established by `Job.result_json` in Phase 1.
- **D-06:** Persona endpoints: `POST /personas`, `GET /personas`, `GET /personas/{id}`, `PATCH /personas/{id}`, `DELETE /personas/{id}`. Personas are reusable resources — this is how PERS-04 is delivered. No ownership/auth checks in v1 (single-user research preview per REQUIREMENTS).

### Content Input API
- **D-07:** `Content` is an independent resource keyed by `content_id`. Three types: `ui_screens` (1–5 images), `static` (1 image), `text` (inline string). Endpoint: `POST /content` (multipart for image types, JSON for text) → returns `content_id`. Content is then referenced by `POST /analyze { persona_id, content_id }`.
- **D-08:** Image files stored on disk under `uploads/{content_id}/` (for `ui_screens`: `screen_{n}.jpg`; for `static`: `image.jpg`). Mirrors Phase 1's `activations/{job_id}.npy` filesystem pattern. Text paste stored inline in a `content_text` column (no filesystem entry). Metadata (type, screen count, original filenames, created_at) stored in a `contents` SQLite table.
- **D-09:** Image processing pipeline (Pillow 11.x): validate MIME is `image/{png,jpeg,webp}`, enforce pre-resize size ≤ 5 MB, resize so longest edge ≤ 1024 px, re-encode as JPEG Q85, strip EXIF. Reject files outside the MIME/size envelope with a 400. Processing runs synchronously in the POST handler — keeps the content write atomic.
- **D-10:** `ui_screens` flows are bounded to 1–5 images per roadmap/REQUIREMENTS. `POST /content` returns 400 if screen count falls outside this range. Matches OOS: "flows longer than 5 screens".

### Composition and Orchestration
- **D-11:** `POST /analyze` accepts `{ persona_id, content_id }` and returns `{ job_id, status: "PENDING" }`. The endpoint creates the job row, enqueues to `asyncio.Queue`, and returns immediately — all long-running work happens in the GPU worker coroutine. Matches Phase 1's queue ownership of all long work.
- **D-12:** Job row gains two nullable FKs: `persona_id`, `content_id`. Existing Phase 1 test-inference jobs (`/test-inference`) continue to work with these as NULL — no breaking schema change, single alembic migration adds the columns.

### Simulation Log Schema (SIM-01, SIM-04)
- **D-13:** Simulation log shape: `screens: [{ screen_index, narrative_text, summary_emotional_state, memorability_hypothesis, events: [{ timestamp_ms, type: "fixation"|"scroll"|"hesitation"|"click_intent"|"emotional_shift", target_region: { x_ratio, y_ratio, width_ratio, height_ratio } | null, intensity: 0..1, note }] }]`. For static content and text content, there is exactly one "screen" entry (screen_index=0). Screen-indexed structure supports per-screen views downstream (BRAIN-02, FE-02 in Phase 4).
- **D-14:** `narrative_text` per screen is the user-facing raw log for SIM-04. No separate narrative field at the top level. The frontend renders per-screen narrative alongside the events table.

### Scroll/Hesitation Overlay Derivation (SIM-02)
- **D-15:** Overlays are derived deterministically in the backend from the structured `events[]` — no second LLM call. A `backend/services/overlay.py` service emits, per screen: `hesitation_points: [{ x_ratio, y_ratio, duration_ms, intensity }]` and `scroll_path: [{ t_ms, y_ratio }]`. Input types without a vertical axis (pasted text, single static image) emit only `hesitation_points`; `scroll_path` is empty or null.
- **D-16:** Overlays are computed once at the end of the simulation stage and merged into the job result. Frontend never re-derives from raw events; it renders the precomputed overlay.

### Storage & API Surface for the Log (SIM-04)
- **D-17:** Full structured simulation log + overlays are persisted in `Job.result_json` (existing Phase 1 column). `GET /jobs/{id}` returns the full structure once `status=DONE` for the simulation stage onward. No new endpoint for the log — one source of truth per job.

### Job Lifecycle Expansion
- **D-18:** 5-stage lifecycle expands the Phase 1 `stage` column (no schema change needed per Phase 1 D-06): `simulation` → `grounding_check` → `inference` → `processing` → (DONE). Status transitions remain `PENDING` → `RUNNING` → `DONE`/`ERROR`; `stage` tracks fine-grained progress during RUNNING.
- **D-19:** Stages are centralized as a `StageEnum` in `backend/models/job.py` (or a sibling module). A `transition(job, StageEnum.X)` helper in `backend/core/queue.py` replaces inline string assignments — it writes to the DB and emits a log line. All new and existing stage writes MUST go through the helper.
- **D-20:** Per-stage failure policy:
  - `simulation` (DeepSeek API/schema errors): retry once (D-04)
  - `grounding_check`: no retry on hallucination — job → ERROR with a concrete `error_message` listing hallucinated elements
  - `inference`: inherits Phase 1 D-07 (single retry)
  - `processing` (overlay derivation, result assembly): pure code — any exception is a bug, fail hard with ERROR

### Claude's Discretion
- Exact DeepSeek prompt text for V3 and VL2 paths (iterate until grounding check passes during implementation)
- Internal module layout for `backend/services/` additions (simulation, grounding, overlay, content) — keep files small
- Alembic migration file naming (just follow `00N_description.py`)
- Exact repair-prompt wording for schema-failure retry
- Whether to store a cached base64 of resized images or re-encode on VL2 call
- Intensity scale normalization rules for `events[].intensity` (must be 0..1 but exact mapping from DeepSeek output up to Claude)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Requirements & Vision
- `.planning/PROJECT.md` — Core value, TRIBEv2 non-commercial constraint, single-user MVP scope, stack decisions
- `.planning/REQUIREMENTS.md` — SIM-01, SIM-02, SIM-04, CONT-01..03, PERS-01..04 acceptance criteria; DeepSeek stack note
- `.planning/ROADMAP.md` §"Phase 2" — Phase boundary, success criteria, plans list

### Research (Phase 1 deliverables)
- `.planning/research/STACK.md` — Python 3.11, FastAPI, async SQLAlchemy, aiosqlite, Pillow 11.x, DeepSeek API
- `.planning/research/ARCHITECTURE.md` — Queue ownership of long-running work, single-worker pattern, content flow
- `.planning/research/PITFALLS.md` — Hallucination risk in LLM-driven simulation (analogous to TRIBEv2 text-path differentiation); structured-output failure modes
- `.planning/research/SUMMARY.md` — Stack confidence assessment, phase-by-phase guidance

### Phase 1 Prior Decisions (carried forward)
- `.planning/phases/01-foundation-and-tribev2-integration/01-CONTEXT.md` — Phase 1 D-05 (endpoint shape), D-06 (job lifecycle extensibility), D-07 (retry-once-then-ERROR pattern), D-10 (consumer-friendly naming), overall error handling philosophy
- `.planning/phases/01-foundation-and-tribev2-integration/01-04-PLAN.md` — In-flight gap closure; Phase 2 planner must read VERIFICATION.md and assume 01-04 is merged before Phase 2 code lands

### Existing Codebase Anchors (read before touching)
- `backend/main.py` — Lifespan, CORS config, router wiring
- `backend/core/database.py` — Async session pattern
- `backend/core/queue.py` — Queue worker loop, `_process_job`, position tracking
- `backend/models/job.py` — Job schema (retains `stage`, `result_json`, `input_path`, `input_type`)
- `backend/models/schemas.py` — Pydantic v2 request/response patterns in use
- `backend/routers/jobs.py` — `/test-inference`, `/jobs/{id}` patterns
- `backend/services/inference.py` — TRIBEv2 inference entry points for text + video paths
- `backend/services/pathway_config.py` — DEFAULT_PATHWAY toggle (text vs video) — Phase 2 must respect the value set after 01-04 differentiation gate
- `alembic/versions/001_create_jobs_table.py` — Migration pattern to follow

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/core/queue.py:gpu_worker_loop` and `_process_job` — Extend in-place; the worker is where simulation + grounding + inference + processing stages will run sequentially per job.
- `backend/core/database.async_session` — Use for all SQLite writes; every new service call that persists should open a session.
- `Job.result_json` column — Already exists, no migration needed; simulation log + overlay + (eventually) ROI results all fit here.
- `Job.stage` column — Already exists; StageEnum formalizes values per D-19.
- `backend/services/inference.py:run_tribev2_text` / `run_tribev2_video` — Called from the worker as the `inference` stage; Phase 2 must dispatch on content type + pathway_config.

### Established Patterns
- Pydantic v2 schemas in `backend/models/schemas.py` — mirror for Persona/Content/Simulation models.
- Router files under `backend/routers/` — add `personas.py`, `content.py`, `analyze.py` (or fold analyze into `jobs.py`) following the `jobs.py` style.
- Services under `backend/services/` — add `simulation.py`, `grounding.py`, `overlay.py`, `content_processing.py` modules.
- Retry-once-then-ERROR policy from Phase 1 D-07 is the template for all external calls (both TRIBEv2 and DeepSeek).
- `uploads/` filesystem convention (mirrors `activations/`, `model_cache/`) — add to `.gitignore`.

### Integration Points
- `POST /analyze` is the new composition entry point — creates Job row, enqueues, returns PENDING.
- Worker `_process_job` is the stage-runner — in Phase 2 it gains branches for simulation + grounding + processing before calling `run_tribev2_*`.
- `Job.persona_id`, `Job.content_id` FKs are added via a new alembic migration; existing Phase 1 test jobs remain valid with NULL values.
- Phase 3 will consume `Job.result_json.simulation` + TRIBEv2 activations to produce ROI scores — Phase 2 must leave `processing` stage hook points so Phase 3 can extend rather than rewrite.

</code_context>

<specifics>
## Specific Ideas

- Follow the Phase 1 coding style: `from __future__ import annotations`, async SQLAlchemy 2.0 idioms, Pydantic v2, no sync I/O in request handlers.
- Hallucination check wording should list concrete unseen elements in `error_message` (e.g., "Narrative references 'Submit order' button not visible in screen 2") so the end user can correct persona/content and retry.
- Intensity-scale normalization (events[].intensity) should be documented in a comment on the Pydantic model so the frontend and recommendations engine downstream know the range.

</specifics>

<deferred>
## Deferred Ideas

- Job lifecycle + /analyze orchestration as a stand-alone discussion area — captured implicitly via D-11/D-12/D-18..D-20; no separate deep-dive needed for v1.
- Rate limiting / queue-depth rejection (`429` at depth ≥ 5) — Phase 5 per ROADMAP.
- 300 s job timeout watchdog — Phase 5 per ROADMAP.
- Multiple personas per session — OOS in REQUIREMENTS.
- URL screenshot auto-capture for live pages (EXT-02) — v2.
- A/B variant comparison (ADV-01) — v2.
- Persisted content ownership / auth scoping — no auth in v1 per REQUIREMENTS.

</deferred>

---

*Phase: 02-simulation-pipeline-and-content-input*
*Context gathered: 2026-04-14*
