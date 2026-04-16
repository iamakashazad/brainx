---
phase: 02-simulation-pipeline-and-content-input
plan: 02
subsystem: api
tags: [uploads, pillow, python-magic, fastapi, content]
requires:
  - phase: 02-00
    provides: contents table, uploads_dir setting, shared image fixtures
provides:
  - `/content/text`, `/content/screens`, and `/content/static` resource endpoints
  - Synchronous MIME/size/EXIF-safe image sanitation pipeline
  - Persisted content metadata and on-disk upload layout for later simulation jobs
affects: [analyze, simulation, testing]
tech-stack:
  added: [python-magic, Pillow]
  patterns: [uuid-only upload paths, read-once UploadFile handling, JPEG normalization]
key-files:
  created:
    - backend/services/content_processing.py
    - backend/routers/content.py
  modified:
    - backend/models/schemas.py
    - backend/main.py
    - tests/test_content_processing.py
    - tests/test_content_api.py
key-decisions:
  - "Imported python-magic lazily inside process_upload so unrelated app paths still import if the runtime dependency is missing."
  - "Stored per-file upload metadata under `meta_json.files` for later simulation and debug use."
patterns-established:
  - "All uploaded images are rewritten to JPEG and stored under UUID-only directories."
requirements-completed: [CONT-01, CONT-02, CONT-03]
duration: 1 session
completed: 2026-04-16
---

# Phase 2: Plan 02 Summary

**Content resource endpoints with MIME-sniffed, EXIF-stripped image normalization and persisted upload metadata**

## Accomplishments
- Added `/content/text`, `/content/screens`, and `/content/static`.
- Implemented the synchronous Pillow + `python-magic` processing path with MIME, size, orientation, and EXIF controls.
- Converted the Wave 0 content stubs into real unit and integration tests.

## Files Created/Modified
- `backend/services/content_processing.py` normalizes uploads into safe JPEG assets.
- `backend/routers/content.py` persists content rows and writes files under `uploads/{content_id}/`.
- `tests/test_content_processing.py` and `tests/test_content_api.py` now cover the happy path and negative cases.

## Decisions Made
- Kept content creation split across three sub-endpoints rather than multiplexing one mixed body shape.
- Preserved user filenames only in metadata; filesystem paths remain UUID-derived and server-controlled.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing host libmagic dependency**
- **Found during:** Task 1 verification
- **Issue:** Installing `python-magic` alone was insufficient because the host lacked the shared `libmagic` library.
- **Fix:** Installed the system `libmagic` package.
- **Verification:** Content processing imports and all content tests pass.

## Issues Encountered
- Wiring the content router into `main.py` surfaced the missing MIME dependency immediately, which was resolved before final verification.

## Next Phase Readiness
- Simulation jobs can now rely on persisted text or image content IDs, normalized image files, and per-upload metadata.

## Self-Check: PASSED

