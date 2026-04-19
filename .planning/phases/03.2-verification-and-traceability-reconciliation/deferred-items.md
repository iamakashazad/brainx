# Deferred Items

## 2026-04-19

- Out-of-scope verification failure during `03.2-01` closeout: `source ~/.venvs/brainx/bin/activate && pytest -q tests/test_personas_api.py tests/test_persona_reuse.py tests/test_content_api.py tests/test_content_processing.py tests/test_simulation_pipeline.py tests/test_simulation_dispatch.py tests/test_grounding.py tests/test_overlay.py tests/test_analyze.py tests/test_queue_transitions.py tests/test_api.py -x` failed in `tests/test_simulation_pipeline.py::test_log_viewable`.
  Current error: `ValueError: Activation vertex count 8 does not match fsaverage5 bilateral count 20484` from `backend/services/roi_aggregation.py` during `/analyze` job processing.
  This plan changed only documentation artifacts (`02-VERIFICATION.md`, `02-UAT.md`), so the runtime/test failure was logged and not fixed here.
