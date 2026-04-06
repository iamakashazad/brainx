# Stack Research

**Domain:** Neuro-design / Brain response analysis tool (ML-serving + React 3D)
**Researched:** 2026-04-06
**Confidence:** MEDIUM-HIGH (TRIBEv2 GPU specs not officially documented; all other choices HIGH)

---

## Critical Pre-Reading: TRIBEv2 Input Constraint

TRIBEv2 does NOT accept static images as direct input. Its documented inputs are **video files, audio files, and text** — text is auto-converted to speech with word-level timing via gTTS. The model outputs `(n_timesteps, n_vertices)` predictions on the fsaverage5 cortical mesh (~20k vertices) with a 5-second hemodynamic lag offset.

**Implication for BrainX:** The GPT-4o persona simulator output cannot be fed as a static screenshot directly into TRIBEv2. The pipeline must convert the simulated session into a text narrative or a synthesized video/slideshow of the UI screens before TRIBEv2 inference. The recommended approach: generate a text-based "gaze + attention narrative" from the GPT-4o simulation, which TRIBEv2 processes via its text-to-speech pathway. This is the lowest-complexity integration path confirmed by the pyproject.toml dependency on `gtts` and `langdetect`.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Python | 3.11 | Backend runtime | TRIBEv2 pyproject.toml requires `>=3.11`. This is non-negotiable — use exactly 3.11 or 3.12. |
| FastAPI | 0.135.x | REST API framework | De facto standard for Python ML-serving in 2025. Async-native, auto-generates OpenAPI, integrates cleanly with Pydantic v2 and BackgroundTasks. Lighter than Django, more production-capable than Flask. |
| PyTorch | >=2.5.1, <2.7 | TRIBEv2 model runtime | TRIBEv2 pyproject.toml pins `torch>=2.5.1,<2.7`. Do not use 2.7+ — the pin is explicit. Use 2.6.x for widest CUDA 12 compatibility. |
| CUDA | 12.x (12.4 recommended) | GPU acceleration | PyTorch 2.5/2.6 ship CUDA 12.4 wheels. Requires NVIDIA driver 525+ for data center GPUs or 570+ for consumer GPUs. Minimum GPU: RTX 3080 (10GB VRAM) estimated — TRIBEv2 loads LLaMA 3.2-3B + V-JEPA2 + Wav2Vec-BERT simultaneously. Budget 16GB+ VRAM for comfortable inference. |
| React | 19.x | Frontend framework | Latest stable. @react-three/fiber v9 requires React 19. Ecosystem has stabilized around concurrent features and hooks. |
| Vite | 8.x | Frontend build tool | Current standard for React projects. Uses Rolldown + Oxc, no Babel dependency, 58% faster startup than CRA. Requires Node 20.19+ or 22.12+. |
| TypeScript | 5.x | Frontend type safety | Required for 3D scene work — Three.js types are critical for catching mesh/geometry errors at compile time rather than runtime. |

### Python Backend Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tribev2 | latest (from GitHub) | Brain prediction inference | Core model. Install with `pip install -e ".[plotting]"` to get nilearn/pyvista for server-side activation map export. |
| openai | >=1.40.0 | GPT-4o persona simulation | Stable async client. Use `AsyncOpenAI` client with `vision` detail param for screen upload + GPT-4o multimodal calls. |
| uvicorn | 0.34.x | ASGI server | Standard production server for FastAPI. Use `uvicorn --workers 1` — only one worker to prevent GPU memory duplication across processes. |
| pydantic | v2.x | Data validation + serialization | Bundled with FastAPI. Use for all request/response models. Pydantic v2 is 5-17x faster than v1. |
| python-multipart | 0.0.x | File upload parsing | Required by FastAPI for `UploadFile` support. Handles PNG/JPG/WEBP screen uploads. |
| Pillow | 11.x | Image processing | Screen upload pre-processing before GPT-4o. Resize, format-convert, base64-encode for OpenAI API. |
| SQLAlchemy | 2.0.x | ORM / database | Use SQLAlchemy 2.0 directly (not SQLModel — SQLModel still targets SQLAlchemy 1.4.x). Async sessions via `asyncpg` or `aiosqlite`. |
| aiosqlite | 0.20.x | Async SQLite driver | For MVP local development. Single-file DB, zero setup, sufficient for single-user research preview. Swap for asyncpg+PostgreSQL when scaling. |
| alembic | 1.14.x | Database migrations | Schema migrations as models evolve. Works with SQLAlchemy 2.0 directly. |
| python-dotenv | 1.x | Env config management | API keys (OPENAI_API_KEY), model cache paths, GPU device selection out of code. |
| nilearn | 0.11.x | Brain activation map export | Server-side: convert TRIBEv2 `(n_timesteps, n_vertices)` output to GIfTI surface overlays for frontend consumption. Included in TRIBEv2 `[plotting]` extras. |
| scipy | 1.14.x | Signal processing | Aggregating TRIBEv2 time-series output into per-region summary statistics (mean, peak activation). Pulled in by nilearn. |
| httpx | 0.27.x | Async HTTP client | For any internal service calls. Also used for OpenAI client internals. |

### Frontend Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @react-three/fiber | 9.5.x | React renderer for Three.js | Core 3D framework. v9 targets React 19. Use for the entire 3D brain canvas component. |
| @react-three/drei | 9.x | Helper components for R3F | Provides `<OrbitControls>`, `<Html>`, `<shaderMaterial>`, environment presets. Avoids rewriting boilerplate Three.js patterns. |
| three | 0.170.x | WebGL engine | Peer dependency of R3F. Import geometry primitives, buffer attributes, and materials directly for custom brain mesh construction. |
| @niivue/niivue | 0.68.x | Neuroimaging volume viewer | FALLBACK/SUPPLEMENTAL only. Use for displaying standard NIfTI volumes if needed. Note: niivue-react (the React wrapper) does NOT yet support surface meshes — use only if switching to volumetric brain display. Do not use as primary 3D visualization engine for surface meshes. |
| zustand | 5.x | Global state management | Lightweight, no boilerplate. Manage analysis job state (pending/running/complete), brain activation data, and persona config across components. Avoid Redux — overkill for this app. |
| @tanstack/react-query | 5.x | Server state + async data | Job polling, result fetching, cache management for long-running TRIBEv2 inference jobs. Replace custom useEffect polling loops. |
| react-router-dom | 7.x | Client-side routing | Upload flow → Simulation → Analysis → Results multi-page navigation. |
| axios | 1.8.x | HTTP client | File upload progress tracking (multipart). React Query uses this internally or use fetch — either works. |
| react-dropzone | 14.x | File upload UI | Drag-and-drop screen upload with MIME type validation. Handles PNG/JPG/WEBP. |
| tailwindcss | 4.x | Utility CSS | Vite-native in v4, no PostCSS config required. Fast iteration on layout without CSS files. |
| @radix-ui/react-* | 2.x | Accessible UI primitives | Dialogs, sliders (cognitive state params), tooltips for brain region labels. Unstyled, pair with Tailwind. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vite 8 | Frontend dev server + bundler | `npm create vite@latest -- --template react-ts`. HMR is instant. |
| pytest | Python testing | Standard. Use `pytest-asyncio` for async FastAPI route testing. |
| httpx | FastAPI test client | Use `httpx.AsyncClient` with `app=app` for async endpoint tests — do not use `TestClient` for async routes. |
| black | Python formatter | Enforced formatting. No config needed — defaults are correct. |
| ruff | Python linter | Replaces flake8 + isort + dozens of plugins. Extremely fast. |
| ESLint | JS/TS linter | Vite scaffolds this. Use `eslint-config-react-app` or the recommended flat config. |
| conda / pyenv | Python version isolation | TRIBEv2 requires Python 3.11. Use `conda create -n brainx python=3.11` to avoid system conflicts. |
| torch install script | PyTorch + CUDA install | Install PyTorch separately before tribev2: `pip install torch==2.6.0 --index-url https://download.pytorch.org/whl/cu124` |

---

## Installation

```bash
# --- Backend ---
# 1. Create isolated Python 3.11 environment
conda create -n brainx python=3.11
conda activate brainx

# 2. Install PyTorch with CUDA 12.4 FIRST (tribev2 depends on this)
pip install torch==2.6.0 torchvision==0.21.0 --index-url https://download.pytorch.org/whl/cu124

# 3. Clone and install TRIBEv2 with plotting extras
git clone https://github.com/facebookresearch/tribev2.git
cd tribev2
pip install -e ".[plotting]"
cd ..

# 4. Install backend dependencies
pip install fastapi==0.135.2 uvicorn[standard] python-multipart Pillow openai httpx
pip install sqlalchemy[asyncio] aiosqlite alembic python-dotenv
pip install scipy ruff black pytest pytest-asyncio

# --- Frontend ---
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install @react-three/fiber @react-three/drei three
npm install @tanstack/react-query zustand react-router-dom axios react-dropzone
npm install tailwindcss @radix-ui/react-dialog @radix-ui/react-slider @radix-ui/react-tooltip
npm install -D @types/three
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| FastAPI | Flask | Never for this project — Flask has no native async, no BackgroundTasks, no OpenAPI generation. |
| FastAPI | TorchServe / Ray Serve | If scaling to multi-user cloud deployment. For local single-GPU research preview, they add infrastructure overhead without benefit. |
| SQLAlchemy 2.0 + aiosqlite | SQLModel | SQLModel still targets SQLAlchemy 1.4.x, lacks full async ORM support. Avoid until SQLModel 1.0 ships with SQLAlchemy 2.0 support. |
| @react-three/fiber | NiiVue (@niivue/niivue) | If switching to volumetric (NIfTI) brain display instead of surface meshes. NiiVue excels at volume rendering but its React wrapper doesn't support surface meshes yet. |
| @react-three/fiber | BrainBrowser | BrainBrowser is unmaintained (last commit years ago), uses legacy three.js patterns. Avoid. |
| zustand | Redux Toolkit | Redux is overkill for this app's state complexity. Zustand provides 90% of the benefit with 10% of the API surface. |
| Vite 8 | Next.js | No SSR needed — this is a local research tool. Next.js adds complexity (server components, routing conventions) without benefit. |
| Python 3.11 | Python 3.12+ | Python 3.12 likely works but TRIBEv2 pyproject.toml specifies `>=3.11`. Use 3.11 for guaranteed compatibility until tribev2 explicitly tests 3.12+. |
| aiosqlite (SQLite) | PostgreSQL + asyncpg | Use PostgreSQL if this becomes a multi-user or deployed service. For local single-user research preview, SQLite is sufficient and zero-config. |
| Text narrative pipeline | Video slideshow pipeline | If TRIBEv2 text pathway produces poor results, convert screens to a timed MP4 slideshow (moviepy, already in tribev2 deps) and feed as video input. More complex but gives TRIBEv2 richer visual signal. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| PyTorch >= 2.7 | TRIBEv2 pyproject.toml pins `torch<2.7`. Using 2.7+ will cause dependency conflicts at install time. | `torch==2.6.0` with cu124 wheels |
| Python 3.10 or older | TRIBEv2 requires `>=3.11`. Type hint syntax used in the codebase requires 3.11+. | Python 3.11 (conda recommended) |
| SQLModel | Still targets SQLAlchemy 1.4.x; async support is incomplete and undocumented. Will cause subtle bugs with concurrent requests. | SQLAlchemy 2.0 with async sessions directly |
| niivue-react for surface meshes | niivue-react explicitly states "meshes not yet supported" (as of v0.68). The React wrapper only supports volumetric (NIfTI) data currently. | @react-three/fiber with custom BufferGeometry for fsaverage5 mesh |
| Multiple uvicorn workers | Each worker loads TRIBEv2 into GPU memory independently. 2 workers = 2x VRAM. Will OOM on any consumer GPU. | `uvicorn --workers 1` with BackgroundTasks or asyncio.Queue for concurrency |
| Celery for GPU task queue | Celery does not support asyncio natively; requires separate broker (Redis/RabbitMQ); massive overhead for single-GPU local tool. | FastAPI `BackgroundTasks` for MVP; `asyncio.Queue` with a single GPU worker coroutine if you need queuing |
| BrainBrowser | Unmaintained JavaScript library. Last meaningful commit was years ago. Tight coupling to legacy three.js API. | @react-three/fiber |
| Create React App | Deprecated. No longer maintained by Meta. Significantly slower than Vite. | Vite 8 with react-ts template |
| flask-cors, django-cors-headers | Django/Flask specific. Not needed. | FastAPI has built-in `CORSMiddleware` from starlette |

---

## TRIBEv2 Integration Architecture

### Input Pipeline (Critical Design Decision)

TRIBEv2 does not accept images directly. BrainX must bridge the GPT-4o simulation output to a TRIBEv2-compatible format:

**Recommended path (text narrative):**
1. GPT-4o receives screen images + persona definition
2. GPT-4o generates a text narrative: "The user opens the app on mobile while commuting. They see the hero headline first, pause on the CTA for 2 seconds, then scroll past the pricing section without reading it..."
3. TRIBEv2 receives this text via `text_path` parameter
4. TRIBEv2 internally converts text to speech (gTTS) with word-level timing, then runs inference
5. Output: `(n_timesteps, n_vertices)` activation array

**Alternative path (video slideshow):**
1. GPT-4o generates a structured session: `[{screen: 1, duration: 3.2s, focus: "headline"}, ...]`
2. moviepy stitches screen images into timed MP4 (each screen displayed for GPT-4o-specified duration)
3. TRIBEv2 processes the MP4 via `video_path` parameter
4. Output: `(n_timesteps, n_vertices)` activation array
5. Use this path if text-only produces poor results — gives TRIBEv2 visual signal

### Model Loading Pattern

```python
# Load once at startup — do NOT load per-request
from tribev2 import TribeModel

# App lifespan context (FastAPI)
model: TribeModel | None = None

async def lifespan(app: FastAPI):
    global model
    model = TribeModel.from_pretrained("facebook/tribev2", cache_folder="./model_cache")
    yield
    # cleanup if needed

app = FastAPI(lifespan=lifespan)
```

### GPU Inference Pattern

```python
import torch
import asyncio
from concurrent.futures import ThreadPoolExecutor

executor = ThreadPoolExecutor(max_workers=1)  # Single GPU worker

async def run_tribev2_inference(text_path: str) -> dict:
    loop = asyncio.get_event_loop()
    
    def _inference():
        with torch.inference_mode():
            df = model.get_events_dataframe(text_path=text_path)
            preds, segments = model.predict(events=df)
        return preds.cpu().numpy(), segments
    
    preds, segments = await loop.run_in_executor(executor, _inference)
    return {"activations": preds.tolist(), "segments": segments}
```

Key rules:
- `torch.inference_mode()` — disables gradient tracking, 15-30% faster than `no_grad()`
- `run_in_executor` with a `ThreadPoolExecutor(max_workers=1)` — offloads blocking GPU work from the async event loop without spawning competing GPU processes
- `.cpu().numpy()` before JSON serialization — GPU tensors cannot be serialized

### Output Shape and Meaning

TRIBEv2 outputs `(n_timesteps, n_vertices)` where `n_vertices = ~20,000` (fsaverage5 mesh). For BrainX:
- Aggregate across time to get per-region peak activation: `np.max(preds, axis=0)` or `np.mean(preds, axis=0)`
- Map vertex indices to anatomical regions using nilearn's Destrieux or Desikan-Killiany atlas
- Export as GIfTI `.func.gii` file for frontend consumption, or serialize as JSON vertex array

### Frontend Brain Mesh Rendering

TRIBEv2 outputs are on the fsaverage5 surface. The frontend must:
1. Load the fsaverage5 mesh (OBJ or GLTF converted from FreeSurfer surface) — ship as a static asset
2. Map the `~20k` activation values to vertex colors using a colormap (viridis, hot)
3. Render with @react-three/fiber using `THREE.BufferGeometry` with custom vertex color attribute

```typescript
// Conceptual R3F activation overlay
const geometry = new THREE.BufferGeometry();
// positions: Float32Array of fsaverage5 vertices (preloaded)
// activations: Float32Array from TRIBEv2 output (normalized 0-1)
const colors = activationsToColors(activations, colormap='hot');
geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
```

---

## Stack Patterns by Variant

**If user GPU has < 16GB VRAM:**
- Use fp16 inference: load model with `torch.float16`
- Expect ~40% VRAM reduction at minor accuracy cost
- TRIBEv2 does not document fp16 support explicitly — test and flag as LOW confidence

**If pipeline text-to-brain produces poor differentiation:**
- Switch to video slideshow path (moviepy MP4) — gives TRIBEv2 visual signal from actual screen content
- V-JEPA2 (video encoder inside TRIBEv2) is the strongest signal for visual design content

**If SQLite becomes a bottleneck:**
- Swap `aiosqlite` for `asyncpg` + PostgreSQL with zero SQLAlchemy code changes (same async session API)
- Run PostgreSQL in Docker for local dev parity

**If TRIBEv2 model swap occurs (commercial engine):**
- The inference wrapper (`run_tribev2_inference`) is the only module that changes
- All downstream code (activation map export, recommendations engine, frontend rendering) is model-agnostic

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| torch==2.6.0 | CUDA 12.4, Python 3.11/3.12 | TRIBEv2 pyproject.toml upper-bounds at <2.7. Use cu124 wheels. |
| tribev2 (GitHub main) | torch>=2.5.1,<2.7, numpy==2.2.6 | numpy is pinned to 2.2.6 exactly — do not upgrade. |
| @react-three/fiber@9.5.x | react@19.x, three@0.170.x | R3F v9 dropped React 18 support. three must be 0.155+ for R3F v9. |
| @react-three/drei@9.x | @react-three/fiber@9.x | Must match major version of fiber. |
| FastAPI@0.135.x | pydantic@2.x, starlette@0.46.x | FastAPI bundles starlette. Do not install starlette separately. |
| SQLAlchemy@2.0.x | aiosqlite@0.20.x | asyncio dialect requires `create_async_engine("sqlite+aiosqlite://...")`. |
| uvicorn | Python 3.11 | Use `uvicorn[standard]` to get websockets + httptools for performance. |

---

## GPU Requirements (Estimated, LOW confidence — not officially documented by Meta)

TRIBEv2 loads three large encoders simultaneously:
- LLaMA 3.2-3B (text): ~6-8GB VRAM in fp32, ~3-4GB in fp16
- V-JEPA2 (video): comparable scale
- Wav2Vec-BERT (audio): smaller, ~1-2GB

**Conservative estimate:** 16GB VRAM minimum for fp32 inference (RTX 3080 Ti, RTX 4080, A10G).
**fp16 estimate:** 10-12GB VRAM (RTX 3080 10GB may be tight; RTX 4070 12GB or RTX 4080 16GB safer).

Apple Silicon (MPS backend) is untested with TRIBEv2. CUDA is the only confirmed GPU backend.

---

## Sources

- [TRIBEv2 GitHub — pyproject.toml](https://github.com/facebookresearch/tribev2/blob/main/pyproject.toml) — Python version, PyTorch pin, numpy pin, dependencies. HIGH confidence.
- [TRIBEv2 Hugging Face model card](https://huggingface.co/facebook/tribev2) — Input/output format, inference API, fsaverage5 output. HIGH confidence.
- [Meta AI Blog — TRIBE v2 announcement](https://ai.meta.com/blog/tribe-v2-brain-predictive-foundation-model/) — Training scale, model architecture, capabilities. HIGH confidence.
- [MarkTechPost — TRIBEv2 overview](https://www.marktechpost.com/2026/03/26/meta-releases-tribe-v2-a-brain-encoding-model-that-predicts-fmri-responses-across-video-audio-and-text-stimuli/) — Architecture components (LLaMA 3.2, V-JEPA2, Wav2Vec-BERT). MEDIUM confidence.
- [FastAPI release notes](https://fastapi.tiangolo.com/release-notes/) — Version 0.135.x confirmed latest stable. HIGH confidence.
- [@react-three/fiber npm](https://www.npmjs.com/package/@react-three/fiber) — v9.5.x, React 19 requirement. HIGH confidence.
- [niivue-react GitHub](https://github.com/niivue/niivue-react) — Mesh support status ("not yet supported"). HIGH confidence.
- [@niivue/niivue npm](https://www.npmjs.com/package/@niivue/niivue) — v0.68.1, GIfTI/CIfTI overlay support. HIGH confidence.
- [PyTorch 2.7 release blog](https://pytorch.org/blog/pytorch-2-7/) — CUDA 12.8, Blackwell support context. MEDIUM confidence.
- [SQLAlchemy + FastAPI async patterns](https://testdriven.io/blog/fastapi-sqlmodel/) — SQLModel compatibility limitations with SQLAlchemy 2.0. MEDIUM confidence.
- [FastAPI background tasks docs](https://fastapi.tiangolo.com/tutorial/background-tasks/) — BackgroundTasks vs Celery decision. HIGH confidence.
- [Python background task comparison 2025](https://devproportal.com/languages/python/python-background-tasks-celery-rq-dramatiq-comparison-2025/) — Celery asyncio limitations. MEDIUM confidence.

---

*Stack research for: BrainX — neuro-design / brain response analysis tool*
*Researched: 2026-04-06*
