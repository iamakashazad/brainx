# Phase 1: Foundation and TRIBEv2 Integration - Research

**Researched:** 2026-04-08
**Domain:** TRIBEv2 GPU inference, FastAPI async architecture, SQLite job registry, conda environment setup, ROI cortical-proxy mapping
**Confidence:** MEDIUM-HIGH (stack HIGH, GPU/MPS environment LOW — see critical finding below)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Build text narrative path (gTTS) first as primary target. Simpler to validate and needed for text-only content (CONT-03) regardless of differentiation outcome.
- **D-02:** Build video slideshow path (moviepy MP4) alongside text in Phase 1. Both paths must exist before Phase 1 completes — video is the SIM-03 fallback and provides a backup if text fails differentiation.
- **D-03:** Differentiation gate uses visual inspection — generate activation maps for two maximally different inputs (e.g., calm meditation text vs urgent sale CTA) and visually confirm the maps look different. No statistical threshold required.
- **D-04:** If text path fails visual inspection, auto-switch to video slideshow as the default path. Text path remains available for future re-evaluation but is not shipped as primary.
- **D-05:** Minimal test-only endpoints for Phase 1: `POST /test-inference` (submit test input), `GET /jobs/{id}` (poll status/result), `GET /model-status` (health check). No `/analyze` endpoint yet.
- **D-06:** Simple 3-stage job lifecycle: PENDING → RUNNING → DONE/ERROR. Schema supports adding stages without breaking existing jobs.
- **D-07:** GPU failures (OOM, CUDA errors) retry once, then transition job to ERROR with descriptive message.
- **D-08:** If TRIBEv2 fails to load at server startup (lifespan), the server refuses to start and exits with a clear error message. No degraded mode.
- **D-09:** No job timeout in Phase 1. Inference runs as long as needed to establish baseline latency.
- **D-10:** Consumer-friendly circuit names used everywhere from day one: "Attention", "Cognitive Load", "Emotional Response", "Memory Encoding", "Reward". No Brodmann codes or anatomical terms in any API response, code constant, or UI label.
- **D-11:** Cortical proxy mappings (5 circuits → Destrieux atlas regions) are hardcoded in the ROI aggregation module. If Meta releases a subcortical checkpoint (Issue #23), it's a code change — no config layer needed.

### Claude's Discretion

- Exact conda environment setup and TRIBEv2 patching sequence
- SQLite schema design for job registry
- Test input selection for differentiation gate
- Internal code organization and module structure

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFRA-01 | Python 3.11 + FastAPI backend with single asyncio.Queue GPU job queue (uvicorn --workers 1 mandatory) | Confirmed queue pattern, lifespan loading, worker coroutine design; environment setup path documented below |
| INFRA-02 | TRIBEv2 loaded once at server startup via FastAPI lifespan; three repo patches applied at clone time (numpy pin, TemporalSmoothing, and any open issues) | Both patches confirmed from GitHub Issues #5 and #6; load_model in executor pattern documented |
| INFRA-03 | Job status polling API so frontend can display queue position and progress without websockets | GET /jobs/{id} shape, 3-stage lifecycle, SQLite schema guidance all documented |
| SIM-03 | System supports a video slideshow fallback path — auto-activated if text pathway signal differentiation is below threshold | moviepy MP4 path construction documented; differentiation gate procedure documented |
</phase_requirements>

---

## Summary

Phase 1 establishes the entire backend skeleton from a cold start: conda environment, TRIBEv2 with patches applied, FastAPI lifespan model loading, asyncio.Queue with a single GPU worker, SQLite job registry, test-only inference endpoints, both input pathways (text gTTS + video slideshow), and the ROI cortical-proxy label schema. Nothing carries over from prior phases — this is greenfield.

**Critical environment finding:** The development machine is Apple Silicon M3 Pro with MPS backend (Metal), not a CUDA/NVIDIA GPU. TRIBEv2's `demo_utils.py` only auto-detects `cuda` or falls back to `cpu` — it does NOT auto-detect MPS. However, the `device` parameter accepts an explicit string, so passing `device="mps"` is possible. Whether TRIBEv2 runs correctly on MPS is empirically unverified — Wav2Vec-BERT and V-JEPA2 may have MPS-incompatible ops. Additionally, TRIBEv2 pins `torch>=2.5.1,<2.7`, but PyTorch 2.8.0 is the only version currently installed on the machine (via pip for Python 3.9). The environment needs a complete reset: Python 3.11 via Homebrew + venv, fresh PyTorch 2.6.0 install.

**Primary recommendation:** Install Python 3.11 from Homebrew (formula is present but not installed), create a venv (conda is not available), install PyTorch 2.6.0 with the MPS-capable wheel (no CUDA wheel on Apple Silicon), clone TRIBEv2 and apply both patches, then test whether TRIBEv2 inference actually runs on `device="mps"`. If MPS fails, fall back to CPU — slow but functional for Phase 1 smoke tests.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Python | 3.11 | Backend runtime | TRIBEv2 pyproject.toml requires `>=3.11`. Not negotiable. |
| FastAPI | 0.115.x | REST API framework | Async-native ML serving. Built-in CORSMiddleware, Pydantic v2, OpenAPI. |
| PyTorch | 2.6.0 | TRIBEv2 model runtime | TRIBEv2 pins `torch>=2.5.1,<2.7`. 2.6.0 is the safe choice. |
| tribev2 | GitHub main | Brain prediction model | Core model. Install with `pip install -e ".[plotting]"` after patch. |
| uvicorn | 0.34.x | ASGI server | `uvicorn --workers 1` mandatory — multiple workers duplicate GPU memory. |
| pydantic | v2.x | Request/response validation | Bundled with FastAPI. |
| SQLAlchemy | 2.0.x | Async ORM | Async sessions via aiosqlite. Do NOT use SQLModel — targets SA 1.4.x. |
| aiosqlite | 0.20.x | Async SQLite driver | Zero-config local storage. `sqlite+aiosqlite://` async dialect. |
| nilearn | 0.11.x | ROI atlas lookup | Destrieux atlas → cortical vertex-to-region mapping. Included in TRIBEv2 `[plotting]` extras. |
| moviepy | latest | Video slideshow path | MP4 assembly for the SIM-03 fallback. Already in TRIBEv2 dependencies. |
| gTTS | latest | Text-to-speech (text path) | Used internally by TRIBEv2 for text input — not called directly. |
| python-dotenv | 1.x | Environment config | API keys, model cache path, device selection out of code. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| numpy | >=2.2.6,<3 | Array operations | Activation array processing. Pin must be patched in TRIBEv2 pyproject.toml. |
| scipy | 1.14.x | Signal aggregation | mean/peak activation across timesteps. Pulled in by nilearn. |
| alembic | 1.14.x | DB migrations | Use from day one so schema changes don't require manual SQLite surgery. |
| pytest | latest | Testing | Standard. `pytest-asyncio` for async route tests. |
| httpx | 0.27.x | Async test client | `httpx.AsyncClient(app=app)` for testing FastAPI async routes. |
| ruff | latest | Linting | Replaces flake8 + isort in one tool. |
| black | latest | Formatting | Enforced, no config needed. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| asyncio.Queue + ThreadPoolExecutor | FastAPI BackgroundTasks | BackgroundTasks has no serialization guarantee — two concurrent requests race for VRAM. Never use for GPU jobs. |
| asyncio.Queue | Celery + Redis | Celery doesn't support asyncio natively; requires separate broker; massive overhead for single-GPU local tool. |
| aiosqlite (SQLite) | asyncpg + PostgreSQL | PostgreSQL when multi-user or deployed. SQLite is zero-config and sufficient for single researcher v1. |
| venv | conda | conda not installed on target machine. venv with Homebrew Python 3.11 achieves the same isolation. |
| MPS device | CPU | CPU is 10-50x slower for TRIBEv2. MPS should be attempted first; CPU is the verified-working fallback. |

### Installation (Apple Silicon — No CUDA)

```bash
# 1. Install Python 3.11 via Homebrew (formula exists, not yet installed)
brew install python@3.11

# 2. Create isolated venv
/opt/homebrew/opt/python@3.11/bin/python3.11 -m venv ~/.venvs/brainx
source ~/.venvs/brainx/bin/activate

# 3. Install PyTorch 2.6.0 — Apple Silicon CPU+MPS wheel (no CUDA wheel on arm64)
pip install torch==2.6.0 torchvision==0.21.0

# 4. Clone TRIBEv2 and apply patches BEFORE installing
git clone https://github.com/facebookresearch/tribev2.git
cd tribev2

# Patch 1: numpy exact pin (Issue #6)
sed -i '' 's/"numpy==2.2.6"/"numpy>=2.2.6,<3"/' pyproject.toml

# Patch 2: TemporalSmoothing requires_grad_ bug (Issue #5)
# In tribev2/model.py: change `conv.requires_grad = False` to `conv.requires_grad_(False)`
# (apply manually or with sed — exact line location must be confirmed)

# 5. Install TRIBEv2 with plotting extras (nilearn, pyvista, etc.)
pip install -e ".[plotting]"
cd ..

# 6. Install backend dependencies
pip install "fastapi==0.115.*" "uvicorn[standard]" pydantic python-dotenv
pip install "sqlalchemy[asyncio]" aiosqlite alembic python-multipart
pip install scipy ruff black pytest pytest-asyncio httpx moviepy
```

**Version verification note:** FastAPI 0.115.x was the latest stable as of research date. The STACK.md referenced 0.135.x which may be a future projection — confirm with `pip index versions fastapi` before pinning. [ASSUMED: 0.115.x is current stable; verify at install time]

---

## Architecture Patterns

### Recommended Project Structure

```
brainx/
├── backend/
│   ├── main.py                    # FastAPI app, lifespan, CORS, router mounts
│   ├── core/
│   │   ├── config.py              # Settings (python-dotenv), device, paths
│   │   ├── queue.py               # asyncio.Queue, gpu_executor, gpu_worker_loop
│   │   └── database.py            # SQLAlchemy async engine, session factory
│   ├── models/
│   │   ├── job.py                 # Job ORM model (id, status, result_json, created_at)
│   │   └── schemas.py             # Pydantic request/response schemas
│   ├── services/
│   │   ├── inference.py           # TRIBEv2 wrapper: text_path/video_path → activation array
│   │   └── roi_aggregation.py     # nilearn: vertex array → per-ROI stats dict
│   ├── routers/
│   │   ├── jobs.py                # POST /test-inference, GET /jobs/{id}
│   │   └── health.py              # GET /model-status
│   └── ml/
│       └── tribe_loader.py        # TribeModel singleton, from_pretrained
│
├── tribev2/                       # cloned from GitHub (gitignored from tracking)
├── model_cache/                   # TRIBEv2 weights (gitignored, ~10GB)
├── .env                           # MODEL_CACHE_PATH, DEVICE (mps/cpu)
├── requirements.txt
└── alembic.ini
```

### Pattern 1: FastAPI Lifespan Model Loading (Singleton)

**What:** TRIBEv2 loads exactly once during server startup via the FastAPI lifespan context manager. All requests share the same in-memory model instance via `app.state`.

**When to use:** Any ML model taking >5s to load. TRIBEv2 takes 30-60s on first run, ~5-10s with cached weights.

**Example:**
```python
# backend/ml/tribe_loader.py
# Source: ARCHITECTURE.md (project research)
from tribev2 import TribeModel
import asyncio, os

_model: TribeModel | None = None

async def load_model(cache_folder: str, device: str) -> TribeModel:
    global _model
    loop = asyncio.get_event_loop()
    _model = await loop.run_in_executor(
        None,
        lambda: TribeModel.from_pretrained(
            "facebook/tribev2",
            cache_folder=cache_folder,
            device=device  # pass "mps" explicitly — TRIBEv2 only auto-detects "cuda"
        )
    )
    _model.eval()  # CRITICAL: must call eval() — BatchNorm/Dropout differ in train mode
    return _model

def get_model() -> TribeModel:
    if _model is None:
        raise RuntimeError("Model not loaded")
    return _model
```

```python
# backend/main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI
from backend.ml.tribe_loader import load_model
from backend.core.queue import gpu_worker_loop
from backend.core.config import settings
import asyncio, sys

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        app.state.tribe_model = await load_model(
            settings.model_cache_path, settings.device
        )
    except Exception as e:
        print(f"FATAL: TRIBEv2 failed to load: {e}", file=sys.stderr)
        sys.exit(1)  # D-08: refuse to start, no degraded mode
    asyncio.create_task(gpu_worker_loop())
    yield

app = FastAPI(lifespan=lifespan)
```

### Pattern 2: asyncio.Queue + Single ThreadPoolExecutor GPU Worker

**What:** A FIFO asyncio.Queue serializes all inference jobs. A single background coroutine consumes jobs one at a time, running the blocking GPU call in a ThreadPoolExecutor with max_workers=1.

**When to use:** Any CPU-bound or GPU-bound work that would block the async event loop.

**Example:**
```python
# backend/core/queue.py
# Source: ARCHITECTURE.md (project research)
import asyncio
from concurrent.futures import ThreadPoolExecutor

gpu_queue: asyncio.Queue = asyncio.Queue()
gpu_executor = ThreadPoolExecutor(max_workers=1)

async def gpu_worker_loop():
    while True:
        job_id = await gpu_queue.get()
        try:
            await process_test_inference_job(job_id)
        except Exception as e:
            await mark_job_error(job_id, str(e))
        finally:
            gpu_queue.task_done()
```

```python
# backend/services/inference.py — run blocking GPU call off the event loop
import asyncio, torch
import numpy as np

async def run_tribev2_text(text_path: str) -> np.ndarray:
    loop = asyncio.get_event_loop()

    def _infer():
        with torch.inference_mode():
            df = model.get_events_dataframe(text_path=text_path)
            preds, segments = model.predict(events=df)
        return preds.cpu().numpy()  # move off GPU before returning

    return await loop.run_in_executor(gpu_executor, _infer)
```

### Pattern 3: SQLite Job Registry Schema

**What:** Minimal SQLite table supporting the 3-stage lifecycle (D-06) and extensible for Phase 2's 5-stage expansion.

```python
# backend/models/job.py
from sqlalchemy import Column, String, JSON, DateTime, Integer
from sqlalchemy.orm import DeclarativeBase
import uuid, datetime

class Base(DeclarativeBase): pass

class Job(Base):
    __tablename__ = "jobs"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    status = Column(String, nullable=False, default="PENDING")  # PENDING|RUNNING|DONE|ERROR
    stage = Column(String, nullable=True)       # None → "inference" → "processing"
    queue_position = Column(Integer, nullable=True)
    result_json = Column(JSON, nullable=True)   # activation stats + ROI labels
    error_message = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.datetime.utcnow)
    retry_count = Column(Integer, default=0)    # D-07: retry once on GPU failure
    input_path = Column(String, nullable=True)  # text file path or video path
    input_type = Column(String, nullable=True)  # "text" | "video"
```

**Design note:** `result_json` stores pre-aggregated ROI stats only (not the raw ~20k vertex array). Raw activation arrays written to disk as `.npy` files; path stored in `result_json["activation_path"]` to prevent SQLite bloat (5-10MB per job).

### Pattern 4: ROI Cortical-Proxy Label Schema (D-10, D-11)

**What:** Five named circuits hardcoded to Destrieux atlas regions using nilearn. No Brodmann codes, no subcortical labels.

```python
# backend/services/roi_aggregation.py
# Source: PITFALLS.md / SUMMARY.md (project research)
import nilearn.datasets
import numpy as np

# Cortical proxies — D-11 locked, reflects Issue #23 status (no subcortical checkpoint)
ROI_CIRCUIT_MAP = {
    "Attention":          ["S_front_inf", "G_front_inf_IFG", "S_intrapariet_and_P_trans"],
    "Cognitive Load":     ["G_front_middle", "S_front_middle", "G_front_sup"],
    "Emotional Response": ["G_ins_lg_and_S_cent_ins", "S_cingul-Marginalis"],  # insula + cingulate
    "Memory Encoding":    ["G_parahip", "S_collat_transv_ant"],  # parahippocampal proxy
    "Reward":             ["G_orbital", "G_rectus", "S_orbital_lateral"],  # OFC proxy
}

def aggregate_roi_scores(mean_activation: np.ndarray, atlas_labels: list[str]) -> dict:
    """Map per-vertex mean activation to five named circuits.
    Never returns Brodmann codes or subcortical labels — D-10 enforced here."""
    results = {}
    for circuit_name, region_names in ROI_CIRCUIT_MAP.items():
        indices = [i for i, label in enumerate(atlas_labels) if label in region_names]
        if indices:
            scores = mean_activation[indices]
            results[circuit_name] = {
                "score": float(np.mean(scores)),
                "peak": float(np.max(scores)),
            }
    return results
```

**Important:** The exact Destrieux region names must be verified against `nilearn.datasets.fetch_atlas_destrieux()` at implementation time — the region names above are representative, not guaranteed exact strings. [ASSUMED: region name strings — must verify via nilearn atlas labels at implementation]

### Pattern 5: GET /jobs/{id} Response Shape (INFRA-03)

```python
# Pydantic schema for Phase 1 polling endpoint
from pydantic import BaseModel
from typing import Optional, Any

class JobStatusResponse(BaseModel):
    job_id: str
    status: str             # "PENDING" | "RUNNING" | "DONE" | "ERROR"
    queue_position: Optional[int] = None   # set while PENDING
    stage: Optional[str] = None            # "inference" | "processing" while RUNNING
    result: Optional[dict[str, Any]] = None  # populated when DONE
    error: Optional[str] = None            # populated on ERROR
```

### Anti-Patterns to Avoid

- **Loading TRIBEv2 per-request:** Server becomes unusable — first request blocks for 30-60s, subsequent requests timeout waiting for the per-request reload.
- **Using FastAPI BackgroundTasks for GPU inference:** No serialization guarantee. Two concurrent POST requests will race for VRAM and OOM.
- **Running uvicorn with --workers > 1:** Each process independently loads TRIBEv2 into GPU memory. On Apple Silicon this means double CPU RAM usage; on CUDA it would OOM immediately.
- **Calling `.predict()` directly in the async event loop:** Blocks the loop for 60-120s — all other endpoints become unresponsive. Always use `run_in_executor`.
- **Hardcoding vertex indices to region names:** Breaks if TRIBEv2 updates its mesh or you change atlas versions. Always map dynamically via nilearn atlas lookup.
- **Using `model.eval()` only during training check:** Must call at startup after `from_pretrained`. BatchNorm and Dropout behave differently without it — non-deterministic inference.
- **Storing raw `(n_timesteps, ~20k vertices)` array in SQLite JSON column:** ~5-10MB per job bloats the database rapidly. Write `.npy` to disk, store path in DB.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Blocking GPU calls in async | Custom thread management | `asyncio.loop.run_in_executor(ThreadPoolExecutor(max_workers=1), fn)` | Event loop blocks, all endpoints freeze |
| Job FIFO serialization | Custom lock/semaphore patterns | `asyncio.Queue` — built into stdlib | Queue handles backpressure, ordering, and task_done tracking |
| Database schema migrations | Manual `ALTER TABLE` SQL | `alembic` | Job schema will gain stages in Phase 2; manual SQL breaks on schema conflicts |
| Atlas region lookup | Custom vertex-to-region mapping | `nilearn.datasets.fetch_atlas_destrieux()` | Atlas is 148 regions; hand-rolled maps will have wrong indices across fsaverage resolutions |
| Text-to-speech for text input | Custom gTTS pipeline | TRIBEv2 internal — pass `text_path` param, model handles gTTS internally | TRIBEv2 owns the text→speech→encoding pipeline; intercepting it breaks timing alignment |
| Video slideshow assembly | Custom PIL/imageio video writer | `moviepy` (already in TRIBEv2 deps) | Frame timing, codec, and audio track handling is non-trivial |

**Key insight:** TRIBEv2 is a research codebase with GPU+atlas dependencies that took months to harden. Don't replicate its internals — use it as a black box via the documented `text_path` / `video_path` API surface.

---

## Common Pitfalls

### Pitfall 1: numpy==2.2.6 Exact Pin Breaks Install
**What goes wrong:** TRIBEv2 `pyproject.toml` hard-pins `numpy==2.2.6`. Nilearn and scipy require higher numpy versions. pip solver fails with dependency conflict.
**Why it happens:** Research code packaging mistake — `==` instead of `>=`.
**How to avoid:** Patch `pyproject.toml` before running `pip install -e .`: change `"numpy==2.2.6"` to `"numpy>=2.2.6,<3"`. Apply this as the very first step after cloning.
**Warning signs:** `pip install -e ".[plotting]"` exits with numpy version conflict error.
[VERIFIED: GitHub Issue #6, facebookresearch/tribev2]

### Pitfall 2: TRIBEv2 Does Not Auto-Detect MPS (Apple Silicon)
**What goes wrong:** `TribeModel.from_pretrained("facebook/tribev2")` with `device="auto"` only checks `torch.cuda.is_available()`. On Apple Silicon it falls back to CPU — inference takes 10-50x longer than MPS.
**Why it happens:** TRIBEv2 `demo_utils.py` device detection code: `device = "cuda" if torch.cuda.is_available() else "cpu"`. No MPS branch.
**How to avoid:** Always pass `device="mps"` explicitly in `.env` and `config.py`. Wrap in a try/except — if MPS raises `NotImplementedError` for a specific op, fall back to CPU with a warning. Validate MPS works with a tiny test tensor before loading the full model.
**Warning signs:** Inference takes >10 minutes; `nvidia-smi` or `system_profiler` shows no GPU utilization.
[VERIFIED: tribev2/demo_utils.py source, fetched 2026-04-08]

### Pitfall 3: TemporalSmoothing Layer Bug (requires_grad no-op)
**What goes wrong:** `conv.requires_grad = False` in `tribev2/model.py` is a no-op in PyTorch. The Gaussian kernel remains trainable. Inference output has higher temporal noise than intended.
**Why it happens:** `nn.Module` does not have `requires_grad` attribute — the correct call is `conv.requires_grad_(False)`.
**How to avoid:** Apply patch at clone time: change `conv.requires_grad = False` to `conv.requires_grad_(False)` in `tribev2/model.py`. When aggregating output, always use `np.mean(preds, axis=0)` rather than sampling a single timestep to reduce noise.
**Warning signs:** High variance across timesteps: `np.std(preds, axis=0)` exceeds `np.mean(preds, axis=0)` per vertex.
[VERIFIED: GitHub Issue #5, facebookresearch/tribev2]

### Pitfall 4: TRIBEv2 Text Pathway May Produce Undifferentiated Activation Maps
**What goes wrong:** gTTS synthetic speech has flat prosody — no emotional valence or acoustic variation between different design descriptions. V-JEPA2 (TRIBEv2's strongest encoder) is bypassed on text input. Activation maps for a calm landing page and a high-urgency checkout may look identical.
**Why it happens:** TRIBEv2 was trained on naturalistic speech, not synthetic TTS. gTTS produces robotic, uniform prosody regardless of content urgency.
**How to avoid:** D-02 and D-03 require building both text and video paths and running the visual differentiation gate. If text maps look identical for maximally different inputs (calm vs. urgent), switch the default to the video slideshow path (D-04).
**Warning signs:** ROI scores within 0.05 across two very different inputs; activation patterns visually identical.
[VERIFIED: PITFALLS.md / SUMMARY.md (project research), corroborated by TRIBEv2 architecture]

### Pitfall 5: Subcortical Labels Will Break TRIBEv2 Output Mapping
**What goes wrong:** TRIBEv2 predicts on fsaverage5 cortical surface only. Striatum, nucleus accumbens, hippocampus (deeper) are NOT in the mesh. Attempting to label output as "striatum" or "reward circuit (striatum)" is anatomically incorrect — no vertices will map to those regions.
**Why it happens:** Subcortical checkpoint not yet released (GitHub Issue #23, open as of April 2026).
**How to avoid:** D-10 and D-11 are explicit: use cortical proxies only. Never use the terms "striatum", "nucleus accumbens", "amygdala" in code constants, API responses, or UI. The ROI_CIRCUIT_MAP must use only Destrieux atlas labels that appear in fsaverage5.
**Warning signs:** `nilearn.datasets.fetch_atlas_destrieux()` returns no matches when querying subcortical region names against the fsaverage5 parcellation.
[VERIFIED: GitHub Issue #23, PITFALLS.md (project research)]

### Pitfall 6: model_cache Redownloads on Every Restart Without cache_folder
**What goes wrong:** `TribeModel.from_pretrained("facebook/tribev2")` without `cache_folder` downloads ~10GB of weights on every server restart.
**How to avoid:** Always specify `cache_folder="./model_cache"` (from `.env` as `MODEL_CACHE_PATH`). Add `model_cache/` to `.gitignore`.
[VERIFIED: PITFALLS.md (project research)]

### Pitfall 7: PyTorch 2.8.0 Is Already Installed in System Python — Must Use Isolated Env
**What goes wrong:** The system Python 3.9 has `torch==2.8.0` installed. TRIBEv2 pins `torch<2.7`. If the venv accidentally inherits system packages or picks up the wrong Python, TRIBEv2 install will fail on the version constraint.
**Why it happens:** macOS development machines often have stale system Python packages that leak into new environments.
**How to avoid:** Create the venv explicitly with the Homebrew Python 3.11 binary: `/opt/homebrew/opt/python@3.11/bin/python3.11 -m venv ~/.venvs/brainx`. Never use `python3` (which resolves to 3.9 on this machine). Verify with `which python` and `python --version` inside the activated venv before installing anything.
**Warning signs:** `python --version` inside the venv shows 3.9 instead of 3.11; `pip show torch` shows version 2.8.0.
[VERIFIED: environment audit, 2026-04-08]

---

## Runtime State Inventory

Step 2.5 SKIPPED — this is a greenfield phase, no renames or migrations. Repository is empty at Phase 1 start.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3.11 | TRIBEv2, INFRA-01 | Partially | Formula exists, not installed | `brew install python@3.11` (Wave 0 task) |
| PyTorch 2.6.0 (arm64) | TRIBEv2 | ✗ | System has 2.8.0 on Python 3.9 (wrong) | Install fresh in venv: `pip install torch==2.6.0` |
| conda | Environment isolation | ✗ | — | Use Python venv — same isolation, no conda needed |
| NVIDIA GPU + CUDA | TRIBEv2 GPU acceleration | ✗ | Apple M3 Pro (no NVIDIA) | MPS backend (attempt first); CPU fallback if MPS fails |
| MPS backend (Apple Silicon) | TRIBEv2 acceleration | Likely | torch.backends.mps.is_available() = True on M3 Pro | CPU (slow but functional for smoke tests) |
| ffmpeg | moviepy video assembly | ✓ | 7.1.1 | — |
| git | TRIBEv2 clone | ✓ | 2.39.5 | — |
| Node.js | npm (frontend, not Phase 1) | ✓ | 24.4.1 | — |

**Missing dependencies with no fallback:**
- Python 3.11 — required before any other step. Install via `brew install python@3.11`.

**Missing dependencies with fallback:**
- PyTorch 2.6.0 — needs fresh install in isolated venv (system has wrong version + wrong Python).
- CUDA/NVIDIA GPU — MPS is the primary alternative. CPU is the last resort fallback. Both result in longer inference times; CPU may be impractical for Phase 1 timing validation (hours per job).

**MPS viability risk:** TRIBEv2 uses Wav2Vec-BERT and V-JEPA2 internally. Some transformers ops (especially custom CUDA kernels in audio models) are not MPS-compatible. This is empirically unverified for TRIBEv2 specifically. Plan 01-01 must include an explicit MPS smoke test before proceeding to inference validation. [ASSUMED: MPS will work without unsupported ops — must verify empirically]

---

## Code Examples

Verified patterns from project research and official sources:

### TRIBEv2 Text Path Inference
```python
# Source: ARCHITECTURE.md (project research) + tribev2/demo_utils.py
import asyncio, torch, numpy as np
from concurrent.futures import ThreadPoolExecutor

gpu_executor = ThreadPoolExecutor(max_workers=1)

async def run_tribev2_text_path(text_path: str, model) -> np.ndarray:
    loop = asyncio.get_event_loop()

    def _infer():
        with torch.inference_mode():
            df = model.get_events_dataframe(text_path=text_path)
            preds, segments = model.predict(events=df)
        # (n_timesteps, ~20k vertices) — move off GPU before leaving thread
        return preds.cpu().numpy()

    return await loop.run_in_executor(gpu_executor, _infer)
```

### TRIBEv2 Video Slideshow Path (SIM-03 Fallback)
```python
# Source: STACK.md / ARCHITECTURE.md (project research)
import moviepy.editor as mp
from PIL import Image
import tempfile, os

def build_slideshow_mp4(
    screen_paths: list[str],
    durations_s: list[float],
    output_path: str,
) -> str:
    """Assemble a timed MP4 from screen images. Each screen shown for duration_s seconds."""
    clips = []
    for img_path, duration in zip(screen_paths, durations_s):
        clip = mp.ImageClip(img_path, duration=duration)
        clips.append(clip)
    video = mp.concatenate_videoclips(clips, method="compose")
    video.write_videofile(output_path, fps=24, codec="libx264", audio=False)
    return output_path

async def run_tribev2_video_path(video_path: str, model) -> np.ndarray:
    loop = asyncio.get_event_loop()
    def _infer():
        with torch.inference_mode():
            df = model.get_events_dataframe(video_path=video_path)
            preds, _ = model.predict(events=df)
        return preds.cpu().numpy()
    return await loop.run_in_executor(gpu_executor, _infer)
```

### ROI Activation Aggregation
```python
# Source: ARCHITECTURE.md / PITFALLS.md (project research)
import numpy as np
from nilearn import datasets

def build_destrieux_label_map() -> tuple[np.ndarray, list[str]]:
    """Returns vertex parcellation array and label list for fsaverage5."""
    atlas = datasets.fetch_atlas_destrieux(surface_mesh="fsaverage5")
    # atlas.labels: list of region name strings
    # atlas.maps: per-vertex region index array
    return atlas.maps, atlas.labels

def aggregate_roi_scores(
    preds: np.ndarray,           # (n_timesteps, n_vertices)
    vertex_labels: list[str],    # per-vertex region name
) -> dict[str, dict]:
    mean_activation = np.mean(preds, axis=0)  # (n_vertices,)
    # ROI_CIRCUIT_MAP keys map to consumer-friendly labels (D-10)
    results = {}
    for circuit, region_names in ROI_CIRCUIT_MAP.items():
        indices = [i for i, lbl in enumerate(vertex_labels) if lbl in region_names]
        if indices:
            scores = mean_activation[indices]
            results[circuit] = {"score": round(float(np.mean(scores)), 4),
                                 "peak": round(float(np.max(scores)), 4)}
    return results
```

### D-07: GPU Failure Retry Logic
```python
# Source: CONTEXT.md D-07 decision
async def process_test_inference_job(job_id: str):
    job = await get_job(job_id)
    await update_job_status(job_id, "RUNNING")
    try:
        result = await run_inference_with_retry(job, max_retries=1)
        await update_job_done(job_id, result)
    except Exception as e:
        await update_job_error(job_id, str(e))

async def run_inference_with_retry(job, max_retries: int = 1):
    for attempt in range(max_retries + 1):
        try:
            return await run_tribev2_text_path(job.input_path, get_model())
        except (RuntimeError, torch.cuda.OutOfMemoryError) as e:
            if "out of memory" in str(e).lower() or attempt == max_retries:
                raise RuntimeError(f"GPU inference failed after {attempt+1} attempt(s): {e}")
            await asyncio.sleep(2)  # brief pause before retry
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Flask + BackgroundTasks for ML serving | FastAPI + asyncio.Queue + ThreadPoolExecutor | 2023-2024 | Type-safe, async-native, no VRAM race |
| Global model variable loaded at import | FastAPI lifespan context manager | FastAPI 0.93 (2023) | Proper startup/shutdown lifecycle |
| `torch.no_grad()` during inference | `torch.inference_mode()` | PyTorch 1.9 | 15-30% faster, stronger guarantee (no grad recording) |
| SQLModel for async SQLite | SQLAlchemy 2.0 + aiosqlite directly | 2024 | SQLModel still targets SA 1.4.x; SA 2.0 async is stable |
| conda for Python isolation | venv (when conda unavailable) | Always valid | Same isolation, less overhead — conda adds ~100MB base env |

**Deprecated/outdated:**
- SQLModel: Targets SQLAlchemy 1.4.x. Async support incomplete. Use SQLAlchemy 2.0 directly.
- `torch.no_grad()`: Replaced by `torch.inference_mode()` for pure inference paths.
- Multiple uvicorn workers for ML apps: Anti-pattern confirmed — GPU memory multiplies per worker.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | MPS backend will work for TRIBEv2 inference on M3 Pro | Environment Availability | If MPS ops fail, inference falls back to CPU — may take hours per job, making Phase 1 timing validation impractical |
| A2 | FastAPI current stable is ~0.115.x (STACK.md cited 0.135.x which may be projective) | Standard Stack | If 0.115.x is wrong, pin the correct version at install time — API surface is stable |
| A3 | Exact Destrieux region name strings in ROI_CIRCUIT_MAP match nilearn atlas labels | Architecture Patterns | If names differ, ROI aggregation returns empty results for circuits — must verify via `atlas.labels` at implementation |
| A4 | `TribeModel.from_pretrained` accepts `device="mps"` as a string (not just "cuda"/"cpu") | Architecture Patterns | If device validation rejects "mps", wrap in `try` and explicitly patch the device selection |
| A5 | PyTorch 2.6.0 arm64 wheel is available via standard pip registry without CUDA index URL | Standard Stack | If only CUDA wheels are published, use `pip install torch==2.6.0` — arm64 wheels ship on PyPI without an index-url override |

---

## Open Questions

1. **MPS viability for TRIBEv2 inference**
   - What we know: M3 Pro has MPS backend; TRIBEv2 accepts explicit `device="mps"`; MPS is not auto-detected
   - What's unclear: Whether Wav2Vec-BERT audio encoding ops (which may use custom CUDA kernels) are MPS-compatible
   - Recommendation: Plan 01-01 must include an explicit MPS smoke test: load model, run a 10-word sentence through text path, check for `NotImplementedError` or `RuntimeError` with MPS. If MPS fails, set `DEVICE=cpu` in `.env` and note the latency impact.

2. **TRIBEv2 inference latency on Apple Silicon**
   - What we know: Estimated 60-120s on CUDA. MPS is slower than CUDA for transformers.
   - What's unclear: Whether CPU or MPS inference is feasible for iterative development (vs. hours per job)
   - Recommendation: Time a single inference run in Plan 01-03 and record baseline latency. If >300s on MPS, the differentiation gate test will take hours — may need to reduce test input length.

3. **Exact patch location for TemporalSmoothing bug**
   - What we know: The bug is in `tribev2/tribev2/model.py`, `conv.requires_grad = False` → `conv.requires_grad_(False)`
   - What's unclear: Line number and whether there are multiple instances
   - Recommendation: After cloning, `grep -n "requires_grad" tribev2/tribev2/model.py` to find all instances, patch all of them.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest + pytest-asyncio |
| Config file | `pytest.ini` or `pyproject.toml [tool.pytest]` — Wave 0 creates |
| Quick run command | `pytest backend/tests/ -x -q` |
| Full suite command | `pytest backend/tests/ -v` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-01 | uvicorn starts with 1 worker; asyncio.Queue processes one job at a time | smoke | `pytest backend/tests/test_queue.py -x` | Wave 0 |
| INFRA-01 | Concurrent POST requests queue without OOM | integration | `pytest backend/tests/test_concurrent_jobs.py -x` | Wave 0 |
| INFRA-02 | TRIBEv2 loads once at startup; server exits if load fails | smoke | `pytest backend/tests/test_lifespan.py -x` | Wave 0 |
| INFRA-02 | Both numpy and TemporalSmoothing patches applied | unit | `pytest backend/tests/test_patches.py -x` | Wave 0 |
| INFRA-03 | GET /model-status returns correct loading state | smoke | `pytest backend/tests/test_health.py::test_model_status -x` | Wave 0 |
| INFRA-03 | GET /jobs/{id} returns PENDING/RUNNING/DONE/ERROR correctly | unit | `pytest backend/tests/test_jobs_api.py -x` | Wave 0 |
| SIM-03 | moviepy assembles MP4 from screen images | unit | `pytest backend/tests/test_video_path.py -x` | Wave 0 |
| SIM-03 | Video path produces activation array (smoke, not differentiation) | smoke | `pytest backend/tests/test_inference_video.py -x` | Wave 0 |
| (gate) | Differentiation: text or video path produces non-uniform maps | manual | Visual inspection — not automatable | N/A |

**Note:** The differentiation gate (D-03) is explicitly manual visual inspection — no automated test needed per locked decision.

### Sampling Rate
- **Per task commit:** `pytest backend/tests/ -x -q --ignore=backend/tests/test_inference_*.py` (fast, skip slow GPU tests)
- **Per wave merge:** `pytest backend/tests/ -v` (full suite including inference smoke tests)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `backend/tests/__init__.py` — package init
- [ ] `backend/tests/conftest.py` — shared fixtures (test app, mock model, async DB session)
- [ ] `backend/tests/test_queue.py` — INFRA-01 queue serialization
- [ ] `backend/tests/test_lifespan.py` — INFRA-02 startup behavior
- [ ] `backend/tests/test_patches.py` — INFRA-02 patch verification
- [ ] `backend/tests/test_health.py` — INFRA-03 model-status endpoint
- [ ] `backend/tests/test_jobs_api.py` — INFRA-03 job polling
- [ ] `backend/tests/test_video_path.py` — SIM-03 moviepy assembly
- [ ] `pytest.ini` — asyncio mode configuration
- [ ] Framework install: `pip install pytest pytest-asyncio httpx` — included in Wave 0 setup

---

## Security Domain

> `security_enforcement` not explicitly set in config.json — treating as enabled (default).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Single-user local tool — no auth in v1 |
| V3 Session Management | No | No user sessions in Phase 1 |
| V4 Access Control | No | localhost only |
| V5 Input Validation | Yes | Pydantic v2 request validation; validate text input is non-empty string; validate video path exists before passing to TRIBEv2 |
| V6 Cryptography | No | No sensitive data at rest in Phase 1 |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via text_path or video_path | Tampering | Validate all file paths are within `/tmp/brainx_{job_id}/` directory; use `pathlib.Path.is_relative_to()` |
| Queue flooding (unbounded job submission) | Denial of Service | Add queue depth check before enqueue: if `gpu_queue.qsize() >= MAX_QUEUE_DEPTH` return 429 (deferred to Phase 5 per roadmap, but schema should support it) |
| GPU OOM from maliciously long inputs | Denial of Service | Enforce max text length (e.g., 2000 words) and max video duration at the Pydantic layer before inference |

---

## Sources

### Primary (HIGH confidence)
- TRIBEv2 GitHub — Issues #5, #6, #23, #28: https://github.com/facebookresearch/tribev2 — numpy pin bug, TemporalSmoothing bug, subcortical checkpoint status, OOM confirmation
- TRIBEv2 `demo_utils.py` source (fetched 2026-04-08): device auto-detection logic (`cuda` or `cpu`, no MPS)
- TRIBEv2 Hugging Face model card: https://huggingface.co/facebook/tribev2 — `text_path`, `video_path` params, fsaverage5 output
- Project research files: `.planning/research/STACK.md`, `.planning/research/ARCHITECTURE.md`, `.planning/research/PITFALLS.md`, `.planning/research/SUMMARY.md` — verified against upstream sources in original research session (2026-04-06)
- Environment audit (2026-04-08): M3 Pro architecture, no conda, Python 3.9 system, torch 2.8.0 system, Python 3.11 formula available, ffmpeg 7.1.1 available, MPS available

### Secondary (MEDIUM confidence)
- FastAPI docs — lifespan, BackgroundTasks: https://fastapi.tiangolo.com — patterns confirmed
- PyTorch docs — inference_mode, run_in_executor patterns: https://pytorch.org — confirmed
- nilearn docs — fetch_atlas_destrieux: https://nilearn.github.io — atlas API confirmed

### Tertiary (LOW confidence)
- MPS compatibility for TRIBEv2 specifically — inferred from general MPS support in PyTorch + explicit device string acceptance; empirically unverified for TRIBEv2's specific op usage
- TRIBEv2 inference latency on Apple Silicon — no benchmarks available; estimated from CUDA numbers with MPS/CPU degradation factor
- Exact Destrieux region name strings for ROI_CIRCUIT_MAP — representative examples; must verify against `atlas.labels` at implementation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — core versions verified against TRIBEv2 pyproject.toml; environment audit confirmed machine state
- Architecture: HIGH — asyncio.Queue/lifespan patterns are standard FastAPI; TRIBEv2 API surface confirmed from source
- Environment: HIGH for what's available; LOW for MPS viability — empirically unverified
- Pitfalls: HIGH — TRIBEv2 bugs verified from GitHub issues; environment pitfalls verified from local audit
- ROI cortical-proxy labels: MEDIUM — region name strings need verification against nilearn atlas.labels at implementation

**Research date:** 2026-04-08
**Valid until:** 2026-05-08 (stable stack; re-verify if TRIBEv2 main branch advances significantly)
