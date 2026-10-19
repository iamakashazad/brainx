---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Remediation pass complete — worker resilience, executor recycle, frontend terminal states, honest error messages, Replicate endpoint fix, stale sweeper, docs reconciled
last_updated: "2026-07-16T00:00:00.000Z"
progress:
  total_phases: 7
  completed_phases: 7
  total_plans: 27
  completed_plans: 27
  percent: 100
---

# Project State — BrainX

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-20)

**Core value:** The only tool that simulates real-world usage context before measuring brain response — not a heatmap, not contrast checking.
**Current focus:** Phase 05 — session-persistence-demo-and-polish

## Current Position

Phase: 05 (session-persistence-demo-and-polish) — EXECUTING
Plan: 1 of 3
Status: Executing Phase 05

## Progress

Progress: ████████░░ 85% of roadmap plans complete (23/27)

Initialization checklist:

- ✓ PROJECT.md written
- ✓ config.json written
- ✓ Git initialized
- ✓ REQUIREMENTS.md written
- ✓ ROADMAP.md written
- ✓ Phase 1 complete
- ✓ Phase 2 complete
- ✓ Phase 3 complete

## Recent Decisions

- Used `backend/routers/analyze.py` and `tests/test_analyze.py::test_analyze_keeps_text_path_for_text_content_when_video_is_default` as the source of truth for the Phase 2 `/analyze` response code (original `test_happy_path` reference deleted with the test; replacement tests are green per 03.2-04).
- Kept `02-VERIFICATION.md` bounded to the ten Phase 2 requirements so later-phase behaviors were not overclaimed.
- Rebuilt `01-VERIFICATION.md` from current CPU-first runtime evidence and the later `01-04` and `03.1` closure artifacts instead of preserving the superseded blocker verdict.
- Updated `REQUIREMENTS.md` to map backend requirements to their owning verified phases with `Satisfied` status.
- Re-ran the milestone audit against `01-VERIFICATION.md`, `02-VERIFICATION.md`, `03-VERIFICATION.md`, and `03.1-VERIFICATION.md`, producing a passed backend-milestone closure artifact.
- Repaired the `test_log_viewable` regression in 03.2-04 by patching fsaverage5-compatible inference shape and synthetic atlas in the test harness; no backend code change required.
- Reconciled `PROJECT.md`, `STATE.md`, and `v1.0-MILESTONE-AUDIT.md` so the backend milestone closure narrative now points at the repaired 03.2-04 evidence chain without changing `ROADMAP.md`.
- YOLO mode (auto-approve)
- Parallel plan execution
- The backend milestone is closed; the next major workstream is the Phase 4 frontend built on the now-stable backend contract.
- Phase 04-01 is complete: the React/Vite frontend shell, persona flow, content upload flow, and analyze kickoff are now in place with passing typecheck and Vitest coverage.
- Phase 04-02 is complete: job-stage translation, polling, queue state, non-dismissable progress UI, and refresh rehydration are now implemented and verified.
- 2026-08-14: Root-caused the recurring `whisperx failed (returncode=-15)` inference failures. NOT a flaky external tool: `backend/ml/tribe_loader.py` sets `HOME=model_cache` process-wide, which leaked into the `uvx whisperx` child. uv resolves managed interpreters from `$HOME/.local/share/uv/python`, so with HOME repointed it fell back to the Xcode CommandLineTools Python 3.9.6, forcing source builds of several deps that hang holding the uv cache lock and die under memory pressure. Verified by A/B on the exact failing audio: real HOME → 1m15s OK; HOME=model_cache → hung >6min with zero output; real HOME + HF_HOME preserved → ~93s OK. Fix restores the real HOME (read from the password database) for the child only; documented as Change 4 in `patches/tribev2-eventstransforms-cpu-fixes.patch`. Also explains why failures never correlated with content length — only COLD runs pay the build cost; runs reusing an `audio.tsv` sidecar skip whisperx entirely.
- 2026-08-14: Hardened the same call site — explicit `timeout=` (`BRAINX_WHISPERX_TIMEOUT`, default 900s), no retry on negative returncodes (a signal death is not the cold-start flake the retry targeted; three nested layers could reach ~12 invocations per screen), and error text that names the signal and includes the stdout tail.
- 2026-08-14: Fixed a systemic silent-failure class. `frontend/src/lib/api.ts` discarded the server's `detail` in three places (`deletePersona`, `deleteJob`, `suggestPersonaField`), so upload rejections, AI-suggest failures, and persona-delete 409s all rendered as nothing. Now routed through a shared `detailFrom`/`apiErrorFrom` helper that also handles FastAPI's array-shaped 422 detail. Errors surfaced in both uploaders, TextInput, PersonaForm, and PersonasPage; client upload cap corrected 10MB → 5MB to match `MAX_INPUT_BYTES`; `/personas/ai-suggest` now returns 422 (missing key) / 502 (provider or schema failure) instead of a bare 500, with 5 new tests where it previously had zero.
- 2026-08-14: Fixed the wizard submitting content the user could not see. `contentId` had no clear path except full `reset()`. Added `clearContent()`, made the content-type tabs controlled and clearing on change, gated submit on `contentType` matching the visible tab (it was stored but never read), and stopped persisting `contentId`/`contentType` (store `version: 1` + migrate, so pre-existing localStorage cannot rehydrate them once). Also re-uploads the remaining screens when one is removed, and fixed a pre-existing effect that revoked every preview URL on each `files` change (removing one screen blanked the others). Browser-verified: cross-tab and post-reload both leave "Run Analysis" disabled.
- 2026-10-19: Full review pass (diff + backend + frontend), fixes verified by tests that fail without them. Backend: stale PENDING jobs are now flipped by compare-and-set and removed from `gpu_queue` (`fail_stale_pending_job`), and `_process_job` claims with `UPDATE … WHERE status='PENDING'` — previously a job the UI was told had timed out was still run to DONE and its ghost entry counted toward the 503 cap; `_mark_timed_out` guarded like `_mark_failed`; interrupted/legacy failures keep `job.stage`; cancel's pgrep/rmtree moved off the loop and out of `queue_capacity_lock`; recommendation evidence snaps to the cited screen/circuit/region instead of any score in the bundle; uploads decode via `asyncio.to_thread`, read at most cap+1 bytes, and refuse >50 MP before decoding (was effectively 2 GP); `SimulationLog` renumbers 1-based screens and rejects duplicates/gaps; provider errors keep a truncated, secret-scrubbed response body (`services/http_errors.py`); legacy-result activations 404 instead of 500; all-negative circuit peaks no longer clip to 0; inference temp file created inside the executor task; AI-suggest enum fields normalised/validated against the persona `Literal`s. Frontend: upload mutations clear content on start and ignore stale completions (`discardContent` + generation counter) — fixes a late/failed upload re-enabling "Run Analysis" on content no longer shown; polling watchdog counts *consecutive* failures (was lifetime `errorUpdateCount`) and the failure card waits for polling to stop (no flashing); connection loss shows its real message and "Try Again" refetches instead of submitting a duplicate job; all submit/persona-save/stop/persona-load errors rendered; screen index clamped per job before fetching activations; ErrorBoundary around the R3F canvas and the routes; "Analyze" reachable by keyboard; shared-result links distinguish running/failed/not-found; static-preview blob URL revoked on unmount.

## Blockers / Concerns

- Phase 4 UAT tests 11, 13-16 still need a human browser pass. Test 1 (cold-start E2E) is closed again as of 2026-08-14 (job d87a0bc4 DONE).
- `backend/services/process_guard.py::cleanup_workspace_whisperx_processes` matches on `pgrep -f whisperx`, so it cannot distinguish a live child from a stale one, and its `keep_tokens` guard is passed by no caller. All three call sites are safe only by *timing* (documented inline, and kills are now logged). Any new call site that can overlap a live transcription must pass `keep_tokens`.
- Machine resource pressure materially affects cold inference: observed ~95% swap used with ~300MB free RAM on an 18GB machine. Not a code bug, but it makes cold `uv` builds slow and kill-prone.
- Phase 5 human browser UAT checks (4) remain pending — .planning/phases/05-session-persistence-demo-and-polish/05-HUMAN-UAT.md
- Image-content path was never live-verified; the Replicate call previously used the wrong endpoint shape (fixed 2026-07-16) and needs one smoke test with a real token
- Multi-screen image content only sends screen 1 to the vision model (`vision_providers/replicate.py` uses `encoded_images[0]`; deepseek-vl2 takes one `image`). Simulation then invents screens 2+ and grounding checks them against screen 1. Needs a design decision (per-screen calls vs. a labelled contact sheet) plus a live Replicate smoke test.
- pytest writes fake artifacts into the real `activations/` directory (`Path("activations")` is relative and conftest never redirects it).

## Session Continuity

Last session: 2026-10-19
Stopped at (2026-10-19): Review + fix pass (see Recent Decisions). Backend 187 passed / 6 skipped (+14 tests), ruff clean (was 18 errors); frontend 94 passed / 26 files (+10 tests), `tsc -b --force` and build clean. Live headless E2E job 5e493acb reached DONE in 908s (slow only because the machine was ~16GB into swap; the backend stopped answering HTTP for minutes while paged out) with 4 recommendations, each citing a score that exists in its own cited region. Browser-verified against the real backend: shared-link running/failed/not-found states, results page + activation fetch, text save→edit→tab-switch gating, persona-delete 409 reason. Still uncommitted.
Previous (2026-08-14): Fixed the whisperx `returncode=-15` root cause (HOME leak into uvx → Python 3.9.6 fallback), then the silent-failure class, then the wizard stale-content bug. Green cold-start headless E2E: job d87a0bc4 reached DONE in 17 min on a fresh one-sentence text with zero whisperx errors. Backend 173 passed / 6 skipped (+5 new ai-suggest tests), frontend 84 passed across 23 files (+8 new), `tsc -b --force` and `npm run build` clean. Browser-verified in Playwright: persona-delete 409 now renders its reason; cross-tab and post-reload both leave "Run Analysis" disabled. Nothing committed — 15 modified + 1 new test file in the working tree.
Resume file: .planning/phases/05-session-persistence-demo-and-polish/05-HUMAN-UAT.md

Remaining from the 2026-08-14 audit plan (unstarted): persona archive/edit UI + templates (backend PATCH/DELETE already exist and are tested; needs `archived_at` migration, an edit form, seed templates, and a persona snapshot for result provenance); dead camera-preset UI and unreachable components (`PersonaLibrary`, `PersonaCard`, `PersonaTabProgress`, `BrainPresetButtons`); tooling hygiene (`npx playwright install chromium` — cache has 1208/1228 but `browsers.json` pins 1217; 5 of 8 E2E selectors stale; `npm audit fix` for react-router 7.14.2 → 7.18.2 within the existing caret; `package.json` typecheck should be `tsc -b --force`). Deliberately out of scope: queue-capacity rename (not a bug), black reformat of 42 files (no config exists and nothing enforces it), and ruff's 12 `F811` (false positives whose autofix would break the tests — the real fix is deleting two redundant fixture imports).
