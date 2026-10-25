---
status: awaiting_human_verify
trigger: "analyze-pipeline-errors-at-analyzing: The end-to-end analyze pipeline fails during the Analyzing stage when run from a cold start"
created: 2026-04-24
updated: 2026-04-24
---

## Current Focus

hypothesis: CONFIRMED — the `.env` file is missing `DEEPSEEK_API_KEY`, causing `deepseek_text_completion` to raise `DeepSeekClientError(SANITIZED_ERROR)` at the SIMULATION stage on every text-content job. The UAT's "Analyzing" wording was a step-indicator perception artifact, not the true failing stage.
test: Queried brainx.db directly. All 8 most-recent ERROR jobs have `error_message = "Simulation service temporarily unavailable. Please retry."` (the sanitized string from deepseek_client.py:15) — this is the exact code path triggered when the API key is empty.
expecting: Adding a valid DEEPSEEK_API_KEY (and REPLICATE_API_TOKEN for ui_screens / static uploads) to `.env` resolves the E2E run.
next_action: CHECKPOINT — need user to provide the API key(s) and confirm the fix with a fresh end-to-end run.

## Symptoms

expected: |
  Submitting /analyze (persona_id + content_id) enqueues a job that progresses through stages
  to status=DONE, so frontend transitions to Step 4 (results) and renders brain activations.
actual: |
  From cold start, job progresses Queued → Analyzing, then errors at the Analyzing stage.
  Status reaches ERROR. Frontend renders fixed UI-SPEC failure copy.
errors: |
  Frontend hides raw backend error. Backend stderr has not yet been captured;
  need to either tail uvicorn stderr or invoke the job runner directly to force the exception.
reproduction: |
  Cold start:
  1. Kill running processes, clear job cache/uploads
  2. Backend: `~/.venvs/brainx/bin/python -m uvicorn backend.main:app --reload`
  3. Frontend: `cd frontend && npm run dev`
  4. Create persona, upload content, click Analyze
  5. Job progresses to Analyzing, then errors.
started: |
  Observed 2026-04-24 during first post-Phase-4 end-to-end UAT run.
  Phases 1-3 closed; Phase 4 frontend just completed. UAT tests 2-10 & 12 pass;
  test 1 (cold-start E2E) is the blocker; tests 11, 13-16 blocked.

## Eliminated

- hypothesis: Bug is inside the TRIBEv2 inference or ROI aggregation stages.
  evidence: |
    Direct DB inspection of brainx.db proves job.stage==null on failure (cleared by
    the except block in _process_job). But error_message for all 8 recent failures is:
      "Simulation service temporarily unavailable. Please retry."
    This string is the SANITIZED_ERROR defined in backend/services/deepseek_client.py:15
    and raised on line 32 when `settings.deepseek_api_key` is empty. The failure is
    at the SIMULATION stage, NOT at INFERENCE or ROI_AGGREGATION.

    The user's claim of "failing at Analyzing" was a UI-perception artifact: the
    StageIndicator component always renders all 4 labels (Queued / Simulating / Analyzing /
    Aggregating), just highlighting the active one. Given:
      - 2000ms poll interval
      - Sub-second failure (empty-key check fires before any HTTP call)
      - Backend clears `stage` to null on failure
    …the frontend almost never sees a non-null intermediate stage for this failure path.
    The user saw the word "Analyzing" printed in the step indicator row but that wasn't
    the active stage — the active stage never progressed past "Simulating" (if at all).
  timestamp: 2026-04-24

## Evidence

- timestamp: 2026-04-24
  checked: pytest tests/test_analyze.py
  found: All 14 tests pass in 0.99s. Tests mock `run_tribev2_text`, `simulation.simulate`, `grounding.judge`, atlas.
  implication: |
    Test harness replaces three external dependencies: DeepSeek / Replicate (for simulation+grounding),
    TRIBEv2 inference (run_tribev2_text/video), and the nilearn atlas. Any of these could be the
    cold-start failure. Since stage advanced to "Analyzing", SIMULATION succeeded (which means
    DeepSeek or Replicate did work) — so the failure is most likely in TRIBEv2 inference
    or the ROI atlas path.

- timestamp: 2026-04-24
  checked: backend/core/queue.py stage transitions vs frontend/src/lib/stageLabels.ts
  found: |
    Backend stages: SIMULATION → GROUNDING_CHECK → INFERENCE → ROI_AGGREGATION → PROCESSING → RECOMMENDATIONS.
    Frontend labels:
      - "Simulating…"  = simulation | grounding_check
      - "Analyzing…" (DISPLAY_INFERRING "Running brain inference…") = inference | roi_aggregation
      - "Aggregating…"                                               = processing | recommendations
  implication: |
    User-reported failure at "Analyzing" maps to backend stage INFERENCE or ROI_AGGREGATION.
    Prime suspects: run_tribev2_text / run_tribev2_video (inference),
                    get_surf_atlas / aggregate_screen_roi / vertex-count invariant (roi_aggregation).

- timestamp: 2026-04-24
  checked: .env file contents
  found: |
    DEVICE=cpu
    MODEL_CACHE_PATH=./model_cache
    DATABASE_URL=sqlite+aiosqlite:///./brainx.db
    HF_TOKEN=... (set)
    — NO DEEPSEEK_API_KEY, NO REPLICATE_API_TOKEN
  implication: |
    Real configuration gap: the `.env` is missing both simulation-provider keys.

- timestamp: 2026-04-24
  checked: shell env (env | grep -iE deepseek|replicate)
  found: empty — neither DEEPSEEK_API_KEY nor REPLICATE_API_TOKEN are set in shell env either.
  implication: |
    When the user runs `~/.venvs/brainx/bin/python -m uvicorn backend.main:app --reload`
    from a fresh shell, pydantic-settings loads an empty string for both keys. No
    fallback source exists.

- timestamp: 2026-04-24
  checked: brainx.db — recent jobs table
  found: |
    8 most-recent ERROR jobs (all between 2026-04-24 21:04 and 21:26) have:
      status="ERROR"
      stage=null
      error_message="Simulation service temporarily unavailable. Please retry."
    All for persona_id=866283e9-... (test persona) and content_id=3ff3a0e2-... (type=text,
    "Learn AI by Building Real-World Skills" marketing copy).
  implication: |
    DEFINITIVE ROOT-CAUSE EVIDENCE. The error_message is the verbatim SANITIZED_ERROR
    constant from backend/services/deepseek_client.py:15, raised at line 32 ONLY when
    `not settings.deepseek_api_key`. This is an early-return before any HTTP call,
    which is why the failure is sub-second and never visible in stage transitions.

- timestamp: 2026-04-24
  checked: except path in backend/core/queue.py (lines 333-344)
  found: |
    All exceptions except HallucinationError / SchemaValidationFailure are caught by
    the generic `except Exception`, which sets `job.status="ERROR"` and calls
    `transition(session, job, None)` — the None clears job.stage. That explains why
    all failed jobs have stage=null despite the error originating from simulation.
  implication: |
    Secondary observation (not a bug, but notable): because stage is cleared on error,
    downstream diagnostics cannot tell from DB alone which stage raised. The error_message
    is currently the only clue — and for the DeepSeek empty-key case that message is
    sanitized (doesn't say "missing key"). Consider preserving stage on failure in a
    future pass, OR logging the original exception class/origin. Not part of THIS fix.

## Resolution

root_cause: |
  `.env` is missing DEEPSEEK_API_KEY. `backend/services/deepseek_client.py` (line 31)
  guards `if not settings.deepseek_api_key` and raises DeepSeekClientError with the
  sanitized string "Simulation service temporarily unavailable. Please retry." before
  any HTTP call. The generic `except Exception` in `backend/core/queue.py::_process_job`
  (lines 333-344) then marks the job ERROR and clears stage to null. All 8 recent
  ERROR rows in brainx.db carry exactly this sanitized error, confirming the path.

  The UAT's "Analyzing" perception was misleading — StageIndicator always renders all
  4 labels, so "Analyzing" is always visible on screen; the active-stage highlight
  never actually moves past what could be observed in a sub-second failure.

  Equivalent gap exists for UI-screens / static uploads: `REPLICATE_API_TOKEN` is
  also missing from .env, and `ReplicateVL2Backend.analyze` (vision_providers/replicate.py
  line 29) has the same empty-key guard. Text submissions fail via DeepSeek; image
  submissions would fail via Replicate.

fix: |
  Two-part fix required; first part is config-only (user-supplied), second is
  optional hardening.

  Part A (REQUIRED — config):
    Add valid keys to .env:
      DEEPSEEK_API_KEY=sk-...            # for text content pathway
      REPLICATE_API_TOKEN=r8_...         # for ui_screens / static image pathway
    Restart uvicorn so Settings() re-reads the .env.

    I cannot apply this fix myself — the user must provide the secret values.

  Part B (RECOMMENDED — hardening, optional but valuable):
    - On startup, validate required keys are non-empty and fail fast with a clear
      message, rather than letting every job fail at runtime with a sanitized string.
    - When stage is cleared on ERROR, include the failing stage name in error_message
      (or keep stage on error) to make future diagnosis faster.
    - These are improvements, not prerequisites; defer to the user.

verification:
files_changed: []
