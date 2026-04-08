# Phase 1: Foundation and TRIBEv2 Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-08
**Phase:** 01-Foundation and TRIBEv2 Integration
**Areas discussed:** Input pathway strategy, API design & job lifecycle, Error handling & recovery, ROI circuit naming

---

## Input Pathway Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Text narrative first | Build gTTS text path first — simpler, faster to validate | ✓ |
| Video slideshow first | Build moviepy MP4 path first — engages V-JEPA2 visual encoder | |
| Both in parallel | Build and test both simultaneously | |

**User's choice:** Text narrative first
**Notes:** None

### Differentiation Test

| Option | Description | Selected |
|--------|-------------|----------|
| Statistical divergence | Compare activation arrays with numeric threshold (>10% MAD) | |
| Visual inspection | Generate maps for opposite inputs, visually confirm they look different | ✓ |
| You decide | Claude picks during implementation | |

**User's choice:** Visual inspection
**Notes:** None

### Fallback Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-switch to video path | If text fails inspection, video becomes default automatically | ✓ |
| Block Phase 1 completion | Neither path ships until one passes | |

**User's choice:** Auto-switch to video path
**Notes:** None

### Video Build Timing

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, build both | Build moviepy MP4 alongside text in Phase 1 | ✓ |
| Defer video to later | Only build video if text path fails | |

**User's choice:** Yes, build both
**Notes:** None

---

## API Design & Job Lifecycle

### Endpoint Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal test-only | POST /test-inference, GET /jobs/{id}, GET /model-status | ✓ |
| Full API skeleton | Build POST /analyze with placeholder validation | |
| You decide | Claude picks | |

**User's choice:** Minimal test-only
**Notes:** None

### Job Status Stages

| Option | Description | Selected |
|--------|-------------|----------|
| Simple 3-stage | PENDING → RUNNING → DONE/ERROR | ✓ |
| Full stages from start | All 5 stages defined in enum from day one | |

**User's choice:** Simple 3-stage
**Notes:** User initially asked whether 3-stage includes TRIBEv2 simulation. Clarified that SIMULATING refers to DeepSeek persona simulation (Phase 2), not TRIBEv2 inference. TRIBEv2 runs in the RUNNING stage. User confirmed 3-stage after clarification.

---

## Error Handling & Recovery

### GPU Failure Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Fail fast with message | Immediate ERROR transition, no retry | |
| Retry once then fail | One retry on GPU error, then ERROR | ✓ |
| You decide | Claude picks based on TRIBEv2 failure modes | |

**User's choice:** Retry once then fail
**Notes:** None

### Startup Failure

| Option | Description | Selected |
|--------|-------------|----------|
| Server refuses to start | Exit with clear error if model loading fails | ✓ |
| Start degraded | Start with model-status returning 'unavailable' | |

**User's choice:** Server refuses to start
**Notes:** None

### Job Timeout

| Option | Description | Selected |
|--------|-------------|----------|
| No timeout in Phase 1 | Let inference run to establish baseline latency | ✓ |
| 300s timeout now | Enforce timeout from start | |

**User's choice:** No timeout in Phase 1
**Notes:** None

---

## ROI Circuit Naming

### Naming Convention

| Option | Description | Selected |
|--------|-------------|----------|
| Consumer-friendly from start | Plain names everywhere: Attention, Cognitive Load, etc. | ✓ |
| Internal anatomical + display mapping | Anatomical labels internally with display name layer | |
| You decide | Claude picks | |

**User's choice:** Consumer-friendly from start
**Notes:** None

### Cortical Proxy Mapping Storage

| Option | Description | Selected |
|--------|-------------|----------|
| Hardcoded | Baked into ROI aggregation code | ✓ |
| Config-driven | JSON/YAML config file for circuit → region mapping | |
| You decide | Claude picks | |

**User's choice:** Hardcoded
**Notes:** None

---

## Claude's Discretion

- Conda environment setup and TRIBEv2 patching sequence
- SQLite schema design for job registry
- Test input selection for differentiation gate
- Internal code organization and module structure

## Deferred Ideas

None — discussion stayed within phase scope
