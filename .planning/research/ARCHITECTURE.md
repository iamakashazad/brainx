# Architecture Research

**Domain:** Neuro-design / AI-simulated brain response analysis tool (ML-serving + React 3D)
**Researched:** 2026-04-06
**Confidence:** HIGH (structural patterns), MEDIUM (TRIBEv2 integration details — inference timing/output shape confirmed, exact latency unverified)

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         REACT FRONTEND (Vite)                        │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────────┐  │
│  │ Upload Flow  │  │ Persona Form │  │  Results + 3D Brain View  │  │
│  │ (Dropzone)   │  │ (Radix UI)   │  │  (@react-three/fiber)     │  │
│  └──────┬───────┘  └──────┬───────┘  └───────────────────────────┘  │
│         │                 │                        ↑                 │
│         └────────┬────────┘          React Query polling             │
│                  │                        │                          │
│            Zustand state          GET /jobs/{id}                     │
│                  │                        │                          │
└──────────────────┼────────────────────────┼──────────────────────────┘
                   │  POST /analyze          │
                   ↓                        │
┌─────────────────────────────────────────────────────────────────────┐
│                       FASTAPI BACKEND (uvicorn --workers 1)          │
│                                                                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────────┐   │
│  │  Upload Handler │  │  Job Registry   │  │ Recommendation     │   │
│  │  (multipart)    │  │  (SQLite/ORM)   │  │ Engine             │   │
│  └────────┬────────┘  └────────┬────────┘  └────────────────────┘   │
│           │                   │                      ↑               │
│           ↓                   ↓                      │               │
│  ┌──────────────────────────────────────────────┐   │               │
│  │            asyncio.Queue (FIFO)              │   │               │
│  │  [Job1] → [Job2] → [Job3] → ...             │   │               │
│  └──────────────────────┬───────────────────────┘   │               │
│                         │                           │               │
│           ┌─────────────▼───────────────────────────┴──────┐        │
│           │         GPU WORKER COROUTINE (single, FIFO)    │        │
│           │                                                │        │
│           │  1. GPT-4o Simulation (async, OpenAI API)      │        │
│           │  2. Text Narrative → TRIBEv2 text_path         │        │
│           │  3. TRIBEv2 inference (ThreadPoolExecutor x1)  │        │
│           │  4. nilearn: vertex array → ROI summary        │        │
│           │  5. Recommendations Engine (GPT-4o)            │        │
│           └────────────────────────────────────────────────┘        │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │             STATIC ASSETS (served by FastAPI/CDN)           │    │
│  │  fsaverage5 mesh (OBJ → GLTF, ~20k vertices, both hemis)   │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
              ┌─────────────────┼──────────────────────┐
              │                 │                       │
      ┌───────▼──────┐  ┌───────▼──────┐  ┌───────────▼──────┐
      │  SQLite DB   │  │ TRIBEv2      │  │  OpenAI GPT-4o   │
      │  (aiosqlite) │  │ (local GPU)  │  │  (external API)  │
      │  Jobs, Runs, │  │  ~16GB VRAM  │  │  Simulation +    │
      │  Personas    │  │  CUDA 12.4   │  │  Recommendations │
      └──────────────┘  └──────────────┘  └──────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| React Upload Flow | Accepts 1-5 screen images (PNG/JPG/WEBP), validates MIME type, sends multipart POST | FastAPI Upload Handler |
| React Persona Form | Collects demographics, cognitive state, environment; stores in Zustand | Zustand store |
| Zustand Store | Holds job state, persona config, activation data across components | React components, React Query |
| React Query | Polls GET /jobs/{id} every 2-3s until DONE; caches result | FastAPI Job Registry |
| 3D Brain View | Loads fsaverage5 GLTF mesh, maps activation JSON to vertex colors, renders with R3F | Static asset server (mesh), React Query (activation data) |
| FastAPI Upload Handler | Saves uploaded images to temp dir, creates job record (PENDING), enqueues job UUID | asyncio.Queue, Job Registry |
| Job Registry (SQLite) | Persists job status (PENDING/RUNNING/DONE/ERROR), stores result JSON, persona definitions | FastAPI routes, GPU Worker |
| asyncio.Queue (FIFO) | Serializes job execution — one job at a time, prevents GPU memory conflicts | GPU Worker Coroutine |
| GPU Worker Coroutine | Runs sequentially: simulation → TRIBEv2 inference → ROI aggregation → recommendations | GPT-4o API, TRIBEv2, nilearn, Recommendations Engine |
| GPT-4o Simulation | Receives screen images (base64) + persona definition, generates a text gaze narrative | OpenAI API (external) |
| TRIBEv2 Input Bridge | Writes GPT-4o narrative to temp text file, constructs `text_path` for TRIBEv2 | Filesystem temp dir |
| TRIBEv2 Inference | Loads model once at startup (lifespan), runs text→speech→brain prediction | GPU (CUDA), ThreadPoolExecutor |
| ROI Aggregation (nilearn) | Converts `(n_timesteps, ~20k vertices)` array to per-atlas-region statistics | numpy/scipy, nilearn atlas |
| Recommendations Engine | Sends ROI summary + persona + screen context to GPT-4o, receives structured design recs | OpenAI API (external) |
| Static Asset Server | Serves pre-converted fsaverage5 GLTF mesh files (left/right hemisphere) | React 3D Brain View |

---

## TRIBEv2 Input Bridge — The Critical Design Point

TRIBEv2 does not accept static images. This bridge is the core architectural novelty in BrainX.

### The Conversion Pipeline

```
[Screen Images (PNG/JPG)]
         │
         │  base64-encode each image
         ↓
[GPT-4o Multimodal API Call]
  Prompt: "You are simulating {persona}. Describe, in first-person
           narrative, how they experience each screen: where they look
           first, what they read vs. skim, where they hesitate,
           emotional reactions, cognitive effort."
         │
         │  Returns: text narrative (~500-1000 words)
         ↓
[Temp file: /tmp/brainx_{job_id}/session_narrative.txt]
         │
         │  model.get_events_dataframe(text_path="session_narrative.txt")
         ↓
[TRIBEv2 text→gTTS→Wav2Vec-BERT pipeline]
         │
         │  model.predict(events=df)
         ↓
[(n_timesteps, ~20k vertices) activation array]
```

### Fallback Path (if text produces poor ROI differentiation)

```
[Screen Images (PNG/JPG)]
         │
         │  GPT-4o generates structured session:
         │  [{screen: 1, duration: 3.2, focus: "headline"}, ...]
         ↓
[moviepy: stitch screens into MP4 (each screen held for duration)]
         │
         │  model.get_events_dataframe(video_path="session.mp4")
         ↓
[TRIBEv2 V-JEPA2 video encoder pipeline]
         │
         ↓
[(n_timesteps, ~20k vertices) activation array]
```

Prefer the text path in Phase 1 — it is simpler to implement and test. The video path provides richer visual signal (actual screen content reaches V-JEPA2) and should be used if text-only output lacks per-ROI differentiation across different screen designs.

---

## GPU Queue Architecture

### Why asyncio.Queue + Single ThreadPoolExecutor

TRIBEv2 consumes approximately 16GB VRAM simultaneously across three encoders (LLaMA 3.2-3B, V-JEPA2, Wav2Vec-BERT). Multiple workers = OOM. The pattern that solves this cleanly:

```python
# backend/core/queue.py

import asyncio
from concurrent.futures import ThreadPoolExecutor

# Single-worker queue — initialized at startup
gpu_queue: asyncio.Queue = asyncio.Queue()
gpu_executor = ThreadPoolExecutor(max_workers=1)

async def gpu_worker_loop():
    """Runs forever, consuming jobs from the FIFO queue one at a time."""
    while True:
        job_id = await gpu_queue.get()
        try:
            await process_analysis_job(job_id)
        except Exception as e:
            await mark_job_error(job_id, str(e))
        finally:
            gpu_queue.task_done()

# FastAPI lifespan — model loaded ONCE, worker started ONCE
async def lifespan(app: FastAPI):
    # Load TRIBEv2 into GPU memory (takes ~30-60s first time)
    app.state.tribe_model = TribeModel.from_pretrained(
        "facebook/tribev2", cache_folder="./model_cache"
    )
    # Start the single background worker
    asyncio.create_task(gpu_worker_loop())
    yield
    # Shutdown: worker will complete current job then stop
```

### Job Lifecycle States

```
PENDING  →  RUNNING  →  DONE
   ↓                     ↓
   └──────── ERROR ───────┘
```

- `PENDING`: Job created, queued. Client begins polling.
- `RUNNING`: Picked up by GPU worker coroutine. Cannot be cancelled.
- `DONE`: Result JSON written to DB. Polling client receives it.
- `ERROR`: Exception during any stage. Error message stored for display.

### Why Not BackgroundTasks (for MVP with queue)

FastAPI `BackgroundTasks` fires-and-forgets without serialization. If two requests arrive within seconds, two GPU inference calls would race for VRAM. Use `asyncio.Queue` from startup to guarantee FIFO ordering. BackgroundTasks is acceptable only for post-processing steps that don't touch the GPU (e.g., sending a notification email).

---

## Data Flow

### Primary Analysis Flow

```
POST /analyze (screens + persona)
    │
    ├── Save images to /tmp/brainx_{job_id}/
    ├── Create Job record: status=PENDING
    ├── Enqueue job_id → asyncio.Queue
    └── Return 202: { job_id: "uuid" }

Client polls: GET /jobs/{job_id} every 2-3s
    │
    ├── PENDING → { status: "pending", queue_position: N }
    ├── RUNNING → { status: "running", stage: "simulation" | "inference" | "recommendations" }
    └── DONE    → { status: "done", result: { activations, rois, recommendations } }

GPU Worker (background, sequential):
    │
    ├── [Stage 1: Simulation]
    │     Read images from tmp dir
    │     Call GPT-4o (vision): images + persona → narrative text
    │     Write narrative to session_narrative.txt
    │     Update job: stage="inference"
    │
    ├── [Stage 2: TRIBEv2 Inference]
    │     model.get_events_dataframe(text_path=narrative_path)
    │     preds, segments = model.predict(events=df)   # blocking GPU call
    │     preds.cpu().numpy()  →  (n_timesteps, ~20k vertices)
    │     Update job: stage="processing"
    │
    ├── [Stage 3: ROI Aggregation]
    │     np.mean(preds, axis=0)  →  (20k,) mean activation per vertex
    │     Map vertices → Destrieux atlas ROIs via nilearn
    │     Compute per-ROI: mean, peak, lateralization index
    │     Assign semantic labels: attention, cognitive_load, emotion,
    │                             memory, reward (predefined ROI mapping)
    │     Update job: stage="recommendations"
    │
    ├── [Stage 4: Recommendations Engine]
    │     Call GPT-4o (text): ROI summary + persona + screen context
    │     Returns structured JSON: { headline_rewrite, cta_rewrite,
    │                                 attention_flags, cognitive_load_warnings }
    │
    └── [Stage 5: Persist + Notify]
          Write result JSON to Job record
          Update job: status=DONE
          Clean up /tmp/brainx_{job_id}/
```

### Frontend State Flow

```
Zustand store
    │
    ├── personaConfig     ← Persona Form writes
    ├── uploadedScreens   ← Upload Flow writes
    ├── currentJobId      ← Set after POST /analyze response
    └── analysisResult    ← Set when React Query polling returns DONE

React Query (useQuery on GET /jobs/{currentJobId})
    │
    ├── refetchInterval: 2500ms while status != "done"
    ├── onSuccess: write result to Zustand store
    └── enabled: currentJobId !== null
```

### API Response Shape (Result)

```json
{
  "job_id": "uuid",
  "status": "done",
  "result": {
    "activations": {
      "left_hemisphere": [20000 floats, normalized 0-1],
      "right_hemisphere": [20000 floats, normalized 0-1]
    },
    "rois": {
      "attention": { "score": 0.73, "peak_vertex": 4821, "laterality": "bilateral" },
      "cognitive_load": { "score": 0.81, "peak_vertex": 9201, "laterality": "left" },
      "emotional_response": { "score": 0.44, "peak_vertex": 15032, "laterality": "right" },
      "memory_encoding": { "score": 0.61, "peak_vertex": 7340, "laterality": "bilateral" },
      "reward_circuits": { "score": 0.29, "peak_vertex": 18440, "laterality": "left" }
    },
    "recommendations": {
      "headline_rewrite": "...",
      "cta_rewrite": "...",
      "attention_flags": ["Hero image occupies visual processing budget before CTA loads"],
      "cognitive_load_warnings": ["3 competing CTAs detected in screen 2"],
      "memory_predictions": ["Screen 1 headline will be forgotten within 30s"],
      "reward_assessment": "CTA not reaching reward circuits — reframe as gain not loss"
    },
    "persona": { ... },
    "screens_count": 3,
    "inference_duration_seconds": 142
  }
}
```

---

## Recommended Project Structure

```
brainx/
├── backend/
│   ├── main.py                    # FastAPI app, lifespan, CORS, router mounts
│   ├── core/
│   │   ├── config.py              # Settings (dotenv), GPU device, paths
│   │   ├── queue.py               # asyncio.Queue, gpu_executor, gpu_worker_loop
│   │   └── database.py            # SQLAlchemy async engine, session factory
│   ├── models/
│   │   ├── job.py                 # Job ORM model (id, status, stage, result_json)
│   │   ├── persona.py             # Persona ORM model
│   │   └── schemas.py             # Pydantic request/response schemas
│   ├── services/
│   │   ├── simulation.py          # GPT-4o multimodal: screens + persona → narrative
│   │   ├── inference.py           # TRIBEv2 wrapper: text_path → (n_timesteps, n_vertices)
│   │   ├── roi_aggregation.py     # nilearn: vertex array → per-ROI stats dict
│   │   └── recommendations.py     # GPT-4o: ROI stats + context → design recs JSON
│   ├── routers/
│   │   ├── analyze.py             # POST /analyze, GET /jobs/{id}
│   │   └── health.py              # GET /health, GET /model-status
│   ├── ml/
│   │   └── tribe_loader.py        # TribeModel.from_pretrained, singleton pattern
│   └── alembic/                   # DB migrations
│       └── versions/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── upload/            # Dropzone, image preview, flow selector
│   │   │   ├── persona/           # Persona form (demographics, cognitive state)
│   │   │   ├── brain/             # R3F canvas, fsaverage5 mesh, activation overlay
│   │   │   └── results/           # ROI cards, recommendation panels
│   │   ├── hooks/
│   │   │   ├── useAnalysisJob.ts  # React Query polling logic
│   │   │   └── useBrainMesh.ts    # GLTF loader + activation color mapping
│   │   ├── store/
│   │   │   └── useAppStore.ts     # Zustand: persona, screens, jobId, result
│   │   ├── api/
│   │   │   └── client.ts          # axios instance, typed API calls
│   │   ├── types/
│   │   │   └── analysis.ts        # TypeScript interfaces for API response shapes
│   │   └── pages/
│   │       ├── Upload.tsx
│   │       ├── Persona.tsx
│   │       ├── Processing.tsx     # Job status display with stage indicator
│   │       └── Results.tsx
│   └── public/
│       └── meshes/
│           ├── fsaverage5_lh.glb  # Left hemisphere mesh (pre-converted)
│           └── fsaverage5_rh.glb  # Right hemisphere mesh (pre-converted)
│
├── model_cache/                   # TRIBEv2 weights (gitignored, ~10GB)
├── .env                           # OPENAI_API_KEY, MODEL_CACHE_PATH, GPU_DEVICE
└── pyproject.toml / package.json
```

### Structure Rationale

- **backend/services/**: Each pipeline stage is its own module. This is the model-swap boundary — `inference.py` is the only file that changes when TRIBEv2 is replaced.
- **backend/core/queue.py**: The FIFO queue and GPU worker are isolated from business logic. No GPU logic lives in routers.
- **backend/ml/**: TribeModel singleton lives here. Loaded once in lifespan, injected into worker via `app.state`. Never instantiated per-request.
- **frontend/public/meshes/**: The fsaverage5 GLTF files are static assets served directly. They are pre-converted from FreeSurfer OBJ format offline (one-time build step). Commit them — they are ~2MB compressed.
- **frontend/types/**: Typed interfaces for the activation JSON prevent runtime errors when mapping vertex arrays to Three.js BufferGeometry attributes.

---

## Architectural Patterns

### Pattern 1: Startup-Loaded Singleton Model

**What:** TRIBEv2 is loaded once into GPU memory during FastAPI lifespan startup. All requests share the same in-memory model instance. No model loading per request.

**When to use:** Any ML model that takes more than 5 seconds to load (TRIBEv2 is estimated 30-60s on first run, model caching reduces subsequent starts to ~5-10s). Also applies when VRAM is constrained.

**Trade-offs:** Server startup is slow (loading TRIBEv2 blocks before first request is served). Health endpoint must return 503 until model is loaded. Graceful shutdown must wait for current inference to complete.

**Example:**
```python
# backend/ml/tribe_loader.py
from tribev2 import TribeModel

_model: TribeModel | None = None

async def load_model(cache_folder: str) -> TribeModel:
    global _model
    import asyncio
    loop = asyncio.get_event_loop()
    # Load in executor to not block event loop during startup
    _model = await loop.run_in_executor(
        None,
        lambda: TribeModel.from_pretrained("facebook/tribev2", cache_folder=cache_folder)
    )
    return _model

def get_model() -> TribeModel:
    if _model is None:
        raise RuntimeError("Model not loaded — call load_model() in lifespan first")
    return _model
```

### Pattern 2: FIFO Queue with Stage Reporting

**What:** The GPU worker processes one job at a time and writes its current stage to the job record. The frontend polls and displays progress granularly (not just a spinner).

**When to use:** Any long-running pipeline (>30s) where user experience requires progress feedback. Required here because TRIBEv2 inference alone takes 60-120s.

**Trade-offs:** Adds DB write overhead per stage transition (negligible). Stage names are coupled between backend and frontend (use an enum). Queue depth is visible in the job record — expose `queue_position` so users know wait time.

**Example:**
```python
# backend/services/inference.py
async def process_analysis_job(job_id: str, app_state):
    async with get_db_session() as db:
        await update_job(db, job_id, status="running", stage="simulation")

    narrative = await run_simulation(job_id, app_state)

    async with get_db_session() as db:
        await update_job(db, job_id, stage="inference")

    activations = await run_tribev2(narrative, app_state.tribe_model)

    async with get_db_session() as db:
        await update_job(db, job_id, stage="processing")

    rois = aggregate_rois(activations)

    async with get_db_session() as db:
        await update_job(db, job_id, stage="recommendations")

    recommendations = await run_recommendations(rois, job_id)

    async with get_db_session() as db:
        await update_job(db, job_id, status="done", result=build_result(rois, recommendations))
```

### Pattern 3: Model-Agnostic Inference Wrapper

**What:** `backend/services/inference.py` is the only module that knows about TRIBEv2. It exposes a single async function: `async def run_brain_inference(text_path: str, model) -> np.ndarray`. All downstream code (ROI aggregation, recommendations, frontend) consumes the `(n_vertices,)` numpy array — not TRIBEv2 APIs.

**When to use:** Any system where the core AI model is expected to be swapped (commercial license replacement planned for BrainX). This is the defensible IP boundary.

**Trade-offs:** Requires disciplined interface design upfront. The wrapper must handle both the text path and video path variants. When the model changes, test suite validates the wrapper produces the same output shape.

**Example:**
```python
# backend/services/inference.py — the only TRIBEv2-coupled file

import torch
import numpy as np
from concurrent.futures import ThreadPoolExecutor

_executor = ThreadPoolExecutor(max_workers=1)

async def run_brain_inference(text_path: str, model) -> np.ndarray:
    """
    Returns: (n_vertices,) float32 array of mean activation per vertex.
    Callers never see TRIBEv2 APIs — swap model here without touching anything else.
    """
    import asyncio
    loop = asyncio.get_event_loop()

    def _blocking_inference():
        with torch.inference_mode():
            df = model.get_events_dataframe(text_path=text_path)
            preds, _segments = model.predict(events=df)
        # (n_timesteps, n_vertices) → (n_vertices,) mean activation
        return preds.mean(axis=0).cpu().numpy().astype(np.float32)

    result = await loop.run_in_executor(_executor, _blocking_inference)
    return result
```

### Pattern 4: Pre-Computed Static Brain Mesh

**What:** The fsaverage5 cortical surface mesh (~20k vertices per hemisphere) is converted from FreeSurfer OBJ format to GLTF/GLB offline (one-time step) and committed to the repo as static assets. The frontend loads it with `useGLTF` and `drei`'s asset caching. Activation values are overlaid via a dynamic vertex color `BufferAttribute`.

**When to use:** Any time a mesh is fixed (neuroimaging standard surfaces don't change) and only the data overlay varies. Avoids fetching the mesh on every analysis.

**Trade-offs:** GLTF files (~1-2MB per hemisphere after compression) are committed to git. Only the activation Float32Array needs to come from the API — mesh geometry is always the same.

**Example:**
```typescript
// frontend/src/hooks/useBrainMesh.ts
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

export function useBrainMesh(activations: Float32Array, hemisphere: 'lh' | 'rh') {
  const { scene } = useGLTF(`/meshes/fsaverage5_${hemisphere}.glb`);
  const mesh = scene.children[0] as THREE.Mesh;

  // Normalize activations 0-1 for color mapping
  const max = Math.max(...activations);
  const normalized = activations.map(v => v / (max || 1));

  // Map to RGB using "hot" colormap (black → red → yellow → white)
  const colors = new Float32Array(normalized.length * 3);
  normalized.forEach((val, i) => {
    colors[i * 3]     = Math.min(1, val * 3);           // R
    colors[i * 3 + 1] = Math.min(1, Math.max(0, val * 3 - 1)); // G
    colors[i * 3 + 2] = Math.min(1, Math.max(0, val * 3 - 2)); // B
  });

  mesh.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return mesh;
}
```

---

## Build Order (Phase Dependencies)

This is the critical dependency chain. Build bottom-up — no layer can be tested without the one below it.

```
Phase 1: Backend Infrastructure
    ├── FastAPI app skeleton + lifespan
    ├── SQLite + SQLAlchemy models (Job, Persona)
    ├── asyncio.Queue + GPU worker loop (stubbed — no TRIBEv2 yet)
    └── POST /analyze + GET /jobs/{id} with fake 3s delay
            ↓ Dependency for:
Phase 2: TRIBEv2 Integration
    ├── PyTorch + CUDA environment validated
    ├── TRIBEv2 model loading in lifespan (singleton)
    ├── inference.py wrapper with ThreadPoolExecutor
    └── Text input pipeline validated end-to-end
            ↓ Dependency for:
Phase 3: GPT-4o Simulation
    ├── simulation.py: multimodal API call (screens + persona → narrative)
    ├── Full pipeline: Upload → Simulate → Infer → Persist
    └── Stage reporting (PENDING → RUNNING:simulation → RUNNING:inference → DONE)
            ↓ Dependency for:
Phase 4: ROI Aggregation + Recommendations
    ├── roi_aggregation.py: nilearn atlas mapping, per-ROI stats
    ├── recommendations.py: GPT-4o structured JSON output
    └── Full result JSON shape finalized
            ↓ Dependency for:
Phase 5: Frontend
    ├── Upload Flow + Persona Form (no backend needed for UI scaffold)
    ├── React Query polling (needs Phase 1 stub API)
    ├── Results display (needs Phase 4 result JSON)
    └── 3D Brain View (needs fsaverage5 GLTF + activation Float32Array)
            ↓ Dependency for:
Phase 6: Demo + Polish
    ├── Pre-built case study (hardcoded result JSON for portfolio use)
    └── Performance tuning, error states, loading UX
```

**Critical path:** Phase 2 (TRIBEv2 environment) is the riskiest. GPU environment setup (CUDA, PyTorch, TRIBEv2 install) can take days and has the most external dependencies. Do Phase 2 first — if the GPU environment fails, the entire pipeline concept must be reconsidered before building anything else.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| OpenAI GPT-4o | Async HTTP via `openai.AsyncOpenAI`. Two calls per job: simulation (vision) + recommendations (text). | Rate limit: 10k tokens/min on tier 1. Persona simulation call with 5 screens can be 3-5k tokens. Build retry with exponential backoff. |
| TRIBEv2 (local GPU) | Python function call via `ThreadPoolExecutor`. Blocking sync call offloaded from async event loop. | Inference takes 60-120s estimated. No timeout imposed — let it complete. Model loaded once at startup, never reloaded per-request. |
| OpenAI API (recommendations) | Second GPT-4o call after ROI aggregation. Structured output via `response_format={"type": "json_object"}`. | Use function calling or JSON mode to enforce the recommendations schema. Parse failures must not crash the job — fall back to raw text. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| FastAPI Router ↔ GPU Worker | asyncio.Queue (job_id strings only — no large objects cross the boundary) | Never put image data or numpy arrays in the queue. Pass job_id, look up paths from DB. |
| GPU Worker ↔ inference.py | Direct function call within the worker coroutine | inference.py is synchronous internally (runs in executor). Worker awaits the executor future. |
| inference.py ↔ roi_aggregation.py | numpy ndarray `(n_vertices,)` float32 | This is the model-swap interface. Shape must not change. Document vertex count (fsaverage5 = 20,004 per hemisphere). |
| Backend API ↔ Frontend | JSON over HTTP (polling). Activation arrays as nested JSON arrays. | Float32Arrays serialized as JSON are large (~80KB per hemisphere). Consider gzip on the result endpoint. SQLite stores as JSON text. |
| Frontend ↔ Static Mesh | GLTF fetch from `/public/meshes/`. Loaded once by `useGLTF`, cached by drei. | Mesh is static. Only activation Float32Array changes between analyses. Do not re-fetch mesh per job. |

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1 user (research preview) | Current architecture — local GPU, SQLite, single uvicorn worker. No changes needed. |
| 10 concurrent users | Upgrade SQLite → PostgreSQL (asyncpg). Keep asyncio.Queue but accept longer wait times (queue depth grows). Add queue position to polling response. |
| 100+ concurrent users | Replace asyncio.Queue with Redis + ARQ for multi-process queue management. Add GPU cloud workers (swap TRIBEv2 for commercial model — required anyway for license compliance). FastAPI stays but moves to multi-worker config. |
| Commercial scale | TRIBEv2 engine swap (commercial model). GPU workers on cloud (A10G/H100). Celery + Redis for distributed job queue. PostgreSQL. CDN for static mesh assets. |

### Scaling Priorities

1. **First bottleneck:** GPU queue depth. At 2+ concurrent users, jobs wait 2-4 minutes. Solve by exposing queue position in the polling response — users can see wait time and the UX becomes acceptable even with serialized inference.
2. **Second bottleneck:** SQLite write lock. Under concurrent polling (many GET /jobs/{id} calls), SQLite handles reads fine but write contention appears. Migrate to PostgreSQL before adding any concurrent users.

---

## Anti-Patterns

### Anti-Pattern 1: Loading TRIBEv2 Per Request

**What people do:** Instantiate `TribeModel.from_pretrained()` inside the route handler or background task function.

**Why it's wrong:** Model loading takes 30-60 seconds and consumes GPU memory that isn't released until garbage collection. Under any concurrency, this causes OOM. Even in single-user mode, every request forces a 30-60s model load before inference begins.

**Do this instead:** Load once in FastAPI `lifespan` startup. Store in `app.state.tribe_model`. Inject via dependency injection or pass directly to worker functions.

### Anti-Pattern 2: Multiple uvicorn Workers

**What people do:** Run `uvicorn main:app --workers 4` to handle concurrent requests.

**Why it's wrong:** Each worker is a separate OS process. Each process loads TRIBEv2 independently. 2 workers = 32GB VRAM required. 4 workers = OOM on any consumer GPU. This is the fastest path to a crashed server.

**Do this instead:** `uvicorn main:app --workers 1`. Handle concurrency within the single process using asyncio (non-blocking routes) and the asyncio.Queue (serialized GPU work).

### Anti-Pattern 3: Sending Image Bytes Through the Queue

**What people do:** Put the full image data (numpy arrays, PIL Images, base64 strings) into the asyncio.Queue to pass to the GPU worker.

**Why it's wrong:** asyncio.Queue is in-memory. 5 screens at 1920x1080 PNG = tens of MB per job in the queue. Under any load, this bloats RAM and makes debugging difficult. The queue becomes an unbounded memory leak.

**Do this instead:** Enqueue only the `job_id` string. Save images to a temp directory keyed by `job_id` during the upload handler. The GPU worker looks up the temp dir from the job_id. Clean up temp dirs after the job completes.

### Anti-Pattern 4: Blocking the Async Event Loop with GPU Inference

**What people do:** Call `model.predict()` directly inside an `async def` function without `run_in_executor`.

**Why it's wrong:** PyTorch CUDA inference is a blocking C++ call. Calling it directly in an async function blocks the entire event loop for the duration of inference (60-120s). No other requests are served during this time — the server appears completely frozen to all other clients including the polling client.

**Do this instead:** Wrap the blocking inference call in `loop.run_in_executor(executor, _blocking_inference)` where `executor` is a `ThreadPoolExecutor(max_workers=1)`. This offloads the blocking call to a thread while the event loop remains free to serve polling requests.

### Anti-Pattern 5: Treating the Recommendations Engine as Part of the GPU Worker

**What people do:** Write GPT-4o recommendation calls inside the GPU worker coroutine, blocking the next queued job from starting.

**Why it's wrong:** The GPT-4o API call for recommendations takes 5-15 seconds over the network. This adds unnecessary serialization to the GPU queue — the GPU is idle during this time but other jobs can't start. The queue is starved for no reason.

**Do this instead:** The GPU worker handles only GPU-bound work (TRIBEv2 inference). After inference completes and activations are persisted, mark stage as "recommendations" and run the GPT-4o call within the worker (it's I/O bound, not GPU-bound). This is acceptable in MVP since the queue is sequential anyway. In v2, move recommendations to a separate async task after GPU work completes.

---

## Sources

- [TRIBEv2 GitHub — demo_utils.py, inference API](https://github.com/facebookresearch/tribev2) — TribeModel class, get_events_dataframe, predict output shape. HIGH confidence.
- [FastAPI Lifespan events docs](https://fastapi.tiangolo.com/advanced/events/) — Startup model loading, asyncio.create_task in lifespan. HIGH confidence.
- [FastAPI: FIFO queue with asyncio.Queue — John Sturgeon](https://johnsturgeon.me/2022/12/10/fastapi-writing-a-fifo-queue-with-asyncioqueue/) — Queue initialization, worker loop, request enqueueing pattern. HIGH confidence.
- [Serving Long-Running Jobs with FastAPI — Medium](https://medium.com/@bhagyarana80/serving-long-running-jobs-with-fastapi-using-webhooks-and-task-polling-860bb0d3e0f9) — PENDING/RUNNING/DONE state machine, polling pattern. HIGH confidence.
- [FastAPI Background Tasks docs](https://fastapi.tiangolo.com/tutorial/background-tasks/) — BackgroundTasks limitations vs asyncio.Queue. HIGH confidence.
- [Building a Production LLM API Server: FastAPI + vLLM 2026](https://blog.premai.io/building-a-production-llm-api-server-fastapi-vllm-complete-guide-2026/) — Queue depth, GPU worker serialization, single-GPU patterns. MEDIUM confidence.
- [Nilearn Surface API docs](https://nilearn.github.io/dev/auto_examples/00_tutorials/plot_surface_101.html) — SurfaceImage, vertex array access, GIfTI export. HIGH confidence.
- [FastAPI asyncio best practices — techbuddies.io](https://www.techbuddies.io/2026/01/05/top-7-fastapi-asyncio-best-practices-for-non-blocking-web-apis/) — run_in_executor pattern for CPU/GPU-bound work. MEDIUM confidence.
- [React Three Fiber GLTF loading docs](https://r3f.docs.pmnd.rs/tutorials/loading-models) — useGLTF, BufferGeometry vertex color patterns. HIGH confidence.

---

*Architecture research for: BrainX — neuro-design / brain response analysis tool*
*Researched: 2026-04-06*
