# Roadmap: BrainX

## Overview

BrainX is built in strict pipeline order: the backend foundation and TRIBEv2 integration come first because every downstream phase depends on a working inference layer. The simulation pipeline is built and validated before connecting it to inference. The full backend pipeline is then assembled end-to-end with the recommendations engine. Only after a proven backend does the frontend get built, followed by session persistence and the pre-built demo case study that requires real pipeline output. With Phase 3.2 complete, the next major workstream is Phase 4: frontend upload, persona, and results.

## Phases

- [x] **Phase 1: Foundation and TRIBEv2 Integration** - Backend skeleton, TRIBEv2 environment, single-worker GPU queue, and both input path validations
- [x] **Phase 2: Simulation Pipeline and Content Input** - DeepSeek simulation service, all content input types, persona builder, and simulation output validation
- [x] **Phase 3: Full Pipeline Integration and Recommendations** - End-to-end pipeline from content + persona to brain maps and grounded copy recommendations
- [x] **Phase 3.1: Runtime Fallback Wiring and Pathway Closure** - Wire the slideshow/video fallback into the shared analyze flow and prove SIM-03 in the shipped runtime path (completed 2026-04-18)
- [x] **Phase 3.2: Verification and Traceability Reconciliation** - Create the missing Phase 2 verification, refresh stale audit artifacts, and reconcile requirement traceability before re-audit (completed 2026-04-19; gap closure 03.2-04/05 added 2026-04-20)
- [x] **Phase 4: Frontend — Upload, Persona, and Results** - Complete React frontend with 3D brain visualization, persona form, upload flow, and results view (built; UAT tests 1, 11, 13-16 pending a green cold-start E2E run)
- [x] **Phase 5: Session Persistence, Demo, and Polish** - Session history, re-loadable results, pre-built demo case study, and production hardening (built; 4 human browser UAT checks pending — see 05-HUMAN-UAT.md)

## Phase Details

### Phase 1: Foundation and TRIBEv2 Integration
**Goal**: TRIBEv2 runs end-to-end on a test input with a proven single-worker queue, all repo patches applied, both input paths validated, and ROI circuit labels locked in as cortical proxies
**Depends on**: Nothing
**Requirements**: INFRA-01, INFRA-02, INFRA-03, SIM-03
**Plans**: 4 plans

Plans:
- [x] 01-01: Conda environment, Python 3.11, PyTorch 2.6 + CUDA 12.4, TRIBEv2 clone with patches
- [x] 01-02: FastAPI skeleton, lifespan model loading, queue worker, SQLite job registry, polling API
- [x] 01-03: TRIBEv2 text pathway smoke test, slideshow fallback, differentiation gate, ROI cortical-proxy label schema
- [x] 01-04: Gap closure for MPS inference stall, CPU fallback, live integration tests, and differentiation validation

### Phase 2: Simulation Pipeline and Content Input
**Goal**: Users can define a persona, upload or paste content, and receive a validated simulation log that becomes TRIBEv2 input
**Depends on**: Phase 1
**Requirements**: SIM-01, SIM-02, SIM-04, CONT-01, CONT-02, CONT-03, PERS-01, PERS-02, PERS-03, PERS-04
**Plans**: 5 plans

Plans:
- [x] 02-00: Schema/test foundation — personas, contents, job foreign keys, settings, and shared fixture scaffolding
- [x] 02-01: Persona builder API — CRUD endpoints, SQLite persistence, save/reuse
- [x] 02-02: Content upload API — multipart image upload, static content, text paste, image processing pipeline
- [x] 02-03: DeepSeek simulation service — structured output schema, hallucination validation pass, screen-grounding prompts
- [x] 02-04: Scroll/hesitation overlay derivation plus stage-level job status transitions

### Phase 3: Full Pipeline Integration and Recommendations
**Goal**: A complete analysis run — from content upload and persona selection through to five-circuit brain maps and specific recommendations — executes end-to-end and produces results grounded in ROI activation data
**Depends on**: Phase 2
**Requirements**: BRAIN-01, BRAIN-02, BRAIN-03, BRAIN-04, REC-01, REC-02, REC-03, REC-04
**Plans**: 5 plans

Plans:
- [x] 03-01: Per-screen TRIBEv2 inference loop plus fsaverage5 ROI aggregation
- [x] 03-02: Flow continuity plus schema-versioned result envelope and global 0–100 rescale
- [x] 03-03: Recommendations engine with structured output, evidence field, and blind-eval harness
- [x] 03-04: Gap closure for `layout_flag`, `memorability`, and `emotional_dropoff` behavior
- [x] 03-05: Live blind-eval closure with passing proof artifact

### Phase 3.1: Runtime Fallback Wiring and Pathway Closure
**Goal**: The shipped `/analyze` pipeline can switch into the slideshow/video fallback path when required, and SIM-03 is proven in the real runtime flow rather than only in isolated services/tests
**Depends on**: Phase 3
**Requirements**: SIM-03
**Gap Closure**: Closes the v1.0 milestone audit integration and broken-flow gaps for the automatic slideshow fallback path
**Plans**: 2 plans

Plans:
- [x] 03.1-01: Wire pathway selection and slideshow/video fallback into the shared analyze worker
- [x] 03.1-02: Add runtime regression coverage and verification evidence for fallback activation in `/analyze`

### Phase 3.2: Verification and Traceability Reconciliation
**Goal**: Phase 2 has formal verification, stale Phase 1 and planning artifacts are reconciled, and the milestone can be re-audited against current evidence without orphaned requirements
**Depends on**: Phase 3.1
**Requirements**: INFRA-02, SIM-01, SIM-02, SIM-04, CONT-01, CONT-02, CONT-03, PERS-01, PERS-02, PERS-03, PERS-04
**Gap Closure**: Closes the v1.0 milestone audit requirement-orphan and documentation-drift gaps
**Plans**: 5 plans

Plans:
- [x] 03.2-01: Create `02-VERIFICATION.md` from shipped Phase 2 code, tests, and UAT evidence
- [x] 03.2-02: Refresh stale Phase 1 verification artifact and reconcile `REQUIREMENTS.md` traceability
- [x] 03.2-03: Re-run milestone audit and confirm clean closure evidence
- [x] 03.2-04: Repair the `test_log_viewable` test-harness regression and remove stale `test_happy_path` references from Phase 2 verification/UAT/validation
- [x] 03.2-05: Reconcile `PROJECT.md`/`STATE.md` narrative and re-audit the milestone against the post-03.2-04 Phase 2 evidence chain

### Phase 4: Frontend — Upload, Persona, and Results
**Goal**: Users can submit an analysis through a complete React UI and view brain activation maps alongside grounded recommendations in a single results panel
**Depends on**: Phase 3.2
**Requirements**: FE-01, FE-02
**Plans**: 3 plans

Plans:
- [x] 04-01: Upload flow plus persona form and multipart submit path
- [x] 04-02: Processing view with polling and stage progress indicators
- [x] 04-03: Results view with overlays, 3D brain visualization, metric scores, and recommendations panel

### Phase 5: Session Persistence, Demo, and Polish
**Goal**: Past sessions are browsable and reloadable without rerunning inference; a pre-built demo loads quickly; production hardening closes silent-failure and queue-overflow scenarios
**Depends on**: Phase 4
**Requirements**: FE-03, FE-04
**Plans**: 3 plans

Plans:
- [x] 05-01-PLAN.md — Session history API + HistoryView root screen + wizard overlay (FE-04)
- [x] 05-02-PLAN.md — Demo fixture + DemoCard + theme toggle + shareable /results/:jobId URL (FE-03, D-11, D-12)
- [x] 05-03-PLAN.md — Production hardening: timeout watchdog, queue depth 503 guard, UI label audit (D-08, D-09, D-10)

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation and TRIBEv2 Integration | 4/4 | Complete | 2026-04-13 |
| 2. Simulation Pipeline and Content Input | 5/5 | Complete | 2026-04-16 |
| 3. Full Pipeline Integration and Recommendations | 5/5 | Complete | 2026-04-18 |
| 3.1. Runtime Fallback Wiring and Pathway Closure | 2/2 | Complete    | 2026-04-18 |
| 3.2. Verification and Traceability Reconciliation | 5/5 | Complete | 2026-04-20 |
| 4. Frontend — Upload, Persona, and Results | 3/3 | Built — UAT partial (tests 1, 11, 13-16 open) | - |
| 5. Session Persistence, Demo, and Polish | 3/3 | Built — 4 human UAT checks pending | - |
