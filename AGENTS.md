# AGENTS.md

This file provides guidance to AI coding agents (Codex and others) working in this repository. It mirrors CLAUDE.md; keep the two in sync.

## What BrainX is

Simulates how a persona experiences marketing content, runs the TRIBEv2 brain-encoding model over the simulated experience, and returns per-screen brain-circuit activation scores (Attention, Cognitive Load, Emotional Response, Memory Encoding, Reward) plus grounded copy recommendations. FastAPI + SQLite backend, React/Vite frontend.

## Commands

Backend (the Python 3.11 venv lives outside the repo; `setup_env.sh` creates it at `$BRAINX_VENV`, default `~/.venvs/brainx`. `$PY` below means that venv's `bin/python`):

```bash
$PY -m uvicorn backend.main:app --port 8000   # run server (loads TRIBEv2 at startup, ~1 min)
$PY -m pytest tests/ -q                       # full backend suite
$PY -m pytest tests/test_analyze.py -q        # one file
$PY -m pytest tests/test_watchdog.py::test_watchdog_marks_job_error_on_timeout -q
```

Frontend (from `frontend/`):

```bash
npm run dev          # Vite dev server on :5173
npx tsc -b --force   # typecheck — ALWAYS --force; stale tsbuildinfo has masked real errors
npx vitest run       # unit tests (jsdom + msw)
npx vitest run src/features/run/__tests__/useJobStatus.test.ts   # one file
```

Headless E2E (no browser): create persona via `POST /personas`, `POST /content/text`, `POST /analyze`, then poll `GET /jobs/{id}` until DONE/ERROR. **Use one-sentence content** — each simulated screen costs ~2–3 min of CPU inference (TTS → whisperx → model.predict), and multi-screen content can exceed the 3600s job timeout. Keep the machine awake (e.g. `caffeinate -i` on macOS) — sleep freezes the server while the job's wall-clock timeout keeps counting.

## Architecture

### Analysis pipeline (the core of everything)

`POST /analyze` (backend/routers/analyze.py) validates persona/content + provider keys, enqueues a job. A **single asyncio worker** (`backend/core/queue.py::supervised_worker_loop` → `gpu_worker_loop` → `_process_job`) drives stages, writing each transition to the job row that the frontend polls:

```
SIMULATION        DeepSeek chat → structured per-screen behavior log (services/simulation.py, deepseek_client.py)
GROUNDING_CHECK   vision judge verifies narrative vs uploaded images; text content is a no-op (services/grounding.py)
INFERENCE         per-screen TRIBEv2 run via a 1-thread executor (services/inference.py); video fallback path builds a slideshow first (pathway_config.py, video_slideshow.py)
ROI_AGGREGATION   fsaverage5 vertices → Destrieux atlas regions → 5 circuits (services/roi_aggregation.py)
PROCESSING        0–100 rescale, overlays, flow continuity (services/overlay.py, continuity.py)
RECOMMENDATIONS   DeepSeek → validated against ROI evidence + behavioral coverage, 3 attempts (services/recommendations.py)
```

Result is persisted as `result_json` on the Job row (schema in backend/models/results.py); per-screen activation arrays are baked to `activations/<job_id>/screen_N.npy` and streamed by `GET /jobs/{id}/activations/{n}` as raw float32 (20484 vertices). Completed sessions are fully replayable without re-running inference.

Resilience invariants (do not regress these — they fix the historical "stuck in a loop" bugs):
- The worker loop must never die: `supervised_worker_loop` restarts it; every failure path calls `_fail_job`, which **preserves `job.stage`** and writes the real error message (no sanitized "please retry" strings).
- A timeout recycles the inference executor (`recycle_gpu_executor`) because a hung TRIBEv2 thread can't be killed and would poison every later job.
- Queue depth is capped (503) under `queue_capacity_lock`; poll-based staleness applies to PENDING jobs only (RUNNING is owned by the worker's `asyncio.wait_for`); a background sweeper handles jobs nobody polls; startup fails over interrupted jobs.
- Nothing synchronous/blocking on the event loop inside `_process_job` — wrap in `asyncio.to_thread`.

### External services (all required at runtime, keys in `.env`)

- **DeepSeek** (`DEEPSEEK_API_KEY`) — simulation + recommendations. Missing key = 422 at submit, not a queued failure.
- **Replicate** (`REPLICATE_API_TOKEN`) — vision judge for image content (deepseek-vl2). It's a *community* model: resolve `latest_version.id` via `GET /v1/models/{slug}` and POST `/v1/predictions` with the version hash; input schema is single `image` + `max_length_tokens`.
- **HuggingFace** (`HF_TOKEN`) — TRIBEv2 weights download (backend/ml/tribe_loader.py). Inference itself is local CPU (`DEVICE=cpu`; MPS stalls and is remapped to CPU).

### Third-party TRIBEv2 copy

`tribev2/` is a gitignored clone with local modifications (CPU whisper model choice, silero VAD, whisperx flake retry). `setup_env.sh` clones it at a pinned upstream commit and applies `patches/tribev2.patch`. Every change there MUST be captured in that patch (regenerate with `git -C tribev2 diff > patches/tribev2.patch`) and explained in `patches/tribev2-changes.md`. TRIBEv2 shells out to `uvx whisperx`. `model_cache/` (gitignored) holds the TRIBEv2 checkpoint (~0.7GB) plus the feature extractors it pulls (Llama-3.2-3B, w2v-BERT 2.0, V-JEPA 2 for video), so expect 15-25GB.

### Frontend

React Router pages under `src/pages/` are the live UI (`App.tsx` is the routing truth): Dashboard → PersonaStep → ContentStep → Running → Results, plus `SharedResultsPage` for `/results/:jobId` links. Wizard state (persona/content/job ids) persists in localStorage via `src/stores/wizardStore.ts` (zustand) — "New Analysis" must call `reset()`. Polling is centralized in `src/features/run/useJobStatus.ts`: 2s interval that stops on DONE/ERROR, on 4xx (terminal, never retried), or after 3 failed refetch cycles; terminal failures render the shared `src/components/AnalysisFailureCard.tsx`. Backend stage → display copy mapping lives in `src/lib/stageLabels.ts`; API zod schemas in `src/lib/api-schemas.ts` must stay in sync with `backend/models/schemas.py`.

Visual language is the Mintlify-inspired system in `DESIGN.md` with primitives in `src/components/design-system.tsx` and tokens in `src/styles/tokens.css`.

### Tests

- Backend: `tests/conftest.py` builds a per-test SQLite DB and app instance, fakes TRIBEv2 inference, and installs **hermetic dummy provider keys** — tests asserting missing-key behavior monkeypatch them back to `""`. `test_blind_eval_differentiates_opposite_profiles` makes live DeepSeek calls and is inherently flaky; rerun once before treating as a regression. If conftest fixtures mysteriously "don't exist", clear `__pycache__` and `.pytest_cache`.
- Frontend: msw handlers in `frontend/tests/msw/handlers.ts` (use `setJobResponse`/`setJobsList` helpers). Mock query-hook data must be referentially stable across renders, and never let jsdom render three.js elements with `Float32Array` props — both have caused OOM loops in `BrainCanvas.test.tsx`.

### Planning artifacts

`.planning/` is a GSD workflow directory (ROADMAP.md, STATE.md, per-phase plans/verification). Keep STATE.md and ROADMAP.md in sync with reality when completing significant work. Open items live in `04-UAT.md` (browser tests 11, 13–16) and `05-HUMAN-UAT.md` (4 human checks).

## Gotchas

- `git status` can hang for minutes if a large untracked tree appears (e.g. a fresh `node_modules` before it was gitignored); a killed git command leaves a stale `.git/index.lock` — check for it before assuming another process is running.
- The Bash working directory persists between commands; several path bugs in past sessions came from unknowingly running in `frontend/`.
- SQLite DB is `brainx.db` at repo root (aiosqlite + Alembic); it's gitignored and contains real session history — don't delete casually.
