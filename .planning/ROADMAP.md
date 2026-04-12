# Roadmap: BrainX

## Overview

BrainX is built in strict pipeline order: the backend foundation and TRIBEv2 integration come first because every downstream phase depends on a working GPU inference layer. Once TRIBEv2 is proven, the simulation pipeline is built and validated in isolation before connecting it to inference — this prevents simulation hallucination from corrupting brain maps. The full pipeline is then assembled end-to-end with the recommendations engine. Only after a proven backend does the frontend get built, followed by session persistence and the pre-built demo case study that requires real pipeline output.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation and TRIBEv2 Integration** - Backend skeleton, TRIBEv2 environment, single-worker GPU queue, and both input path validations
- [ ] **Phase 2: Simulation Pipeline and Content Input** - DeepSeek simulation service, all content input types, persona builder, and simulation output validation
- [ ] **Phase 3: Full Pipeline Integration and Recommendations** - End-to-end pipeline from content + persona to brain maps and grounded copy recommendations
- [ ] **Phase 4: Frontend — Upload, Persona, and Results** - Complete React frontend with 3D brain visualization, persona form, upload flow, and results view
- [ ] **Phase 5: Session Persistence, Demo, and Polish** - Session history, re-loadable results, pre-built demo case study, and production hardening

## Phase Details

### Phase 1: Foundation and TRIBEv2 Integration
**Goal**: TRIBEv2 runs end-to-end on a test input with a proven single-worker queue, all repo patches applied, both input paths validated, and ROI circuit labels locked in as cortical proxies
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, SIM-03
**Success Criteria** (what must be TRUE):
  1. TRIBEv2 loads once at server startup and produces a `(n_timesteps, ~20k vertices)` cortical activation array for a test text input without crashing
  2. Both the text narrative path and the video slideshow path (moviepy MP4) return activation arrays; a differentiation test on maximally different inputs confirms the chosen path produces non-uniform maps
  3. A `GET /model-status` and job polling endpoint (`GET /jobs/{id}`) respond correctly; the frontend can track queue position without websockets
  4. The asyncio.Queue with a single GPU worker coroutine processes one job at a time; concurrent POST requests queue without GPU OOM errors
  5. All five named circuit ROI labels (attention, cognitive load, emotional response, memory encoding, reward-related cortex) are mapped to cortical proxies only — no subcortical labels appear anywhere in the codebase
**Plans**: 4 plans

Plans:
- [x] 01-01: Conda environment, Python 3.11, PyTorch 2.6 + CUDA 12.4, TRIBEv2 clone with patches (numpy pin, TemporalSmoothing)
- [x] 01-02: FastAPI skeleton — lifespan model loading, asyncio.Queue GPU worker, SQLite job registry, INFRA-03 polling API
- [x] 01-03: TRIBEv2 text pathway smoke test + video slideshow fallback (SIM-03) + differentiation gate + ROI cortical-proxy label schema
- [ ] 01-04-PLAN.md — Gap closure: fix MPS inference stall (CPU fallback), run live TRIBEv2 integration tests, validate differentiation gate

### Phase 2: Simulation Pipeline and Content Input
**Goal**: Users can define a persona, upload or paste content, and receive a validated simulation log — the structured session narrative that becomes TRIBEv2 input
**Depends on**: Phase 1
**Requirements**: SIM-01, SIM-02, SIM-04, CONT-01, CONT-02, CONT-03, PERS-01, PERS-02, PERS-03, PERS-04
**Success Criteria** (what must be TRUE):
  1. User can upload 1–5 UI screen images, upload static content (ads, social images), or paste text — all three content paths create a persisted analysis job
  2. User can define a persona with demographics, psychographic profile, cognitive state, and usage environment — the persona is saved and reusable across sessions
  3. For any content + persona combination, DeepSeek produces a schema-conformant session narrative with no references to screen elements not visible in the uploaded images (hallucination check passes)
  4. The raw simulation log (full DeepSeek output) is viewable by the user alongside a scroll and hesitation map overlay derived from the simulation
  5. Job status transitions (pending → simulation → inference → processing → done) are visible to the frontend via the polling API
**Plans**: TBD

Plans:
- [ ] 02-01: Persona builder API — CRUD endpoints, SQLite persistence, save/reuse (PERS-01, PERS-02, PERS-03, PERS-04)
- [ ] 02-02: Content upload API — multipart image upload (1–5 screens), static content, text paste; image resize + JPEG compression pipeline (CONT-01, CONT-02, CONT-03)
- [ ] 02-03: DeepSeek simulation service — structured output schema, hallucination validation pass, screen-grounding prompts (SIM-01, SIM-04)
- [ ] 02-04: Scroll/hesitation map overlay derivation from simulation log + stage-level job status transitions (SIM-02)

### Phase 3: Full Pipeline Integration and Recommendations Engine
**Goal**: A complete analysis run — from content upload and persona selection through to five-circuit brain maps and specific copy recommendations — executes end-to-end and produces results grounded in ROI activation data
**Depends on**: Phase 2
**Requirements**: BRAIN-01, BRAIN-02, BRAIN-03, BRAIN-04, REC-01, REC-02, REC-03, REC-04
**Success Criteria** (what must be TRUE):
  1. For a multi-screen flow, the system produces a separate 3D cortical activation map for each screen, covering all five named circuits with numeric ROI scores in a named-region table
  2. The flow-level continuity view shows how cognitive load and emotional engagement shift across screens in the session arc
  3. Every copy rewrite recommendation cites the specific brain region and activation score driving it — a blind evaluation with two opposite activation profiles produces demonstrably different, score-citing recommendations
  4. Layout elements triggering cognitive overload or failing to activate reward-related cortex are flagged with specific identifiers; screens predicted to be remembered vs. forgotten are labeled; emotional drop-off points have suggested fixes
  5. The full `POST /analyze` → queue → simulation → inference → ROI aggregation → recommendations → `DONE` lifecycle completes and stores the structured result in SQLite with vertex arrays on disk
**Plans**: TBD

Plans:
- [ ] 03-01: TRIBEv2 inference service integration — connect simulation output to inference, nilearn Destrieux atlas ROI aggregation, per-screen activation arrays (BRAIN-01, BRAIN-02)
- [ ] 03-02: Flow-level continuity analysis + BRAIN-04 ROI score table + full result persistence schema (BRAIN-03, BRAIN-04)
- [ ] 03-03: Recommendations engine — DeepSeek structured output with evidence_roi + activation_score fields, blind evaluation test (REC-01, REC-02, REC-03, REC-04)

### Phase 4: Frontend — Upload, Persona, and Results
**Goal**: Users can submit an analysis through a complete React web UI and view brain activation maps alongside grounded recommendations in a single results panel
**Depends on**: Phase 3
**Requirements**: FE-01, FE-02
**Success Criteria** (what must be TRUE):
  1. User can upload content, define or select a saved persona, submit a job, and watch stage-level progress indicators without page refresh
  2. The results view pairs each uploaded screen with its 3D brain visualization (vertex color overlay via @react-three/fiber, fsaverage5 meshes) and recommendations in a single side-by-side panel
  3. The 3D brain mesh renders at stable frame rate — vertex color attributes update directly without triggering React re-renders
  4. All activation score labels use consumer-friendly circuit names (no Brodmann codes or subcortical anatomical terms) with qualitative descriptors (Low / Moderate / High / Very High)
**Plans**: TBD

Plans:
- [ ] 04-01: Upload flow + persona form — react-dropzone, persona builder UI, Zustand store, multipart POST (CONT-01, CONT-02, CONT-03, PERS-01, PERS-02, PERS-03, PERS-04 UI layer)
- [ ] 04-02: Processing view with React Query polling, stage progress indicators
- [ ] 04-03: Results view — attention heatmap overlay, 3D brain visualization (R3F, fsaverage5 GLTF), per-screen metric scores, recommendations panel (FE-01, FE-02)
**UI hint**: yes

### Phase 5: Session Persistence, Demo, and Polish
**Goal**: Past sessions are browsable and re-loadable without re-running inference; a pre-built demo case study loads within 3 seconds; production hardening closes silent failure and queue overflow scenarios
**Depends on**: Phase 4
**Requirements**: FE-03, FE-04
**Success Criteria** (what must be TRUE):
  1. User can browse past analysis sessions (persona, content thumbnails, date) and re-open any session to the full results view without re-running TRIBEv2 inference
  2. The pre-built demo case study loads from the database in under 3 seconds without triggering any inference — a user with no content to upload can experience the full tool output
  3. Jobs that exceed 300 seconds auto-transition to ERROR with a descriptive message; a POST /analyze request is rejected with 429 if the queue depth is at or above 5
  4. All activation score displays use the 0–100 scale with qualitative labels; no raw Brodmann codes or "subcortical" labels appear anywhere in the UI
**Plans**: TBD

Plans:
- [ ] 05-01: Session history API and frontend view — SQLAlchemy async result loading, persona + thumbnail metadata, re-open from DB (FE-04)
- [ ] 05-02: Pre-built demo case study — real analysis stored in DB + disk, loads in < 3s, no inference triggered (FE-03)
- [ ] 05-03: Production hardening — job timeout watchdog (300s), queue depth check (429 at >= 5), UI label audit (0–100 scale, qualitative descriptors)
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation and TRIBEv2 Integration | 3/4 | In progress | - |
| 2. Simulation Pipeline and Content Input | 0/4 | Not started | - |
| 3. Full Pipeline Integration and Recommendations | 0/3 | Not started | - |
| 4. Frontend — Upload, Persona, and Results | 0/3 | Not started | - |
| 5. Session Persistence, Demo, and Polish | 0/3 | Not started | - |
