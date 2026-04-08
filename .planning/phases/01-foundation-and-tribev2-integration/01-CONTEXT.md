# Phase 1: Foundation and TRIBEv2 Integration - Context

**Gathered:** 2026-04-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Backend skeleton with TRIBEv2 running end-to-end on test inputs. Conda environment with patches, single-worker GPU queue, both text and video slideshow pathways built, visual differentiation test passing, ROI cortical-proxy label schema locked in. No real content input or persona simulation — those are Phase 2.

</domain>

<decisions>
## Implementation Decisions

### Input Pathway Strategy
- **D-01:** Build text narrative path (gTTS) first as primary target. Simpler to validate and needed for text-only content (CONT-03) regardless of differentiation outcome.
- **D-02:** Build video slideshow path (moviepy MP4) alongside text in Phase 1. Both paths must exist before Phase 1 completes — video is the SIM-03 fallback and provides a backup if text fails differentiation.
- **D-03:** Differentiation gate uses visual inspection — generate activation maps for two maximally different inputs (e.g., calm meditation text vs urgent sale CTA) and visually confirm the maps look different. No statistical threshold required.
- **D-04:** If text path fails visual inspection, auto-switch to video slideshow as the default path. Text path remains available for future re-evaluation but is not shipped as primary.

### API Design & Job Lifecycle
- **D-05:** Minimal test-only endpoints for Phase 1: `POST /test-inference` (submit test input), `GET /jobs/{id}` (poll status/result), `GET /model-status` (health check). No `/analyze` endpoint yet — that arrives in Phase 2 with real content input.
- **D-06:** Simple 3-stage job lifecycle: PENDING → RUNNING → DONE/ERROR. Phase 2 expands RUNNING into SIMULATING → INFERENCE → PROCESSING when the DeepSeek simulation service exists. Schema supports adding stages without breaking existing jobs.

### Error Handling & Recovery
- **D-07:** GPU failures (OOM, CUDA errors) retry once, then transition job to ERROR with descriptive message. Second failure is treated as deterministic. Caller sees error via job polling.
- **D-08:** If TRIBEv2 fails to load at server startup (lifespan), the server refuses to start and exits with a clear error message. No degraded mode — no point running without a working model.
- **D-09:** No job timeout in Phase 1. Inference runs as long as needed to establish baseline latency. The 300s timeout watchdog is deferred to Phase 5 per roadmap.

### ROI Circuit Naming
- **D-10:** Consumer-friendly circuit names used everywhere from day one: "Attention", "Cognitive Load", "Emotional Response", "Memory Encoding", "Reward". No Brodmann codes or anatomical terms in any API response, code constant, or UI label.
- **D-11:** Cortical proxy mappings (5 circuits → Destrieux atlas regions) are hardcoded in the ROI aggregation module. If Meta releases a subcortical checkpoint (Issue #23), it's a code change — no config layer needed.

### Claude's Discretion
- Exact conda environment setup and TRIBEv2 patching sequence
- SQLite schema design for job registry
- Test input selection for differentiation gate
- Internal code organization and module structure

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### TRIBEv2 Integration
- `.planning/research/STACK.md` — Version constraints (Python 3.11, PyTorch 2.6, numpy pin), conda isolation requirement
- `.planning/research/ARCHITECTURE.md` — Pipeline architecture, asyncio.Queue pattern, single-worker GPU design
- `.planning/research/PITFALLS.md` — Critical bugs (numpy pin, TemporalSmoothing, undifferentiated text maps), GPU OOM prevention

### Project Requirements
- `.planning/REQUIREMENTS.md` — INFRA-01, INFRA-02, INFRA-03, SIM-03 acceptance criteria
- `.planning/PROJECT.md` — Core value, constraints, key decisions

### Research Summary
- `.planning/research/SUMMARY.md` — Executive summary, stack recommendations, Phase 1 specific guidance, confidence assessment

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — empty repository, Phase 1 starts from scratch

### Established Patterns
- None — Phase 1 establishes the foundational patterns for all subsequent phases

### Integration Points
- Phase 2 will connect DeepSeek simulation service to the TRIBEv2 inference pipeline established here
- Phase 2 will expand the 3-stage job lifecycle to 5 stages
- Phase 3 will add ROI aggregation on top of the activation arrays produced here

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Research summary provides detailed stack and architecture guidance.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation-and-tribev2-integration*
*Context gathered: 2026-04-08*
