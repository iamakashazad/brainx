# Project Research Summary

**Project:** BrainX
**Domain:** Neuro-design / AI-simulated brain response analysis (ML-serving + GPT-4o + TRIBEv2 + React 3D)
**Researched:** 2026-04-06
**Confidence:** MEDIUM-HIGH

## Executive Summary

BrainX is a neuro-design tool that combines GPT-4o persona simulation with Meta's TRIBEv2 brain prediction model to produce context-aware brain activation maps for UI screens, ads, and static content. The recommended approach is a single-GPU local stack: Python 3.11 + FastAPI + TRIBEv2 (via text or video input pathway) on the backend, React 19 + @react-three/fiber for the 3D brain visualization on the frontend, and a strict single-worker asyncio.Queue architecture to prevent GPU OOM errors. The core pipeline is: upload screens → GPT-4o simulates a persona's interaction → TRIBEv2 runs brain prediction on the simulated session → ROI aggregation maps cortical vertices to five named circuits → GPT-4o generates grounded copy/design recommendations. This pipeline is the primary differentiator and must be treated as an atomic unit — every phase builds toward it.

The biggest competitive advantage is the simulation step: no existing competitor (Neurons AI, EyeQuant, Brainsight, Attention Insight) runs context simulation before brain prediction. All competitors analyze static images. BrainX processes a realistic usage session, enabling cognitive state, environment, and attention span to influence the brain response output. The five-circuit coverage (attention, cognitive load, emotional response, memory encoding, reward-related cortex) also exceeds what any competitor reports today. The free, research-preview framing under TRIBEv2's non-commercial license is a distribution advantage while building audience ahead of a commercial launch with a swapped brain model.

The critical risks are all technical and well-documented. TRIBEv2 has three confirmed GitHub bugs (numpy exact pin, TemporalSmoothing gradient freeze, missing subcortical checkpoint) that must be patched at clone time. The text narrative pathway through TRIBEv2 may produce undifferentiated activation maps because gTTS bypasses the V-JEPA2 visual encoder — both the text and video slideshow paths must be built in Phase 1 so a differentiation test can gate which path ships. GPT-4o simulation hallucination must be constrained with structured outputs and explicit screen-grounding prompts from the start, or downstream recommendations will reference fictional interface elements. None of these risks are blockers; all have documented mitigation strategies.

---

## Key Findings

### Recommended Stack

The stack has one non-negotiable constraint: Python 3.11 (TRIBEv2 pyproject.toml requires `>=3.11`) and PyTorch `2.6.x` with CUDA 12.4 (tribev2 pins `torch>=2.5.1,<2.7` — PyTorch 2.7+ will conflict at install time). On the frontend, @react-three/fiber v9 requires React 19; niivue-react explicitly does not support surface meshes and must not be used as the primary 3D engine. The FastAPI + uvicorn single-worker pattern is mandatory architecture, not a preference — multiple uvicorn workers will each load TRIBEv2 independently and OOM any consumer GPU.

**Core technologies:**
- Python 3.11 + conda isolation: TRIBEv2 requires exactly 3.11; conda avoids system Python conflicts
- FastAPI 0.135.x: async-native ML serving with BackgroundTasks, OpenAPI generation, and CORSMiddleware built in
- PyTorch 2.6.0 + CUDA 12.4: only version range that satisfies TRIBEv2's hard pin; install before tribev2
- TRIBEv2 (GitHub, with `[plotting]` extras): core brain prediction model; requires two patches at clone time
- OpenAI SDK >=1.40.0 (AsyncOpenAI): GPT-4o multimodal simulation and recommendations; structured outputs require v1.40+
- SQLAlchemy 2.0 + aiosqlite: async ORM for job/persona persistence; SQLModel must be avoided (targets SQLAlchemy 1.4.x)
- React 19 + Vite 8: frontend runtime; Vite 8 is Rolldown-based, no Babel, Node 20.19+ required
- @react-three/fiber 9.5.x + three 0.170.x: 3D brain mesh rendering with vertex color activation overlay
- zustand 5.x + @tanstack/react-query 5.x: global state and long-running job polling respectively
- nilearn 0.11.x: vertex-to-ROI mapping via Destrieux atlas; included in TRIBEv2 `[plotting]` extras

**Critical version constraints:**
- `torch<2.7` — hard upper bound from TRIBEv2's pyproject.toml
- `numpy==2.2.6` — TRIBEv2 exact pin (must patch to `>=2.2.6,<3` to avoid install conflicts with nilearn/scipy)
- `@react-three/fiber@9.x` requires `react@19.x` — do not use with React 18
- `uvicorn --workers 1` — never more; each worker duplicates VRAM usage

### Expected Features

BrainX's feature scope is well-defined. Every competitor provides attention heatmaps, per-screen scores, and A/B comparison — these are table stakes. BrainX's differentiators (persona simulation, cognitive state variables, five-circuit coverage, multi-screen flow, 3D brain visualization, grounded copy rewrites) are all absent from competitor offerings and represent genuine gaps in the market.

**Must have (table stakes):**
- Attention heatmap overlay — standard visual language of the domain; absence signals incompleteness
- Per-screen brain metric scores (0–100, named) — required for non-neuroscientist audience
- Actionable copy/design recommendations — must be element-level, not generic; generic = trust destroyed
- Content upload (1–5 screens, PNG/JPG/WEBP) — minimum viable input path
- Session persistence and history — stateless tool reads as a toy
- Demo / case study (real pre-run job, not static mockup) — critical for zero-upload evaluators

**Should have (differentiators — all P1 at launch):**
- Persona builder with cognitive state parameters (stress, attention span, environment, device) — the variable that separates BrainX from every competitor
- GPT-4o persona simulation producing structured session log — core architectural differentiator
- Brain activation maps covering all 5 circuits: attention, cognitive load, emotional response, memory encoding, reward-related cortex
- 3D brain visualization — credibility signal; visually distinctive for demos
- Specific copy rewrite suggestions (grounded in ROI data, not generic GPT output)
- Multi-screen flow analysis (temporal continuity across up to 5 screens) — no competitor does this

**Defer (v1.x):**
- Variant A/B comparison — add once session persistence is stable; users will request it explicitly
- Shareable read-only report URL — add when users are exporting PDFs to share; requires cloud result storage decision
- Multiple personas per session (sequential queue) — add when users manually re-run with different personas

**Defer (v2+):**
- Video content analysis — 5x pipeline complexity increase; requires commercial brain model license
- Figma plugin — separate engineering surface; build after web tool is validated
- Team collaboration and auth — full SaaS infrastructure; post-commercial launch

### Architecture Approach

BrainX uses a pipeline architecture where five sequential stages execute inside a single GPU worker coroutine consuming a FIFO asyncio.Queue. The frontend submits a job via `POST /analyze`, receives a job ID, and polls `GET /jobs/{id}` with React Query every 2.5 seconds until completion. No stage can be parallelized without GPU memory contention — the sequential design is correct. The model-swap boundary is deliberately isolated: `backend/services/inference.py` is the only file that changes when TRIBEv2 is replaced with a commercial engine, making the interpretation/recommendations layer the defensible IP.

**Major components:**
1. React Upload Flow + Persona Form — collects 1–5 screen images and cognitive state persona; writes to Zustand store; sends multipart POST to FastAPI
2. FastAPI Upload Handler + Job Registry (SQLite) — validates uploads, creates PENDING job record, enqueues job UUID to asyncio.Queue; returns 202 immediately
3. asyncio.Queue + GPU Worker Coroutine (single) — processes jobs FIFO: simulation → TRIBEv2 inference → ROI aggregation → recommendations → persist result
4. GPT-4o Simulation Service — receives base64 screen images + persona; outputs text narrative (or structured session JSON for video path) grounded to visible screen content
5. TRIBEv2 Inference Service (ThreadPoolExecutor x1) — runs blocking GPU inference off the async event loop; outputs `(n_timesteps, ~20k vertices)` cortical activation array
6. ROI Aggregation (nilearn + Destrieux atlas) — maps cortical vertex activations to five named circuits using cortical proxies (not subcortical labels)
7. Recommendations Engine (GPT-4o structured output) — receives ROI stats + persona + screen context; outputs structured JSON with specific rewrites citing ROI scores
8. React 3D Brain View (@react-three/fiber) — loads fsaverage5 GLTF meshes from `frontend/public/meshes/`; updates vertex color attributes directly (no React re-render on activation update)

### Critical Pitfalls

1. **numpy exact pin (`==2.2.6`) breaks install environment** — Patch tribev2's `pyproject.toml` from `"numpy==2.2.6"` to `"numpy>=2.2.6,<3"` before running `pip install -e ".[plotting]"`. Use a completely isolated conda environment. Address in Phase 1 setup.

2. **Multiple uvicorn workers OOM the GPU** — TRIBEv2 loads three large encoders (~14–16GB VRAM total). Each additional worker duplicates this. Always run `uvicorn --workers 1` and use `asyncio.Queue` with a single GPU worker coroutine. Do not use `BackgroundTasks` for GPU jobs. Address in Phase 1 backend architecture.

3. **TRIBEv2 text pathway produces undifferentiated activation maps** — gTTS synthetic speech has no emotional prosody variation; the V-JEPA2 video encoder is bypassed on text input. Build both the text narrative path AND the video slideshow (moviepy MP4) fallback in Phase 1. Run a differentiation test on maximally different inputs before declaring Phase 1 complete. If text path fails the test, switch to video path.

4. **GPT-4o simulation hallucinates non-existent screen elements** — Use OpenAI structured outputs (`json_schema` mode) for the simulation call, forcing screen index references. Include explicit system prompt constraints: "describe only what is visible." Send images with `detail: "high"`. Add a post-generation validation pass. Address in Phase 2; build schema before connecting to TRIBEv2.

5. **TRIBEv2 only predicts cortical surface — subcortical structures are missing** — The reward circuit (striatum, nucleus accumbens) and deeper hippocampus are NOT in fsaverage5 cortical mesh. Use cortical proxies: orbitofrontal cortex + anterior cingulate for "reward-related cortex," insula + anterior cingulate for "emotional response," parahippocampal cortex for "memory encoding." Never label output as "striatum" or "nucleus accumbens." Apply correct labels in ROI aggregation from Phase 1 and never ship anatomically incorrect labels.

6. **Recommendations engine produces generic GPT output uncoupled from brain data** — Without strict prompt constraints, GPT-4o produces generic UX advice indistinguishable from non-AI tools. Use structured outputs with `evidence_roi` and `activation_score` fields on every recommendation. Include negative examples in the prompt. Run a blind evaluation test (two opposite activation profiles must produce demonstrably different, score-citing recommendations) before shipping Phase 3.

---

## Implications for Roadmap

Based on research, the dependency chain is strict and linear: persona + content are required before simulation, simulation is required before TRIBEv2 inference, inference is required before ROI aggregation, and ROI aggregation is required before recommendations or 3D visualization. This forces a sequential phase structure following the pipeline stages. No feature can be built "ahead of" its upstream dependency.

### Phase 1: Foundation and TRIBEv2 Integration

**Rationale:** The riskiest and least-understood part of the system is TRIBEv2 itself — three open GitHub bugs, unverified GPU requirements, uncertain text pathway viability. De-risk it first before building any user-facing features. The single-worker queue architecture must also be established before any other backend work or it will require a rewrite.

**Delivers:** Working backend skeleton with TRIBEv2 inference running end-to-end on a test text input; both text and video slideshow pathways implemented; differentiation test passing; all TRIBEv2 patches applied; asyncio.Queue + single GPU worker operational; SQLite job persistence working; `GET /model-status` health endpoint.

**Addresses:** Environment setup, TRIBEv2 installation and patching (numpy pin, TemporalSmoothing bug), ROI labeling with cortical proxies, asyncio.Queue architecture, model singleton loading pattern.

**Avoids:** numpy pin breakage, GPU OOM from multiple workers, undifferentiated activation maps shipping as "working," anatomically incorrect subcortical labels, model loading per-request.

**Research flag:** Needs phase-level research on TRIBEv2 inference behavior (text vs. video path differentiation is unverified empirically). Standard patterns for FastAPI + SQLite + asyncio.Queue — no research needed.

### Phase 2: GPT-4o Simulation Pipeline

**Rationale:** The simulation layer is the core architectural differentiator. It must be built and validated in isolation before connecting it to TRIBEv2, because simulation prompt failures (hallucination, unstructured output) will poison TRIBEv2 input and produce meaningless activation maps. Structured output schema and hallucination validation must gate this phase.

**Delivers:** Working GPT-4o simulation service that accepts base64 screen images + persona definition and produces a validated, schema-conformant session narrative. Hallucination check passing. Stage-level job status reporting (simulation → inference → processing → recommendations) visible in frontend polling. Image resize + JPEG compression pipeline (1920px max, <500KB per screen) before GPT-4o API calls.

**Addresses:** GPT-4o structured outputs (`json_schema` mode), simulation hallucination prevention, image token cost control, job status stage transitions.

**Avoids:** Fictional screen element references propagating into TRIBEv2 input, JSON parse failures in the frontend, missing stage progress during the 60–120s wait.

**Research flag:** Standard patterns — OpenAI structured outputs are well-documented. No phase research needed.

### Phase 3: Full Pipeline Integration and Recommendations Engine

**Rationale:** With TRIBEv2 working (Phase 1) and GPT-4o simulation validated (Phase 2), connect the full pipeline end-to-end: simulation → inference → ROI aggregation → recommendations. The recommendations engine is the highest trust-risk component — generic output destroys the tool's credibility. Blind evaluation test is mandatory before this phase completes.

**Delivers:** Complete analysis pipeline from screen upload + persona definition to structured recommendations JSON. ROI aggregation producing five named circuit scores. Recommendations engine with structured output schema citing ROI scores. `POST /analyze` → job queue → DONE lifecycle working end-to-end. Full result stored in SQLite.

**Addresses:** ROI-to-circuit mapping via nilearn Destrieux atlas, recommendations prompt with evidence_roi citation requirements, GPT-4o two-call separation (simulation and recommendations are always separate calls), raw activation array storage strategy (pre-aggregated stats in DB, `.npy` vertex arrays on disk).

**Avoids:** Generic recommendations uncoupled from brain data, single GPT-4o call attempting both simulation and recommendations, activation JSON bloating SQLite (10–20MB per job).

**Research flag:** Standard patterns — ROI aggregation with nilearn is well-documented. Recommendations prompt engineering may need iteration; plan for it within the phase.

### Phase 4: Frontend — Upload, Persona, and Results Views

**Rationale:** Build all frontend UI after the backend pipeline is proven. A frontend built against a broken pipeline wastes iteration cycles. The 3D brain visualization requires particular care: vertex color updates must write directly to Three.js buffer attributes (not trigger React re-renders) or frame rate degrades to under 30fps.

**Delivers:** Complete React frontend with Upload Flow (react-dropzone, 1–5 screens), Persona Form (demographics, cognitive state, environment), Processing view with stage-level progress indicators, Results view with attention heatmap overlay + 3D brain visualization (R3F, fsaverage5 GLTF meshes) + per-screen metric scores + recommendations panel. Session history list.

**Addresses:** fsaverage5 GLTF meshes served from `frontend/public/meshes/` (no CORS issues), React Query polling at 2500ms intervals, vertex color attribute updates bypassing React re-render, Zustand store for persona/job/result state, attention heatmap overlay preceding 3D brain view in the results layout.

**Avoids:** CORS errors on mesh loading, React re-renders on every activation update (choppy 3D animation), 3D brain as first-seen element (leads with familiar heatmap overlay first), raw Brodmann area codes in UI (all labels must be consumer-friendly).

**Research flag:** @react-three/fiber vertex color update pattern is well-documented in R3F performance docs. Standard patterns — no phase research needed.

### Phase 5: Session Persistence, Demo Case Study, and Polish

**Rationale:** Session persistence (history, re-loadable results) upgrades the tool from toy to credible research instrument. The demo case study is load-bearing for any user who arrives without their own content — it must be a real pre-run job in the DB, not a static mockup. This phase should also close the "looks done but isn't" checklist from PITFALLS.md before any public sharing.

**Delivers:** Sessions history view with persona + content thumbnails + date. Full result re-loadable from DB/disk without re-running inference. Pre-built demo case study (real analysis stored in DB, loads within 3 seconds, uses a representative real-world screen). Job timeout watchdog (300s max, auto-transition to ERROR with message). Max queue depth check on `POST /analyze` (return 429 if queue >= 5). All "looks done but isn't" checklist items verified.

**Addresses:** Session persistence, demo loading from DB (not triggering inference), job timeout recovery, queue protection against fill attacks, UI activation score display (0–100 scale with qualitative labels: Low/Moderate/High/Very High).

**Avoids:** Stateless tool perception, demo that triggers real inference (slow and fragile), silent failure leaving jobs in RUNNING forever, Brodmann codes in any user-visible label.

**Research flag:** Standard patterns — no phase research needed.

### Phase Ordering Rationale

- TRIBEv2 risks must be eliminated before any user-facing work — the text pathway viability is unverified and discovering it fails after building the full frontend wastes a phase of work.
- Simulation pipeline is separated from TRIBEv2 integration because simulation prompt failures will corrupt inference input — validating them independently prevents cascading test failures.
- Full pipeline integration (Phase 3) connects previously validated components — this order makes failures localizable.
- Frontend (Phase 4) builds against a known-good API contract — prevents building UI components against moving backend behavior.
- Polish and demo (Phase 5) comes last because the demo requires real pipeline output; it cannot be mocked.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** TRIBEv2 text vs. video pathway differentiation is empirically unverified — the text gTTS pathway's ability to produce meaningfully different activation maps for different designs has no published benchmarks for UI description tasks. Needs an investigation spike at the start of Phase 1 to determine which path is primary.
- **Phase 1:** GPU VRAM requirements for TRIBEv2 are LOW confidence estimates (~14–16GB fp32, ~10–12GB fp16). Actual requirements depend on model checkpoint specifics not documented by Meta. Needs early hardware validation.

Phases with standard patterns (skip research-phase):
- **Phase 2:** OpenAI structured outputs and GPT-4o multimodal vision are thoroughly documented. Prompt engineering patterns for simulation are available via SimAB and synthetic user testing literature.
- **Phase 3:** nilearn atlas lookup patterns are well-documented. FastAPI async patterns are standard.
- **Phase 4:** @react-three/fiber 3D scene patterns and React Query polling are well-documented with official examples.
- **Phase 5:** Session persistence with SQLAlchemy async is standard. No novel patterns required.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core library versions verified against TRIBEv2 pyproject.toml (official source). PyTorch pin, numpy pin, R3F React 19 requirement all confirmed. GPU VRAM estimate is LOW confidence — only one confirmed OOM data point (T4 14.56GB) from GitHub issue #28. |
| Features | MEDIUM-HIGH | Competitor feature parity verified via official docs (Neurons AI, EyeQuant, Brainsight). TRIBEv2 capability claims (5 circuits) depend on cortical proxy labeling, not direct subcortical measurement — this is a framing decision, not a verified output. |
| Architecture | HIGH | Pipeline structure follows confirmed TRIBEv2 input/output shape (text_path, video_path, `(n_timesteps, n_vertices)` output). asyncio.Queue pattern is well-established for single-GPU ML serving. API response shape is speculative until TRIBEv2 output is validated empirically. |
| Pitfalls | HIGH | All seven critical pitfalls are grounded in official sources: GitHub issues (#5, #6, #23, #28 on facebookresearch/tribev2), FastAPI GitHub issue #2425, OpenAI official structured outputs docs. Zero speculation-based pitfalls. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **TRIBEv2 text pathway differentiation (empirical gap):** No published evidence that gTTS-mediated text input to TRIBEv2 produces meaningfully different activation maps for different UI designs. This is the highest-risk unknown. Mitigation: build both text and video paths in Phase 1 and gate with a differentiation test. If text path fails, video path must be ready.

- **GPU VRAM requirements (hardware gap):** The 16GB estimate is inferred from three encoder sizes, not official documentation. Actual peak VRAM during TRIBEv2 inference with the shipped checkpoint is unconfirmed. Mitigation: test on target hardware in Phase 1 before committing to any GPU procurement decisions.

- **TRIBEv2 inference latency (timing gap):** The 60–120s estimate for TRIBEv2 inference is inferred, not measured. If inference takes longer (300s+), the job timeout watchdog threshold and React Query polling strategy need adjustment. Mitigation: measure in Phase 1 on target hardware.

- **Subcortical checkpoint availability (dependency gap):** TRIBEv2 GitHub issue #23 requests a subcortical checkpoint (8,808 voxels) that had not shipped as of April 2026. If it ships during development, the ROI aggregation module and all five circuit labels need revision to incorporate direct subcortical measurements. Mitigation: monitor the GitHub repo; treat Phase 1 ROI labeling as the correct cortical-proxy approach until the subcortical checkpoint is officially released and validated.

- **Commercial brain model swap path (future gap):** The entire model-swap strategy depends on `backend/services/inference.py` being the only file that changes. This isolation must be maintained throughout all phases — any coupling of downstream code to TRIBEv2-specific output formats will create rework at swap time. Mitigation: design the ROI output schema as a stable interface contract independent of TRIBEv2 internals from Phase 1.

---

## Sources

### Primary (HIGH confidence)
- TRIBEv2 GitHub — pyproject.toml, Issues #5, #6, #23, #28: https://github.com/facebookresearch/tribev2 — Python version constraint, PyTorch pin, numpy pin, OOM confirmation, TemporalSmoothing bug, subcortical checkpoint status
- TRIBEv2 Hugging Face model card: https://huggingface.co/facebook/tribev2 — Input/output format, text_path and video_path parameters, fsaverage5 output shape
- Meta AI Blog — TRIBEv2 announcement: https://ai.meta.com/blog/tribe-v2-brain-predictive-foundation-model/ — Architecture components, training scale, capabilities
- FastAPI GitHub Issue #2425: https://github.com/fastapi/fastapi/issues/2425 — Multiple workers multiplying GPU RAM linearly
- FastAPI Background Tasks docs: https://fastapi.tiangolo.com/tutorial/background-tasks/ — BackgroundTasks vs queue decision
- OpenAI structured outputs announcement: https://openai.com/index/introducing-structured-outputs-in-the-api/ — 100% schema conformance with json_schema mode
- @react-three/fiber npm — v9.5.x React 19 requirement: https://www.npmjs.com/package/@react-three/fiber
- niivue-react GitHub — surface mesh not supported: https://github.com/niivue/niivue-react
- Neurons AI official docs: https://knowledge.neuronsinc.com/neurons-ai-metrics-and-explanations
- EyeQuant official docs: https://www.eyequant.com/what/eyequant-experience/
- Brainsight official docs: https://www.brainsight.app/features/ai-heatmaps

### Secondary (MEDIUM confidence)
- MarkTechPost — TRIBEv2 architecture overview: https://www.marktechpost.com/2026/03/26/meta-releases-tribe-v2-a-brain-encoding-model-that-predicts-fmri-responses-across-video-audio-and-text-stimuli/
- SimAB persona-conditioned agent A/B testing: https://arxiv.org/html/2603.01024 — synthetic persona simulation patterns
- Frontiers in Neuroergonomics — neuromarketing fMRI validity (2025): https://www.frontiersin.org/journals/neuroergonomics/articles/10.3389/fnrgo.2025.1542847/full
- Python background tasks comparison 2025: https://devproportal.com/languages/python/python-background-tasks-celery-rq-dramatiq-comparison-2025/
- Three.js performance optimization guide (2025): https://tympanus.net/codrops/2025/02/11/building-efficient-three-js-scenes-optimize-performance-while-maintaining-quality/

### Tertiary (LOW confidence)
- TRIBEv2 GPU VRAM estimates — inferred from encoder model sizes (LLaMA 3.2-3B, V-JEPA2, Wav2Vec-BERT); not officially documented by Meta
- TRIBEv2 inference latency (60–120s estimate) — inferred, not measured on target hardware

---
*Research completed: 2026-04-06*
*Ready for roadmap: yes*
