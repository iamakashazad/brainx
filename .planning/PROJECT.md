# BrainX

## What This Is

BrainX is a brain response analysis tool for designers, marketers, and content creators. You upload UI screens or static content (ads, social images, text), define a user persona with real-world context (cognitive state, environment, device), and an AI simulator plays out how that persona would actually experience your content. That simulated session — not a static image — is fed into TRIBEv2 (Meta's brain prediction model) to generate brain activation maps covering attention, cognitive load, emotional response, memory encoding, and reward circuits. The output includes specific rewrite recommendations for copy, headlines, and UI elements based on predicted brain response.

## Core Value

The only tool that simulates real-world usage context before measuring brain response — not a heatmap, not contrast checking, but what actually happens in the brain when a real person uses your design.

## Requirements

### Validated

- `SIM-03` — video slideshow fallback is now proven in the shipped `/analyze` runtime flow and no longer exists only in isolated services/tests.
  Validated in Phase 3.1: Runtime Fallback Wiring and Pathway Closure

### Active

#### Persona Builder
- [ ] User can define a persona with demographics and psychographic profile
- [ ] Persona includes cognitive state: attention span, stress level, tech literacy
- [ ] Persona includes usage environment: device, location, ambient conditions (commuting, desk, store)

#### Content Input
- [ ] User can upload UI screens (1–5 screens in a flow)
- [ ] User can upload static content: ads, social images, and text-based content
- [ ] Uploaded content is associated with a defined persona and flow

#### AI Simulation
- [ ] GPT-4o simulates how the persona navigates the content — scroll behavior, reading patterns, hesitation points, micro-interactions
- [ ] Simulation incorporates real-world context: distractions, time pressure, ambient noise, device constraints
- [ ] Simulated session output (not raw image) is the input to TRIBEv2

#### Brain Analysis (TRIBEv2)
- [ ] TRIBEv2 runs inference on the simulated session and produces brain activation maps
- [ ] Maps cover: attention, cognitive load, emotional response, memory encoding, reward circuits
- [ ] Inference runs on local GPU

#### Recommendations Engine
- [ ] Output identifies which copy/headlines are being processed vs. skimmed
- [ ] Output flags UI elements triggering decision fatigue or cognitive overload
- [ ] Output shows where emotional engagement drops in the flow
- [ ] Output predicts whether CTAs are hitting reward circuits or being ignored
- [ ] Output predicts which screens will be remembered vs. forgotten
- [ ] Specific rewrites generated for button labels, headlines, and microcopy

#### Frontend
- [ ] React frontend with 3D brain visualization overlaying activation maps
- [ ] User can view per-screen brain response alongside recommendations
- [ ] Pre-built case study demo for portfolio / research preview

#### Backend
- [ ] Python backend API handling persona creation, simulation, TRIBEv2 inference, and recommendation generation
- [ ] Non-commercial research preview framing — not gated by billing

### Out of Scope

- Video content analysis — pipeline complexity, defer to v2
- Multiple simultaneous personas per session — MVP is single persona
- Flows longer than 5 screens — keep MVP scope tight
- Commercial billing / SaaS pricing — non-commercial license, build audience first
- Real-time collaboration — single-user tool for now
- Mobile app — web-first

## Context

- TRIBEv2 is Meta's open-source brain prediction model (https://github.com/facebookresearch/tribev2). It is non-commercial licensed. The strategy is: use it for research preview and audience building now, then swap the brain model engine for a commercial-friendly alternative when ready to monetize.
- GPT-4o powers the persona simulator — it interprets the persona definition + environment and generates a realistic usage session that becomes the actual input to TRIBEv2.
- TRIBEv2 runs locally on user's GPU for inference. No cloud dependency in v1.
- Current backend state: Phase 3.1 is complete, and the shared `/analyze` worker can now activate the slideshow/video fallback path for eligible visual content while preserving the existing per-screen pipeline contract.
- The "interpretation layer" (recommendations engine) sits on top of TRIBEv2 output and translates activation maps into actionable design and copy changes. This layer is the defensible IP — it is model-agnostic and will survive a model swap.
- Content scope for MVP: UI screens (design flows) + static content (ads, social images, text). Video is deferred to v2.
- Primary audience: designers, marketers, content creators. Research preview builds credibility before commercial product launch.

## Constraints

- **License**: TRIBEv2 is non-commercial — no paid tier until engine is swapped. Monetization deferred.
- **Compute**: TRIBEv2 inference runs on local GPU — no cloud GPU costs in v1, but not scalable without infrastructure change.
- **Tech Stack**: Python backend, React frontend, GPT-4o, TRIBEv2 — no substitutions in v1.
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
*Last updated: 2026-04-18 after Phase 3.1 completion*
