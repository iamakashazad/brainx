---
status: complete
phase: 02-simulation-pipeline-and-content-input
source: [02-00-SUMMARY.md, 02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-03-SUMMARY.md, 02-04-SUMMARY.md]
started: 2026-04-16T21:20:31Z
updated: 2026-04-16T21:23:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running server. Clear temp DB/uploads. Start app fresh, run migrations to head. Server boots without errors, migrations 002/003 apply, and GET /personas (or health check) returns 200 with empty list.
result: pass
verified_by: manual user confirmation

### 2. Create Persona (POST /personas)
expected: POST /personas with valid demographics/psychographics/cognitive/environment groups returns 201 with a persona_id, and the saved record round-trips the typed groups unchanged.
result: pass
verified_by: tests/test_personas_api.py::test_create_roundtrip, test_cognitive_state_persists, test_environment_persists

### 3. List Personas (GET /personas)
expected: GET /personas returns a bare JSON array (not wrapped in {personas: [...]}), includes the persona created in the previous step, and every item has the full typed structure.
result: pass
verified_by: tests/test_personas_api.py::test_list_personas

### 4. Update Persona (PATCH /personas/{id})
expected: PATCH /personas/{id} with a partial body updates only the provided JSON-column groups and returns the updated persona. Unchanged groups remain intact.
result: pass
verified_by: tests/test_personas_api.py::test_patch_persona

### 5. Delete Persona (DELETE /personas/{id})
expected: DELETE /personas/{id} returns 204 No Content (no response body). Subsequent GET /personas/{id} returns 404.
result: pass
verified_by: tests/test_personas_api.py::test_delete_persona, test_get_persona_404, test_delete_persona_rejects_referenced_jobs

### 6. Create Text Content (POST /content/text)
expected: POST /content/text with a text body returns 201 with a content_id. Record is persisted with content_type=TEXT and body retrievable via GET /content/{id} (or equivalent).
result: pass
verified_by: tests/test_content_api.py::test_text_happy

### 7. Upload Screens Content (POST /content/screens)
expected: POST /content/screens with one or more image files returns 201 with content_id. Files are stored under uploads/{content_id}/ with UUID-only filenames, and metadata.files lists each file.
result: pass
verified_by: tests/test_content_api.py::test_ui_screens_single, test_ui_screens_five, test_ui_screens_too_many, test_ui_screens_zero

### 8. Upload Static Image Content (POST /content/static)
expected: POST /content/static with a single image returns 201 with content_id. File saved under uploads/{content_id}/ as normalized JPEG with UUID-only name.
result: pass
verified_by: tests/test_content_api.py::test_static_happy

### 9. Image Sanitization (EXIF + MIME + JPEG normalization)
expected: Upload a PNG with EXIF metadata (or oriented JPEG). Stored file is JPEG, has no EXIF GPS/camera data, and orientation is baked into pixels. A file with fake extension but bad MIME is rejected with 4xx.
result: pass
verified_by: tests/test_content_processing.py::test_pillow_pipeline, test_mime_spoof_raises, test_oversize_raises, test_empty_raises; tests/test_content_api.py::test_mime_spoofing_rejected, test_oversize_rejected

### 10. /analyze End-to-End Job
expected: POST /analyze with valid persona_id + content_id returns 202 with a job_id. Polling GET /jobs/{id} shows stage progressing through queued → simulating → grounding → inferring → processing → complete, and final result_json contains simulation, overlays, and activation keys.
result: pass
verified_by: tests/test_analyze.py::test_happy_path, test_stage_transitions, test_bad_persona, test_bad_content; tests/test_queue_transitions.py::test_transition_writes; tests/test_simulation_pipeline.py::test_text_sim_happy, test_log_viewable

### 11. Deterministic Overlays from Simulation
expected: For a completed /analyze job with image content, result_json.overlays contains hesitation/scroll overlays derived from simulation events, sorted deterministically (same job re-run produces identical overlay order).
result: pass
verified_by: tests/test_overlay.py::test_deterministic, test_hesitation_clustering, test_scroll_path_order, test_text_no_scroll

### 12. Grounding Failsafe (Zero-Tolerance Hallucination)
expected: A simulation output containing references to entities not present in the source content causes the job to fail (or surface a grounding error) with no retry attempted. Job stage reflects the failure rather than silently passing.
result: pass
verified_by: tests/test_grounding.py::test_hallucination_fails_fast, test_provider_errors_fail_closed, test_clean_passes_through; tests/test_analyze.py::test_failure_policy_grounding_no_retry, test_failure_policy_simulation_retry, test_failure_policy_processing_fail_hard

### 13. Persona Reuse Across Jobs
expected: One saved persona_id can be attached to multiple /analyze jobs. Each job succeeds independently and references the same persona without duplicating it.
result: pass
verified_by: tests/test_persona_reuse.py::test_persona_reused_across_jobs

### 14. Phase 1 /test-inference Backwards Compatibility
expected: The legacy /test-inference endpoint (no persona, no content) still accepts requests and returns a valid Phase 1-style response. New job FK columns remain nullable and do not break the old path.
result: pass
verified_by: tests/test_api.py::test_model_status, test_submit_and_poll_job, test_missing_job_returns_404

## Summary

total: 14
passed: 14
issues: 0
pending: 0
skipped: 0
blocked: 0

automated_run: 48 pytest cases passed in 1.19s (persona/content/analyze/queue/simulation/overlay/grounding/dispatch/api)

## Gaps

[none — all 14 UAT items verified]
