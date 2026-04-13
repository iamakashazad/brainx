---
phase: 01-foundation-and-tribev2-integration
plan: 04
subsystem: ml-inference
tags: [tribev2, inference, cpu-fallback, mps-fix, authentication-gate]
dependency_graph:
  requires: [01-03]
  provides: [cpu-inference-config, mps-fallback, whisperx-cpu-fixes]
  affects: [backend/ml/tribe_loader.py, backend/core/config.py, tribev2/tribev2/eventstransforms.py]
tech_stack:
  added: []
  patterns: [mps-to-cpu-fallback, whisperx-base-on-cpu, cpu-device-default]
key_files:
  created:
    - path: patches/tribev2-eventstransforms-cpu-fixes.patch
      role: Documents CPU fixes applied to gitignored tribev2 library
  modified:
    - path: backend/core/config.py
      role: Default device changed from mps to cpu
    - path: backend/ml/tribe_loader.py
      role: MPS-to-CPU and CUDA fallback logic added
    - path: .env.example
      role: DEVICE=cpu (matches new default)
    - path: tribev2/tribev2/eventstransforms.py
      role: Whisperx base model on CPU, --align_model removed on CPU (gitignored)
decisions:
  - id: D-08-impl
    summary: "DEFAULT_PATHWAY = 'text' — live differentiation gate passed (mean abs diff 0.060519, max 0.321915)"
  - id: D-cpu-default
    summary: "device=cpu is the correct default for this machine; mps causes TRIBEv2 stalls"
  - id: D-vad-silero
    summary: "Use --vad_method silero on non-CUDA devices; pyannote VAD hits the same PyTorch 2.6 weights_only=True rejection as the alignment model"
metrics:
  duration_minutes: 40
  tasks_completed: 2
  tasks_total: 2
  files_changed: 5
  completed_date: "2026-04-13"
---

# Phase 01 Plan 04: Fix MPS Inference Stall and Run Live Integration Tests Summary

CPU device fallback implemented and committed. Both TRIBEv2 pathways proven end-to-end on CPU: video (commit `fd3fcc0`, ~17 min) and text (commit `5623890`, ~38 min first run / ~4 min warm). Text differentiation gate passed with clear signal separation. `DEFAULT_PATHWAY` confirmed as `text`.

## What Was Built

### Task 1 — Fix MPS Inference Stall (COMPLETE)

Three-part fix to unblock TRIBEv2 on Apple Silicon:

**Part A — Config defaults changed to CPU:**
- `backend/core/config.py`: `device: str = "cpu"` (was `"mps"`)
- `.env.example`: `DEVICE=cpu` (was `DEVICE=mps`)
- `.env` (gitignored): Updated at main project root for pytest discovery

**Part B — MPS-to-CPU fallback in tribe_loader.py:**
Added device validation in `_build_model` before `TribeModel.from_pretrained`:
- MPS detected: always falls back to CPU with warning (TRIBEv2 stalls on MPS per research)
- CUDA unavailable: falls back to CPU with warning
- Added `import logging` and `logger = logging.getLogger(__name__)`

**Part C — Verification:**
`python -c "from backend.core.config import settings; assert settings.device == 'cpu'"` passes.

### Task 2 — Run Live Integration Tests (PARTIAL)

**WhisperX CPU fixes applied to tribev2/tribev2/eventstransforms.py (gitignored):**

Fix 1 — Base model on CPU:
```python
if device == "mps":
    device = "cpu"
whisper_model = "large-v3" if device == "cuda" else "base"
compute_type = "float16" if device == "cuda" else "int8"
```
The `large-v3` model takes >10 minutes on CPU. The `base` model transcribes in seconds with native word-level timestamps.

Fix 2 — Remove `--align_model` on CPU:
```python
*(["--align_model", "WAV2VEC2_ASR_LARGE_LV60K_960H"] if device == "cuda" and language == "english" else []),
```
PyAnnote alignment model fails to load on PyTorch 2.6 (`weights_only=True` default) because `omegaconf.listconfig.ListConfig` is not in the safe globals allowlist.

**TSV transcript cache pre-seeded:**
WhisperX base model successfully transcribed the test input and wrote:
`model_cache/tribev2.demo_utils.TextToEvents.get_events,0/text=.../audio.tsv`
Subsequent runs skip WhisperX entirely (ExtractWordsFromAudio reads cached TSV).

**Test outcomes (final, 2026-04-13):**

| Test | Result | Notes |
|------|--------|-------|
| test_slideshow_creates_valid_mp4 | PASSED | Slideshow MP4 creates valid file |
| test_pathway_auto_switch_on_failure | PASSED | Pathway config set/get works correctly |
| test_video_pathway_produces_activation | PASSED | ~17 min on CPU; activation shape (n, >10000) confirmed (commit `fd3fcc0`) |
| test_text_pathway_produces_activation | PASSED | 38:12 on CPU first run; activation shape asserted (commit `5623890`) |
| test_text_pathway_different_inputs_different_outputs | PASSED | 4:04 warm-cache run; mean abs diff 0.060519, max abs diff 0.321915 |

**Differentiation metrics (D-04 gate):**
- Calm text: `"A serene meditation app opens with soft blue gradients. The user breathes slowly and reads each prompt in stillness."`
- Urgent text: `"FLASH SALE ENDING NOW!!! BUY NOW!!! The user feels time pressure and rushes toward the red CTA."`
- Mean absolute difference across TRIBEv2 activation means: **0.060519**
- Max absolute difference: **0.321915**
- Well above the `np.allclose(..., atol=1e-6)` tolerance → distinct activation patterns confirmed.

## Authentication Gates (resolved)

Both gates were resolved during Phase 01 Plan 04 completion:

- **Llama-3.2-3B** — `HF_TOKEN` set, license accepted, model fetched into HF hub cache during the text pathway run (first-run fetch accounted for ~23 min of the 38-min total; subsequent runs skip fetch).
- **VJEPA2 ViT-G** — download resumed and completed; video pathway test now passes in ~17 min on CPU.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] WhisperX large-v3 model too slow on CPU**
- **Found during:** Task 2, first test run
- **Issue:** tribev2's eventstransforms.py hardcoded `large-v3` whisperx model, which takes >10 minutes on CPU (test timeout was 600s)
- **Fix:** Patched `_get_transcript_from_audio` to select `base` model on CPU (immediate) vs `large-v3` on CUDA (unchanged)
- **Files modified:** `tribev2/tribev2/eventstransforms.py` (gitignored; patch documented in `patches/tribev2-eventstransforms-cpu-fixes.patch`)
- **Commit:** `6c237ea`

**2. [Rule 1 - Bug] PyAnnote alignment model incompatible with PyTorch 2.6**
- **Found during:** Task 2, first test run (after fixing Rule 1 above)
- **Issue:** `--align_model WAV2VEC2_ASR_LARGE_LV60K_960H` triggers pyannote loading via `torch.load` with `weights_only=True` (PyTorch 2.6 default). `omegaconf.listconfig.ListConfig` not in safe globals allowlist, causing `_pickle.UnpicklingError`
- **Fix:** Conditionally skip `--align_model` flag for non-CUDA inference. Base whisperx model produces native word-level timestamps without alignment
- **Files modified:** `tribev2/tribev2/eventstransforms.py` (same file as above)
- **Commit:** `6c237ea`

**3. [Rule 1 - Bug] Exca job.pkl caching failed transcript state**
- **Found during:** Task 2, between test runs
- **Issue:** After WhisperX failures, exca cached the failed state in `job.pkl`. Subsequent runs retried the failed job with same parameters (infinite retry loop)
- **Fix:** Deleted the failed `job.pkl` to clear the cache. On next run, exca re-executed and succeeded, writing a new successful `job.pkl` with 13 events
- **Files modified:** `model_cache/tribev2.demo_utils.TextToEvents.get_events,0/.../job.pkl` (gitignored)
- **Commit:** N/A (runtime cache file, gitignored)

## Decisions Made

- **DEFAULT_PATHWAY = "text" (finalized 2026-04-13):** Live differentiation gate D-04 passed. Calm vs urgent text inputs produce distinct TRIBEv2 activation patterns (mean abs diff 0.060519, max 0.321915) — well above the 1e-6 tolerance. Text pathway is the default input to TRIBEv2 inference.

- **`--vad_method silero` on non-CUDA (D-vad-silero):** After skipping `--align_model`, whisperx still unconditionally loaded the pyannote VAD checkpoint, which pickles `omegaconf.listconfig.ListConfig` and trips PyTorch 2.6's `weights_only=True` allowlist. Swapping to silero VAD (plain torch.jit archive) resolved the last CPU blocker on the text pathway.

- **device=cpu is the correct non-negotiable default for this machine:** Apple M-series MPS causes TRIBEv2 stalls. CPU is slow but correct. VJEPA2 and TRIBEv2 checkpoint loading both confirmed to work on CPU once models are downloaded.

## Known Stubs

None — no stub values were introduced. The `DEFAULT_PATHWAY: str = "text"` is a valid non-stub default that will be validated by the differentiation gate once Llama-3.2-3B access is available.

## Plan Success Criteria Status

| Criterion | Status | Notes |
|-----------|--------|-------|
| TRIBEv2 inference completes on CPU without hanging | PASSED | Video path ~17min, text path ~38min first run / ~4min warm |
| test_text_pathway_produces_activation passes with shape[1] > 10000 | PASSED | 38:12, activation shape asserted (commit 5623890) |
| test_text_pathway_different_inputs_different_outputs passes | PASSED | 4:04 warm, mean abs diff 0.060519 |
| test_video_pathway_produces_activation passes with shape[1] > 10000 | PASSED | 17min on CPU (commit fd3fcc0) |
| All 5 integration tests pass when RUN_TRIBEV2_INTEGRATION=1 | 5/5 PASSED | All pathways + pathway-switch + slideshow green |
| ROADMAP SC #1 and SC #2 are fully satisfied | SATISFIED | Video + text activations verified; differentiation confirmed |

## Commits

| Hash | Description | Task |
|------|-------------|------|
| fa6fccb | fix(01-04): change default device to CPU and add MPS fallback logic | Task 1 |
| 6c237ea | feat(01-04): document CPU fixes for tribev2 eventstransforms and test outcomes | Task 2 |
| fd3fcc0 | fix(01-04): unblock video pathway on CPU — override CUDA config, handle numpy preds | Task 3 (video) |
| 5623890 | fix(01-04): unblock text pathway on CPU — silero VAD swap | Task 3 (text) |

## Self-Check: PASSED

- [x] `backend/core/config.py` exists with `device: str = "cpu"` — CONFIRMED
- [x] `backend/ml/tribe_loader.py` has MPS fallback — CONFIRMED
- [x] `patches/tribev2-eventstransforms-cpu-fixes.patch` exists — CONFIRMED
- [x] Commits `fa6fccb` and `6c237ea` exist on `worktree-agent-ab2be836` branch — CONFIRMED
- [x] `test_slideshow_creates_valid_mp4`: PASSED (from `/tmp/test_video.txt`)
- [x] `test_pathway_auto_switch_on_failure`: PASSED (from terminal run)
