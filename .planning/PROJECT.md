# BrainX

## What This Is

BrainX is a brain response analysis tool for designers, marketers, and content creators. You upload UI screens or static content (ads, social images, text), define a user persona with real-world context (cognitive state, environment, device), and a DeepSeek-powered simulator plays out how that persona would actually experience your content. That simulated session — not a static image — is fed into TRIBEv2 (Meta's brain prediction model) to generate brain activation maps covering attention, cognitive load, emotional response, memory encoding, and reward circuits. The output includes specific rewrite recommendations for copy, headlines, and UI elements based on predicted brain response.

## Core Value

The only tool that simulates real-world usage context before measuring brain response — not a heatmap, not contrast checking, but what actually happens in the brain when a real person uses your design.

## Requirements

### Validated

- Backend foundation is validated: FastAPI lifespan loads TRIBEv2 once at startup, the single-worker queue is active, and polling APIs are stable.
  Validated in Phase 1: Foundation and TRIBEv2 Integration
- Persona builder and content input are validated for demographics, cognitive state, environment, saved persona reuse, UI screen uploads, static uploads, and pasted text.
  Validated in Phase 2: Simulation Pipeline and Content Input
- DeepSeek-based simulation, raw simulation-log visibility, and deterministic scroll/hesitation overlays are validated in the shipped backend.
  Validated in Phase 2 and reconciled in Phase 3.2 verification
- Brain analysis and recommendation generation are validated end-to-end: per-screen activations, ROI tables, continuity scoring, and evidence-grounded copy recommendations all complete through `/analyze`.
  Validated in Phase 3: Full Pipeline Integration and Recommendations
- `SIM-03` — video slideshow fallback is proven in the shipped `/analyze` runtime flow and no longer exists only in isolated services/tests.
  Validated in Phase 3.1: Runtime Fallback Wiring and Pathway Closure
- Verification and traceability artifacts for the backend milestone are reconciled to the shipped system state.
  Validated in Phase 3.2: Verification and Traceability Reconciliation

### Active

#### Frontend
- [ ] React frontend with 3D brain visualization overlaying activation maps
- [ ] User can view per-screen brain response alongside recommendations
- [ ] Upload, persona, and results flow built on top of the validated backend contract

#### Session Persistence and Demo
- [ ] Pre-built case study demo for portfolio / research preview
- [ ] Session history and reloadable past analyses
- [ ] Production hardening around queue pressure, watchdogs, and user-facing failure handling

#### Product Positioning
- [ ] Non-commercial research preview framing in the user-facing product
- [ ] Frontend experience that makes the validated backend workflow usable without developer tooling

### Out of Scope

- Video content analysis — pipeline complexity, defer to v2
- Multiple simultaneous personas per session — MVP is single persona
- Flows longer than 5 screens — keep MVP scope tight
- Commercial billing / SaaS pricing — non-commercial license, build audience first
- Real-time collaboration — single-user tool for now
- Mobile app — web-first

## Context

- TRIBEv2 is Meta's open-source brain prediction model (https://github.com/facebookresearch/tribev2). It is non-commercial licensed. The strategy is: use it for research preview and audience building now, then swap the brain model engine for a commercial-friendly alternative when ready to monetize.
- DeepSeek powers the simulation and recommendation stack: DeepSeek-V3 for text-first reasoning and DeepSeek-VL2-class vision support for image-grounded analysis.
- TRIBEv2 runs locally in the backend runtime. The current shipped default is CPU-first for reliability, with no cloud inference dependency in v1.
- Current backend state: Phases 1 through 3.2 are verified. Phase 3.2 is complete: the shared `/analyze` worker, fallback path, and requirement traceability now all describe the same shipped system, and the Phase 2 executable evidence chain is green after the 03.2-04 regression repair.
- The "interpretation layer" (recommendations engine) sits on top of TRIBEv2 output and translates activation maps into actionable design and copy changes. This layer is the defensible IP — it is model-agnostic and will survive a model swap.
- Content scope for MVP: UI screens (design flows) + static content (ads, social images, text). Video is deferred to v2.
- Primary audience: designers, marketers, content creators. Research preview builds credibility before commercial product launch.

## Constraints

- **License**: TRIBEv2 is non-commercial — no paid tier until engine is swapped. Monetization deferred.
- **Compute**: TRIBEv2 inference runs locally in the shipped backend runtime. CPU is the current reliable default; higher-throughput hardware support can be revisited later without changing the product contract.
- **Tech Stack**: Python backend, React frontend, DeepSeek, TRIBEv2 — no substitutions in v1.
- **MVP Scope**: Single persona, 1–5 screen flow, one case study demo. No scope creep beyond this.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Research preview (non-commercial) first | TRIBEv2 license blocks commercial use; build audience + interpretation layer now | — Pending |
| Swap brain model engine later | Decouple interpretation layer from TRIBEv2 so the IP survives a model swap | — Pending |
| Simulate usage before brain analysis | Static screenshots miss real-world context; simulation is the core differentiator | — Pending |
| Screens + static content in MVP | Broadens use case to marketers without blowing up the pipeline complexity | — Pending |
| Local GPU for inference | No cloud cost in v1; acceptable for research preview scale | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-20 after Phase 03.2-04/05 gap closure*
