---
phase: 02-simulation-pipeline-and-content-input
plan: 00
subsystem: foundation
tags: [alembic, sqlalchemy, settings, pytest]
requires: []
provides:
  - Phase 2 schema foundation with personas, contents, and job foreign keys
  - Settings and dependency additions for DeepSeek, Replicate, uploads, and respx-backed tests
  - Collectable Phase 2 test scaffolding shared across persona, content, simulation, and analyze flows
affects: [api, database, testing, simulation]
tech-stack:
  added: [python-magic, aiofiles, openai, replicate, respx]
  patterns: [alembic migration ladder, JSON-column persona/content models, shared async test fixture layer]
key-files:
  created:
    - alembic/versions/002_create_personas_and_contents.py
    - alembic/versions/003_add_job_fks.py
    - backend/models/persona.py
    - backend/models/content.py
    - backend/requirements.txt
  modified:
    - backend/models/job.py
    - backend/core/config.py
    - tests/conftest.py
    - tests/test_api.py
    - pytest.ini
key-decisions:
  - "Kept the repo-root requirements file as the active install surface and added backend/requirements.txt as a phase-compatible mirror."
  - "Moved the reusable AsyncClient/database fixture into tests/conftest.py so all Phase 2 integration tests share one setup path."
patterns-established:
  - "StageEnum and nullable persona/content FKs extend the existing Job model without breaking the Phase 1 inference path."
  - "Pytest discovery is constrained to tests/ so vendored upstream packages do not pollute the project suite."
requirements-completed: [SIM-01, CONT-01, PERS-01, PERS-04]
duration: 1 session
completed: 2026-04-16
---

# Phase 2: Plan 00 Summary

**Phase 2 foundation with additive schema migrations, DeepSeek-ready settings, and a shared async pytest harness for all downstream plans**

## Accomplishments
- Added personas/contents tables plus nullable `jobs.persona_id` and `jobs.content_id` foreign keys.
- Extended settings and dependency declarations for uploads, DeepSeek, Replicate, and respx-backed service tests.
- Replaced the Wave 0 skips with a reusable fixture layer and collectable Phase 2 test files.

## Files Created/Modified
- `backend/models/persona.py` and `backend/models/content.py` introduce the reusable resource models.
- `alembic/versions/002_create_personas_and_contents.py` and `003_add_job_fks.py` establish the migration chain.
- `tests/conftest.py` centralizes the app/database/client fixture setup used across the new test suite.

## Decisions Made
- Added `pytest.ini:testpaths = tests` to keep upstream vendored tests out of the BrainX suite.
- Kept the Phase 1 `/test-inference` path untouched by making the new job foreign keys nullable.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Dependency file path mismatch**
- **Found during:** Task 1
- **Issue:** The repo used `requirements.txt` at the root, but the plan expected `backend/requirements.txt`.
- **Fix:** Updated the root file and created `backend/requirements.txt` as a mirrored phase-compatible entrypoint.
- **Verification:** Dependency install completed from `backend/requirements.txt`; app and tests import cleanly.

**2. [Rule 3 - Blocking] Full-suite pytest collection pulled vendored tribev2 tests**
- **Found during:** Final verification
- **Issue:** `pytest -q` collected an upstream `tribev2` test module outside the project suite and failed before BrainX tests finished.
- **Fix:** Added `testpaths = tests` to `pytest.ini`.
- **Verification:** Full project suite now runs green under `pytest -x -q`.

## Issues Encountered
- `python-magic` required both the Python package and the host `libmagic` library; both were installed before content-path verification.

## Next Phase Readiness
- Phase 2 application plans can now assume stable persona/content tables, upload configuration, and a reusable async test harness.

## Self-Check: PASSED

