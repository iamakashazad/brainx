# Requirements: BrainX

**Defined:** 2026-04-06
**Core Value:** The only tool that simulates real-world usage context before measuring brain response — not a heatmap, not contrast checking.

> **Stack note:** DeepSeek replaces GPT-4o as the LLM. Use DeepSeek-V3 for text-only simulation/recommendations; DeepSeek-VL2 (or equivalent vision model) for screen image analysis. Final model selection locked in Phase 1 stack validation.

## v1 Requirements

### Content Input

- [x] **CONT-01**: User can upload 1–5 UI screens as images to form an analysis flow
- [x] **CONT-02**: User can upload static content (ads, social media images) for standalone analysis
- [x] **CONT-03**: User can paste text directly as content for analysis without uploading an image

### Persona Builder

- [x] **PERS-01**: User can define a persona with demographics (age, role, background) and psychographic profile (goals, values, motivations)
- [x] **PERS-02**: User can set cognitive state for the persona (attention span, stress level, tech literacy)
- [x] **PERS-03**: User can set usage environment (device type, location context, ambient conditions)
- [x] **PERS-04**: User can save a persona and reuse it across multiple analysis sessions

### Simulation

- [x] **SIM-01**: System generates a gaze narrative via DeepSeek (persona + content → structured text session log) as TRIBEv2 input
- [x] **SIM-02**: System produces a scroll and hesitation map overlay derived from the simulation log
- [ ] **SIM-03**: System supports a video slideshow fallback path — auto-activated if text pathway signal differentiation is below threshold
- [x] **SIM-04**: User can view the raw simulation log (full DeepSeek session output)

### Brain Analysis

- [ ] **BRAIN-01**: System generates 5-circuit cortical activation maps: attention, cognitive load, emotional response, memory encoding, and reward-related cortex (OFC, insula, ACC, parahippocampal — cortical proxies only; no subcortical)
- [ ] **BRAIN-02**: System generates a separate brain activation map for each screen in the uploaded flow
- [ ] **BRAIN-03**: System shows flow-level continuity — how cognitive load and emotional engagement shift across screens over the session arc
- [ ] **BRAIN-04**: System provides a named-region ROI score table with numeric activation values alongside the 3D visualization

### Recommendations Engine

- [ ] **REC-01**: System generates specific copy rewrites (headlines, CTAs, microcopy) grounded in ROI activation data — each recommendation must cite the specific brain region and activation score driving it
- [ ] **REC-02**: System flags layout elements triggering cognitive overload, being skipped by the persona, or failing to activate reward-related cortex
- [ ] **REC-03**: System predicts which screens in the flow will be remembered vs. forgotten after the session
- [ ] **REC-04**: System identifies emotional drop-off points in the flow with suggested structural and copy fixes

### Frontend

- [ ] **FE-01**: Interactive 3D brain visualization using @react-three/fiber with vertex color overlay showing circuit-level activation per screen
- [ ] **FE-02**: Side-by-side view pairing each uploaded screen with its brain map and recommendations in a single panel
- [ ] **FE-03**: Pre-built demo case study — one hardcoded analysis session available without running inference, for portfolio / research preview
- [ ] **FE-04**: Session history view — user can browse and re-open past analysis sessions

### Infrastructure

- [ ] **INFRA-01**: Python 3.11 + FastAPI backend with single asyncio.Queue GPU job queue (uvicorn --workers 1 mandatory)
- [ ] **INFRA-02**: TRIBEv2 loaded once at server startup via FastAPI lifespan; three repo patches applied at clone time (numpy pin, TemporalSmoothing, and any open issues)
- [ ] **INFRA-03**: Job status polling API so frontend can display queue position and progress without websockets

## v2 Requirements

### Extended Content Types

- **EXT-01**: Video content analysis (full video passed to TRIBEv2 video pathway)
- **EXT-02**: URL screenshot auto-capture for live web pages

### Advanced Analysis

- **ADV-01**: A/B variant comparison — run two designs against the same persona and diff the activation maps
- **ADV-02**: Subcortical activation (striatum, hippocampus) if Meta releases subcortical TRIBEv2 checkpoint (Issue #23)
- **ADV-03**: Multiple persona comparison in a single session

### Platform

- **PLT-01**: Team collaboration and shared workspaces
- **PLT-02**: API access for programmatic submissions
- **PLT-03**: Commercial model with swapped brain engine (when non-commercial license no longer applies)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Video content analysis | Pipeline complexity; TRIBEv2 video path needs separate validation — v2 |
| Multiple simultaneous personas per session | Adds UI complexity before core pipeline is proven |
| Flows longer than 5 screens | Single GPU job latency; 60–120s per flow already near user tolerance |
| Commercial billing / SaaS pricing | TRIBEv2 non-commercial license blocks this until engine swap |
| Real-time collaboration | Single-user tool; adds server complexity before value is validated |
| Mobile app | Web-first; mobile adds responsive complexity with no research demand |
| OAuth / user auth | Single researcher tool for v1; auth adds infrastructure overhead |
| A/B variant comparison | Depends on stable session persistence — v1.x minimum |
| Real user panel integration | Would compete with simulation approach rather than complement it |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 | Pending |
| INFRA-02 | Phase 3.2 | Pending |
| INFRA-03 | Phase 1 | Pending |
| SIM-01 | Phase 3.2 | Complete |
| SIM-03 | Phase 3.1 | Pending |
| SIM-02 | Phase 3.2 | Complete |
| SIM-04 | Phase 3.2 | Complete |
| CONT-01 | Phase 3.2 | Complete |
| CONT-02 | Phase 3.2 | Complete |
| CONT-03 | Phase 3.2 | Complete |
| BRAIN-01 | Phase 3 | Pending |
| BRAIN-02 | Phase 3 | Pending |
| BRAIN-03 | Phase 3 | Pending |
| BRAIN-04 | Phase 3 | Pending |
| REC-01 | Phase 3 | Pending |
| REC-02 | Phase 3 | Pending |
| REC-03 | Phase 3 | Pending |
| REC-04 | Phase 3 | Pending |
| PERS-01 | Phase 3.2 | Complete |
| PERS-02 | Phase 3.2 | Complete |
| PERS-03 | Phase 3.2 | Complete |
| PERS-04 | Phase 3.2 | Complete |
| FE-01 | Phase 4 | Pending |
| FE-02 | Phase 4 | Pending |
| FE-03 | Phase 5 | Pending |
| FE-04 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 27 total
- Mapped to phases: 27
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-06*
*Last updated: 2026-04-19 after Phase 03.2-01 verification reconciliation*
