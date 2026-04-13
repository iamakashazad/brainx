---
phase: 01-foundation-and-tribev2-integration
verified: 2026-04-12T00:00:00Z
status: gaps_found
score: 3/5 must-haves verified
gaps:
  - truth: "TRIBEv2 loads once at server startup and produces a (n_timesteps, ~20k vertices) cortical activation array for a test text input without crashing"
    status: partial
    reason: "TRIBEv2 loads successfully (model weights are cached in model_cache/huggingface/hub/models--facebook--tribev2). The server lifespan correctly calls load_model and raises RuntimeError to refuse startup on failure. However, the first real inference call stalls/hangs on MPS device — this was never verified end-to-end. The saved .npy files in activations/ all have shape (2, 8) from mocked API tests, not real TRIBEv2 output (~20k vertices). ROADMAP SC #1 requires an actual activation array from a test text input, which has not been confirmed."
    artifacts:
      - path: "backend/ml/tribe_loader.py"
        issue: "Load path is correct and cache is populated, but live inference hangs — no confirmed (n_timesteps, ~20k) output array exists"
      - path: "activations/"
        issue: "All .npy files have shape (2, 8) — mocked test output, not real TRIBEv2 vertex activations"
    missing:
      - "Run RUN_TRIBEV2_INTEGRATION=1 pytest tests/test_tribev2.py::TestTextPathway::test_text_pathway_produces_activation with a timeout and confirm shape[1] > 10000"
      - "Investigate MPS stall — may need torch.device('cpu') fallback or neuralset cache warm-up step"

  - truth: "Both the text narrative path and the video slideshow path return activation arrays; a differentiation test on maximally different inputs confirms the chosen path produces non-uniform maps"
    status: failed
    reason: "The differentiation gate (ROADMAP SC #2 and PLAN 03 truth) has never been evaluated with the live model. All TRIBEv2 integration tests are gated behind RUN_TRIBEV2_INTEGRATION=1 and were skipped. The differentiation test (test_text_pathway_different_inputs_different_outputs) exists in code but has not passed with real inference. DEFAULT_PATHWAY = text was left as-is without confirming differentiation."
    artifacts:
      - path: "tests/test_tribev2.py"
        issue: "5/5 integration tests skipped — differentiation gate not evaluated"
      - path: "backend/services/pathway_config.py"
        issue: "DEFAULT_PATHWAY = 'text' but differentiation gate was never run to validate this choice per D-04"
    missing:
      - "Run the differentiation gate with live TRIBEv2: RUN_TRIBEV2_INTEGRATION=1 pytest tests/test_tribev2.py::TestTextPathway::test_text_pathway_different_inputs_different_outputs -v"
      - "Record differentiation metrics (mean absolute difference, correlation) in SUMMARY"
      - "If text fails differentiation, set DEFAULT_PATHWAY = 'video' in pathway_config.py per D-04"
---

# Phase 1: Foundation and TRIBEv2 Integration — Verification Report

**Phase Goal:** TRIBEv2 runs end-to-end on a test input with a proven single-worker queue, all repo patches applied, both input paths validated, and ROI circuit labels locked in as cortical proxies
**Verified:** 2026-04-12
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | TRIBEv2 loads once at server startup and produces a `(n_timesteps, ~20k vertices)` cortical activation array for a test text input without crashing | PARTIAL | Model weights cached in `model_cache/huggingface/hub/models--facebook--tribev2`. `load_model` correctly called in lifespan. But: first real inference stalls on MPS. All saved `.npy` files have shape `(2, 8)` (mocked), not real vertex arrays. |
| 2 | Both text path and video slideshow path return activation arrays; differentiation test confirms chosen path produces non-uniform maps | FAILED | All 5 integration tests in `test_tribev2.py` are gated behind `RUN_TRIBEV2_INTEGRATION=1` and were skipped. Differentiation gate was never evaluated. `DEFAULT_PATHWAY = "text"` set without live validation. |
| 3 | `GET /model-status` and `GET /jobs/{id}` respond correctly; frontend can track queue position without websockets | VERIFIED | `test_model_status`, `test_submit_and_poll_job`, `test_missing_job_returns_404` all pass. `JobStatusResponse` includes `queue_position`, `stage`, `result`, `error`, `created_at`. |
| 4 | asyncio.Queue with single GPU worker coroutine processes one job at a time; concurrent POST requests queue without GPU OOM errors | VERIFIED | `gpu_queue: asyncio.Queue` with single `gpu_worker_loop` coroutine. `ThreadPoolExecutor(max_workers=1)` in inference service. API test `test_submit_and_poll_job` validates end-to-end job lifecycle with mocked inference. |
| 5 | All five named circuit ROI labels are mapped to cortical proxies only — no subcortical labels appear anywhere in the codebase | VERIFIED | `ROI_CIRCUIT_MAP` has exactly 5 keys: Attention, Cognitive Load, Emotional Response, Memory Encoding, Reward. `test_no_subcortical_labels_in_regions` passes. All Destrieux atlas label strings in values are cortical (e.g., `G_front_middle`, `G_orbital`, `G_insular_short`). |

**Score:** 3/5 truths verified (2 partially blocked by live inference stall)

---

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `setup_env.sh` | VERIFIED | Exists, executable. Contains `python@3.11`. Two patches applied: numpy pin (`>=2.2.6,<3`) and `requires_grad_(False)` TemporalSmoothing fix. |
| `backend/core/config.py` | VERIFIED | `class Settings(BaseSettings)` with `device`, `model_cache_path`, `database_url`. Loads `.env` via `load_dotenv()`. |
| `backend/ml/tribe_loader.py` | VERIFIED | `async def load_model(...)` exists. Imports from `tribev2.demo_utils`. Double-check lock pattern. `get_model()` raises `RuntimeError` if not loaded. |
| `backend/main.py` | VERIFIED | `async def lifespan(app)` calls `await load_model(...)` and `gpu_worker_loop()`. Raises `RuntimeError` on load failure (effective server-refuses-to-start). |
| `backend/core/queue.py` | VERIFIED | `gpu_queue: asyncio.Queue[str]`. `async def gpu_worker_loop()`. Retry logic: `for attempt in range(2)`. ERROR path sets `job.error_message`. |
| `backend/core/database.py` | VERIFIED | `create_async_engine`, `async_sessionmaker`, `async def init_db()`. |
| `backend/models/job.py` | VERIFIED | `class Job(Base)` with all required columns including `retry_count`, `input_type`, `queue_position`. |
| `backend/models/schemas.py` | VERIFIED | `TestInferenceRequest`, `TestInferenceResponse`, `JobStatusResponse` (with `queue_position: Optional[int]`), `ModelStatusResponse`. |
| `backend/routers/jobs.py` | VERIFIED | `POST /test-inference` and `GET /jobs/{job_id}` both present and wired. |
| `backend/routers/health.py` | VERIFIED | `GET /model-status` using `request.app.state.tribe_model` — correct approach via app state. |
| `backend/services/inference.py` | VERIFIED | `run_tribev2_text` and `run_tribev2_video` both present with `ThreadPoolExecutor(max_workers=1)` and `torch.inference_mode()`. |
| `backend/services/video_slideshow.py` | VERIFIED | `def create_slideshow(image_paths, durations, ...)`. Uses `moviepy.ImageClip` and `concatenate_videoclips`. |
| `backend/services/roi_aggregation.py` | VERIFIED | `ROI_CIRCUIT_MAP` with 5 cortical-only circuits. `aggregate_roi_scores`, `verify_atlas_labels`, `SUBCORTICAL_LABELS` blocklist present. |
| `backend/services/pathway_config.py` | VERIFIED | `DEFAULT_PATHWAY: str = "text"`. `get_default_pathway()` and `set_default_pathway()` present. |
| `tests/test_env.py` | VERIFIED | `test_python_version`, `test_model_loader_contract`, `test_runtime_dependencies_available` pass (7 tests). |
| `tests/test_roi.py` | VERIFIED | All 5 ROI unit tests pass: `test_five_circuits_defined`, `test_no_brodmann_codes_in_names`, `test_no_subcortical_labels_in_regions`, `test_aggregate_roi_scores`, `test_verify_atlas_labels_returns_mapping`. |
| `tests/test_api.py` | VERIFIED | All 3 API tests pass with mocked TRIBEv2: `test_model_status`, `test_submit_and_poll_job`, `test_missing_job_returns_404`. |
| `tests/test_tribev2.py` | PARTIAL | 5 integration tests exist but all skipped — gated behind `RUN_TRIBEV2_INTEGRATION=1`. Structure is correct; live execution not confirmed. |
| `activations/.gitkeep` | VERIFIED | Directory exists. `.npy` files present (from mocked API tests, shape `(2, 8)` — not real vertex arrays). |
| `requirements.txt` | VERIFIED | Contains `torch==2.6.0`, `fastapi==0.115.12`, `sqlalchemy[asyncio]==2.0.40`. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `backend/main.py` | `backend/ml/tribe_loader.py` | `await load_model(...)` in lifespan | WIRED | Line 21: `app.state.tribe_model = await load_model(settings.model_cache_path, settings.device)` |
| `backend/main.py` | `backend/core/queue.py` | `gpu_worker_loop()` started in lifespan | WIRED | Line 25: `worker_task = asyncio.create_task(queue_manager.gpu_worker_loop())` |
| `backend/routers/jobs.py` | `backend/core/queue.py` | POST handler puts job_id on `gpu_queue` | WIRED | `await queue_manager.gpu_queue.put(job.id)` |
| `backend/core/queue.py` | `backend/services/inference.py` | Worker calls `run_tribev2_text` / `run_tribev2_video` | WIRED | Lines 67–69: dispatches by `input_type` |
| `backend/core/queue.py` | `backend/core/database.py` | Worker updates job status in SQLite | WIRED | Uses `database.async_session()` throughout `_process_job` |
| `backend/core/config.py` | `.env` | `load_dotenv()` + `SettingsConfigDict(env_file=".env")` | WIRED | Both dotenv mechanisms present |
| `backend/ml/tribe_loader.py` | `tribev2` | `from tribev2.demo_utils import TribeModel` | WIRED | Import confirmed working (Plan 01 SUMMARY deviation logged and fixed) |
| `backend/services/video_slideshow.py` | `moviepy` | `from moviepy import ImageClip, concatenate_videoclips` | WIRED | Import path updated to moviepy v2 API |
| `backend/services/roi_aggregation.py` | `nilearn.datasets` | `fetch_atlas_destrieux_2009` in `get_atlas_labels()` | WIRED | Present at line 6 and in function body |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `backend/core/queue.py` | `activation` (np.ndarray) | `run_tribev2_text` / `run_tribev2_video` | Not confirmed | STATIC — inference hangs; `.npy` files saved are `(2,8)` mock arrays from test monkeypatching, never from live TRIBEv2 |
| `backend/routers/jobs.py` | `job.result_json` | SQLite via `async_session` | Yes (for mocked path) | FLOWING in tests; real data path blocked on live inference |
| `backend/services/roi_aggregation.py` | `results` dict | `mean_activation` np.ndarray input | Depends on caller | VERIFIED logic — unit tests confirm correct mapping with synthetic data |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All key modules import without error | `python -c "from backend.services.roi_aggregation import ROI_CIRCUIT_MAP; assert len(ROI_CIRCUIT_MAP) == 5"` | OK | PASS |
| Unit test suite (env + ROI + API) passes | `pytest tests/test_env.py tests/test_roi.py tests/test_api.py -v` | 15 passed in 3.02s | PASS |
| Integration tests exist but are gated | `pytest tests/test_tribev2.py -v` | 5 skipped | SKIP (by design) |
| Activation arrays from live inference are real-shaped | `numpy.load(activations/*.npy)` shape | `(2, 8)` — mocked | FAIL — not real vertex arrays |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| INFRA-01 | 01-01 | Python 3.11 + FastAPI backend with single asyncio.Queue GPU job queue | SATISFIED | Python 3.11.15 confirmed, FastAPI 0.115.12 installed, queue exists with `max_workers=1`. All `test_env.py` tests pass. |
| INFRA-02 | 01-02 | TRIBEv2 loaded once at startup via lifespan; three repo patches applied | PARTIAL | Lifespan loader present and correct. Two patches applied (numpy pin + TemporalSmoothing). REQUIREMENTS.md says "three patches"; setup_env.sh applies exactly two named patches — "any open issues" is open-ended and not clearly a third distinct patch. Load stalls on first inference. |
| INFRA-03 | 01-02 | Job status polling API for queue position without websockets | SATISFIED | `GET /jobs/{id}` returns `queue_position`, `stage`, `result`, `error`. Three API tests pass. |
| SIM-03 | 01-03 | Video slideshow fallback path — auto-activated if text signal differentiation is below threshold | PARTIAL | `create_slideshow` function exists and is correct. `set_default_pathway("video")` mechanism exists. BUT: differentiation gate was never run with live model to determine if auto-switch was needed. The "auto-activated" condition has not been evaluated. |

**Note on REQUIREMENTS.md traceability discrepancy:** REQUIREMENTS.md Traceability table maps SIM-03 to Phase 2. ROADMAP.md Phase 1 requirements explicitly lists SIM-03. The ROADMAP is the authoritative planning contract; REQUIREMENTS.md traceability table is stale. SIM-03 is correctly assigned to Phase 1 per ROADMAP.

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `activations/*.npy` (runtime) | All saved activation arrays have shape `(2, 8)` — from mock test injection, not real TRIBEv2 output | Blocker | The disk artifacts that ROADMAP SC #1 depends on have never been populated with real inference results |
| `tests/test_tribev2.py` | All 5 integration tests skipped at plan-close time | Warning | The core end-to-end validation for the phase goal is structurally complete but unexecuted |
| `backend/services/pathway_config.py` | `DEFAULT_PATHWAY = "text"` without differentiation gate validation | Warning | D-04 requires auto-switch if text path fails — the switch condition was never checked |

---

### Human Verification Required

None — all remaining gaps can be verified programmatically by running the gated integration tests.

---

## Gaps Summary

Phase 1 delivered a complete, well-wired backend infrastructure that is correct in structure and passes all unit and mocked API tests. The two gaps blocking full goal achievement both stem from the same root cause: **live TRIBEv2 inference stalls after model load on the MPS device.**

This means:

1. **ROADMAP SC #1** (TRIBEv2 produces a real `(n_timesteps, ~20k vertices)` array) cannot be confirmed — the saved `.npy` files are `(2, 8)` mock arrays from test monkeypatching, not real vertex activations.

2. **ROADMAP SC #2** (both pathways validated; differentiation gate confirms non-uniform maps; `DEFAULT_PATHWAY` set based on result) has not been run — all 5 integration tests in `test_tribev2.py` were skipped, and the differentiation gate result was never recorded.

The code is not stubbed — all inference logic, ROI aggregation, and slideshow assembly are real implementations. The gap is solely in live execution of the TRIBEv2 inference pipeline on MPS.

**Root cause to fix:** Investigate MPS inference stall in `run_tribev2_text` — likely requires one of: (a) `torch.device("cpu")` fallback, (b) neuralset/whisper cache warm-up, or (c) a dedicated GPU debugging session with `RUN_TRIBEV2_INTEGRATION=1` and full timeout logging.

**Once fixed:** Run `RUN_TRIBEV2_INTEGRATION=1 pytest tests/test_tribev2.py -v` and confirm all 5 tests pass with real activation shapes.

---

_Verified: 2026-04-12_
_Verifier: Claude (gsd-verifier)_
