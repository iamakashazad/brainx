---
phase: 02-simulation-pipeline-and-content-input
plan: 03
subsystem: simulation
tags: [deepseek, replicate, respx, grounding, pydantic]
requires:
  - phase: 02-01
    provides: persona resource model
  - phase: 02-02
    provides: content resource model and upload layout
provides:
  - Typed simulation and grounding models
  - DeepSeek JSON-mode client with repair-once validation retry
  - Vision-provider dispatch and zero-tolerance grounding gate
affects: [queue, analyze, results]
tech-stack:
  added: [openai, replicate, respx]
  patterns: [repair-once JSON validation, vision provider abstraction, prompt-injection delimitering]
key-files:
  created:
    - backend/models/simulation.py
    - backend/services/deepseek_client.py
    - backend/services/simulation.py
    - backend/services/grounding.py
    - backend/services/vision_providers/base.py
    - backend/services/vision_providers/replicate.py
  modified:
    - tests/test_simulation_dispatch.py
    - tests/test_simulation_pipeline.py
    - tests/test_grounding.py
key-decisions:
  - "Implemented the DeepSeek facade over direct HTTP so the request contract is explicit and easy to verify with respx."
  - "Used the same repair-once pattern for both text and vision simulation outputs."
patterns-established:
  - "User text is always wrapped inside a literal `BEGIN USER CONTENT` data block before simulation."
  - "Grounding failures are fail-safe and zero-tolerance; no retry path exists after hallucination detection."
requirements-completed: [SIM-01, SIM-04]
duration: 1 session
completed: 2026-04-16
---

# Phase 2: Plan 03 Summary

**DeepSeek-validated simulation logs with text/vision dispatch, repair-once schema retry, and a zero-tolerance grounding judge**

## Accomplishments
- Added the typed simulation and grounding schemas plus their domain exceptions.
- Implemented the DeepSeek text client, Replicate-based vision provider, and content-type simulation dispatcher.
- Replaced the Wave 0 simulation/grounding skips with real respx-backed service tests.

## Files Created/Modified
- `backend/services/deepseek_client.py` owns JSON-mode DeepSeek calls and repair-once validation handling.
- `backend/services/simulation.py` dispatches TEXT to DeepSeek and image content to the vision provider.
- `backend/services/grounding.py` enforces the zero-tolerance hallucination gate.

## Decisions Made
- Kept network error messages sanitized so neither DeepSeek nor Replicate credentials leak into client-visible errors.
- Left `test_log_viewable` for the next plan because it depends on worker and `/analyze` integration rather than the standalone simulation service.

## Deviations from Plan
- None - plan executed as intended.

## Issues Encountered
- None beyond normal request-shape tuning in the service tests.

## Next Phase Readiness
- The worker can now call `simulation.simulate()` and `grounding.judge()` as stable building blocks for the full phase pipeline.

## Self-Check: PASSED

