---
phase: 02-simulation-pipeline-and-content-input
artifact: review
status: addressed
depth: standard
reviewed: 2026-04-16
resolved: 2026-04-16
severity_counts:
  critical: 0
  high: 0
  medium: 3
  low: 0
files_reviewed:
  - backend/services/vision_providers/replicate.py
  - backend/services/simulation.py
  - backend/services/grounding.py
  - backend/core/database.py
  - backend/routers/personas.py
  - backend/core/queue.py
  - alembic/versions/003_add_job_fks.py
  - tests/test_simulation_pipeline.py
  - tests/test_grounding.py
  - tests/test_personas_api.py
  - tests/test_analyze.py
---

# Phase 02 Code Review

Reviewed at `standard` depth against the scoped Phase 2 files.

## Resolved Findings

### Medium - VL2 malformed JSON bypasses the required repair retry

- Fixed in [backend/services/vision_providers/replicate.py](backend/services/vision_providers/replicate.py:20) and [backend/services/simulation.py](backend/services/simulation.py:74) by preserving raw provider text and validating it in the simulation layer.
- Result: malformed VL2 JSON now triggers the required `Previous attempt failed validation` repair prompt instead of failing on the first response.

### Medium - Grounding fail-safe does not catch all provider and file errors

- Fixed in [backend/services/vision_providers/replicate.py](backend/services/vision_providers/replicate.py:39) and [backend/services/grounding.py](backend/services/grounding.py:45) by moving file reads inside the protected provider block and treating provider/file failures as conservative grounding failures.
- Result: missing upload files or provider-side errors now collapse into `HallucinationError([])` rather than surfacing as generic worker failures.

### Medium - Referential integrity for `persona_id` / `content_id` is not actually enforced in SQLite, so queued jobs can become invalid

- Fixed in [backend/core/database.py](backend/core/database.py:12), [backend/routers/personas.py](backend/routers/personas.py:86), and [backend/core/queue.py](backend/core/queue.py:92) by enabling SQLite foreign keys globally, returning `409 Conflict` on referenced persona deletes, and failing any orphaned Phase 2 jobs explicitly.
- Result: local/dev/test SQLite now enforces the same foreign-key expectations as the rest of the stack, and the worker no longer proceeds with missing linked rows.

## Resolution

- `backend/services/vision_providers/replicate.py`, `backend/services/simulation.py`, and `backend/services/grounding.py` now keep raw provider text available for caller-side validation, so malformed VL2 JSON reaches the intended repair loop and grounding still fails closed on provider/file errors.
- `backend/core/database.py` now enables SQLite `PRAGMA foreign_keys=ON` for every engine connection, `backend/routers/personas.py` returns `409 Conflict` for referenced personas, and `backend/core/queue.py` fails orphaned Phase 2 jobs cleanly if linked rows are ever missing.
- Added regressions in `tests/test_simulation_pipeline.py`, `tests/test_grounding.py`, and `tests/test_personas_api.py` covering the three review findings directly.

## Verification

- `pytest tests/test_simulation_pipeline.py tests/test_grounding.py tests/test_personas_api.py tests/test_analyze.py -x -q`
- `ruff check backend tests`
- `pytest -x -q`
