---
phase: 02-simulation-pipeline-and-content-input
plan: 04
subsystem: orchestration
tags: [queue, analyze, overlays, lifecycle, fastapi]
requires:
  - phase: 02-03
    provides: simulation and grounding services
provides:
  - Deterministic overlay derivation from simulation events
  - Five-stage worker lifecycle with legacy Phase 1 fallback
  - `/analyze` composition endpoint and end-to-end SIM-04 job results
affects: [frontend, polling-api, phase-3 pipeline]
tech-stack:
  added: []
  patterns: [centralized stage transitions, whole-dict result_json reassignment, queue-owned long-running work]
key-files:
  created:
    - backend/services/overlay.py
    - backend/routers/analyze.py
  modified:
    - backend/core/queue.py
    - backend/models/schemas.py
    - backend/main.py
    - tests/test_overlay.py
    - tests/test_queue_transitions.py
    - tests/test_analyze.py
    - tests/test_simulation_pipeline.py
key-decisions:
  - "Kept the legacy Phase 1 worker path behind a `persona is None and content is None` branch so `/test-inference` remains intact."
  - "Made stage observability a test concern by slowing patched worker calls in tests rather than adding production sleeps."
patterns-established:
  - "All job stage mutations now flow through `transition(session, job, stage)`."
  - "Phase 2 result payloads merge `simulation`, `overlays`, and `activation` under one `result_json` envelope."
requirements-completed: [SIM-02, SIM-04]
duration: 1 session
completed: 2026-04-16
---

# Phase 2: Plan 04 Summary

**Queue-owned `/analyze` flow with deterministic overlay generation, stage-level lifecycle tracking, and full simulation-plus-activation job results**

## Accomplishments
- Added deterministic hesitation/scroll overlay derivation from simulation events.
- Rewrote the GPU worker into a five-stage Phase 2 pipeline while preserving the Phase 1 inference-only path.
- Added `/analyze` and converted the remaining integration placeholders into real end-to-end tests.

## Files Created/Modified
- `backend/services/overlay.py` computes SIM-02 overlays without any LLM call.
- `backend/core/queue.py` now owns the full simulation → grounding → inference → processing lifecycle.
- `backend/routers/analyze.py` validates foreign keys, enqueues work, and returns immediately.

## Decisions Made
- Stored activation metadata for Phase 2 jobs under `result_json.activation` while preserving the legacy `activation_path` structure for old Phase 1 jobs.
- Solved stage-observability at the test layer with controlled delays instead of slowing production worker stages.

## Deviations from Plan
- None - plan executed as intended.

## Issues Encountered
- Overlay output order needed an explicit sort so the clustering result stayed deterministic and test-stable.

## Next Phase Readiness
- Phase 3 can build directly on the completed `/analyze` lifecycle and consume `result_json.simulation`, `result_json.overlays`, and saved activation arrays.

## Self-Check: PASSED

