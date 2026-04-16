# Phase 3: Full Pipeline Integration and Recommendations Engine - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Connect the proven pieces into an end-to-end analysis: for each persona + content pair, run per-screen TRIBEv2 inference, aggregate to the 5 named circuits + named regions, compute cross-screen continuity, and generate grounded copy recommendations. Persist the full structured result in `Job.result_json` with vertex arrays on disk.

Out of scope:
- Frontend visualization and UI label rescaling (Phase 4)
- Session history / re-open UX, demo case study, 300s timeout watchdog, queue-depth 429 (Phase 5)
- Sim schema changes — sim log + grounding are frozen at Phase 2 output
- New `/test-inference` behavior — legacy path stays untouched

</domain>

<decisions>
## Implementation Decisions

### Per-screen Activation Strategy (BRAIN-01, BRAIN-02)
- **D-01:** Run `run_tribev2_text` once per screen. Each `screen.narrative_text` is its own inference call, producing its own `(n_timesteps, ~20k vertices)` activation array. Accepts ~N× latency on N-screen flows in exchange for clean per-screen semantics required by BRAIN-02. Replaces the Phase 2 concatenated-narrative path in `backend/core/queue.py:_process_job`.
- **D-02:** Per-screen vertex arrays stored at `activations/{job_id}/screen_{n}.npy` (1-indexed to match uploads convention). Job-scoped directory created by the `inference` stage. `result_json.activations` stores `[{screen_index, path, shape, timesteps}]` for each screen.
- **D-03:** Empty or trivial narrative on any screen fails the job. SimulationLog's `min_length=1` Pydantic constraint on `narrative_text` already enforces this at schema validation time; if a grounded sim log still arrives with an effectively empty screen narrative, treat it as a deterministic sim failure (no retry) → job `ERROR` with message naming the screen.
- **D-04:** Keep the Phase 1 `/test-inference` legacy path intact. `_run_inference_only` in `queue.py` continues to serve jobs with `persona_id IS NULL AND content_id IS NULL`. Only the analyze branch (`legacy_phase1 == False`) adopts per-screen inference. No alembic migration for this.
- **D-05:** Per-screen inference inherits Phase 1 D-07 / Phase 2 D-20 retry policy — each screen call retries once, then raises and the job transitions to ERROR with a message naming which screen and the underlying error. No partial-success; a flow either completes fully or errors.

### Recommendations Engine (REC-01..04)
- **D-06:** One consolidated DeepSeek-V3 call per job produces the full recommendations bundle. Input: persona profile + full simulation log + per-screen ROI scores (circuits and regions) + flow continuity trajectory. Output: a single flat recommendations list covering REC-01..04. Cheaper, fewer retry surfaces, single prompt to iterate on.
- **D-07:** Text-only input bundle. No screen images sent to the rec call — keeps it on DeepSeek-V3 (`deepseek-chat`), decoupled from the vision provider, fast, and cheap. All spatial references come from the sim log's existing `target_region` coordinates. Respects model-swap isolation: the rec engine never touches TRIBEv2-specific shapes directly, only the aggregated ROI contract.
- **D-08:** Layout element identifiers for REC-02 use the existing `simulation.Event.target_region` (x_ratio, y_ratio, width_ratio, height_ratio) plus `event.note` as a human-readable element description. No changes to the Phase 2 SimulationLog schema. Each recommendation cites `{screen_index, target_region, element_description}`; Phase 4 renders an overlay box on the screen at those coords.
- **D-09:** Recommendation output schema is a flat discriminated list:
  ```
  recommendations: [
    {
      rec_type: "copy_rewrite" | "layout_flag" | "memorability" | "emotional_dropoff",
      screen_index: int,
      evidence: { circuit: str, region: str, activation_score: float, score_rank: "Low"|"Moderate"|"High"|"Very High" },
      target_region?: TargetRegion,
      element_description?: str,
      before?: str,
      after?: str,
      rationale: str
    }
  ]
  ```
  `evidence` is mandatory on every rec (the blind-eval test gates on it). `target_region` and `before/after` are optional per rec_type. Validated by a new Pydantic v2 model in `backend/models/recommendations.py`.
- **D-10:** Rec call inherits the Phase 2 D-04 retry-once-on-schema-fail policy. Uses `deepseek_text_completion` with a Recommendations Pydantic response model; a single repair prompt on validation failure; then ERROR.

### Flow Continuity (BRAIN-03)
- **D-11:** Per-screen scores + deltas + trend tags. For each of the 5 circuits, emit `{screen_index, score_0_100, delta_from_prev}` per screen plus a `trend: "rising"|"dropping"|"flat"|"volatile"` tag per circuit over the full flow. Computed deterministically in `backend/services/continuity.py` from the per-screen ROI output — no LLM involvement.
- **D-12:** Trend classification rules documented in the service: rising if monotonically increasing above a delta floor, dropping if monotonically decreasing, flat if deltas stay below the floor, volatile otherwise. Thresholds are Claude's discretion during implementation but MUST be module-level constants (not inlined) so they can be tuned.

### ROI Aggregation and Named-region Table (BRAIN-04)
- **D-13:** Per screen, emit BOTH granularities:
  - `circuits: {Attention: {score, peak}, Cognitive Load: {...}, Emotional Response: {...}, Memory Encoding: {...}, Reward: {...}}` — 5 rows, the consumer-facing summary
  - `regions: [{atlas_label, circuit, score, peak}, ...]` — ~15 rows from the `ROI_CIRCUIT_MAP` in `roi_aggregation.py`, gives recs and future UI drill-down the precision needed for BRAIN-04
- **D-14:** Temporal reduction keeps both `mean` (across timesteps, current behavior) AND `peak` (max across timesteps) per region/circuit. Scores on disk stay in TRIBEv2's native scalar range; the 0–100 rescaling + qualitative labels (Low / Moderate / High / Very High) happen at `result_json` write time so the rec engine and Phase 4 both consume the same normalized values.
- **D-15:** Fix the existing `aggregate_roi_scores` mismatch. The current function compares against raw `atlas_labels` strings (Destrieux `labels`) but does NOT map to fsaverage5 vertex indices — that wiring must land in Phase 3 before any of the above is correct. Use `nilearn.datasets.fetch_atlas_surf_destrieux` (fsaverage5 surface parcellation) to get per-vertex region labels, then aggregate the TRIBEv2 output's ~20k vertices by those labels. This is the correctness prerequisite for every BRAIN-0x success criterion.

### Blind-evaluation Test (success criterion #3 gate)
- **D-16:** Pytest fixture in `backend/tests/test_recommendations_blind_eval.py`. Two synthetic ROI bundles built in-fixture ("high_cog_load_low_reward" vs "low_cog_load_high_reward") with the same persona and sim log. Each is passed into the rec engine.
- **D-17:** Pass conditions (all must hold, otherwise test fails):
  1. Every rec's `evidence.activation_score` is numerically present in the input ROI bundle (no fabricated scores).
  2. Rec text sets differ between the two profiles — Jaccard similarity on the union of `before`+`after`+`rationale` must be below 0.4.
  3. Every rec cites a `circuit` that exists in the 5 named circuits and a `region` that exists in `ROI_CIRCUIT_MAP`.
- **D-18:** Test requires a live `DEEPSEEK_API_KEY`. `pytest.skip` with a clear message when absent so CI green-lights regardless of secret availability. Running it is part of Phase 3 UAT and a hard gate for success criterion #3.

### Result Persistence Schema (success criterion #5)
- **D-19:** One consolidated `result_json` blob per job on DONE, versioned via `schema_version: 1`:
  ```
  {
    "schema_version": 1,
    "simulation": { ... },               // from Phase 2
    "overlays": [ ... ],                  // from Phase 2
    "activations": [{screen_index, path, shape, timesteps}],
    "roi": [{screen_index, circuits, regions}],
    "flow_continuity": {circuits: {Attention: {per_screen: [...], trend: "..."}, ...}},
    "recommendations": [ ... ]            // flat list per D-09
  }
  ```
  No new SQLAlchemy tables for Phase 3. Normalized tables deferred to v1.x if/when session re-open perf becomes a real concern.
- **D-20:** Vertex arrays on disk at `activations/{job_id}/screen_{n}.npy` (D-02). `result_json.activations[i].path` is the relative path; Phase 4/5 load selectively per screen.

### Job Lifecycle
- **D-21:** Lifecycle extends Phase 2 D-18 StageEnum with two new stages inserted in order: `ROI_AGGREGATION` (after `INFERENCE`, before `PROCESSING`) and `RECOMMENDATIONS` (after `PROCESSING`, before DONE). Full order: `SIMULATION → GROUNDING_CHECK → INFERENCE → ROI_AGGREGATION → PROCESSING → RECOMMENDATIONS → (DONE)`. No schema change — `Job.stage` column still accepts the enum string values.
- **D-22:** All stage transitions MUST go through `backend/core/queue.transition()` (Phase 2 D-19). Any new service (continuity, roi, recommendations) is invoked from `_process_job`, not from its own transition code.

### Claude's Discretion
- Module layout for new files: `backend/services/continuity.py`, `backend/services/recommendations.py`, and the vertex-label fetch helper inside `roi_aggregation.py` (refactor vs new module) are judgment calls
- Exact DeepSeek prompt wording for the rec call — iterate until the blind-eval test passes in Phase 3 execution
- Trend-tag delta thresholds (D-12) — start with ±5 (on 0–100 scale) and tune
- The `score_rank` cutoffs for Low / Moderate / High / Very High on the 0–100 scale — pick defaults (e.g., 0–24 / 25–49 / 50–74 / 75–100) and document in the recommendations model
- Whether to cache the fetched Destrieux surface atlas under `model_cache/nilearn/` (likely yes, matches existing pattern)
- Internal Pydantic model organization — one file per domain (`models/roi.py`, `models/recommendations.py`, `models/continuity.py`) vs one consolidated `models/results.py`
- Rec engine's exact temperature and max_tokens values — start with Phase 2 defaults (0.6, 4000) and adjust if blind-eval is flaky

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project requirements & vision
- `.planning/PROJECT.md` — Core value (simulation before brain analysis), non-commercial license, stack decisions
- `.planning/REQUIREMENTS.md` — BRAIN-01..04 and REC-01..04 acceptance criteria (what must be TRUE for Phase 3 to count as delivered)
- `.planning/ROADMAP.md` §"Phase 3: Full Pipeline Integration and Recommendations" — Phase boundary, success criteria, plan list (03-01, 03-02, 03-03)

### Research (produced in Phase 0)
- `.planning/research/STACK.md` — Library versions (nilearn 0.11.x, Pydantic v2, aiosqlite, DeepSeek via OpenAI-compatible httpx)
- `.planning/research/ARCHITECTURE.md` — Pipeline shape, model-swap isolation boundary, single-worker GPU queue
- `.planning/research/PITFALLS.md` — Pitfall #5 (cortical proxies only, no subcortical labels), #6 (recommendations must cite ROI; blind-eval mandatory)
- `.planning/research/SUMMARY.md` §"Phase 3" — ROI aggregation via Destrieux atlas, two-call separation (simulation vs recommendations is already separate — Phase 3 adds the second call)

### Prior phase context (decisions carried forward)
- `.planning/phases/01-foundation-and-tribev2-integration/01-CONTEXT.md` — D-07 retry-once, D-10/D-11 consumer-friendly circuit names + cortical proxies, D-05 endpoint shape, D-06 lifecycle extensibility
- `.planning/phases/02-simulation-pipeline-and-content-input/02-CONTEXT.md` — D-01 model dispatch (V3 for text, VL2 for images), D-04/D-20 retry policy per stage, D-17 single source of truth in `Job.result_json`, D-18/D-19 StageEnum + `transition()` helper is mandatory, D-11 `POST /analyze` contract
- Phase 1 and Phase 2 VERIFICATION.md reports — Phase 3 planner must confirm both marked complete before starting

### Existing codebase anchors (read before touching)
- `backend/core/queue.py` — `_process_job`, `transition()`, `_run_inference_with_retry`; this is where the new stages slot in
- `backend/services/inference.py` — `run_tribev2_text` is called N times (once per screen) from the new analyze branch; DO NOT modify this file's signatures (model-swap isolation)
- `backend/services/roi_aggregation.py` — `ROI_CIRCUIT_MAP` stays, but `aggregate_roi_scores` needs fsaverage5 vertex-label wiring (D-15)
- `backend/models/job.py` — `StageEnum` extends with `ROI_AGGREGATION` and `RECOMMENDATIONS` (D-21)
- `backend/models/simulation.py` — `SimulationLog`, `Event`, `TargetRegion` stay frozen; rec schema references these shapes
- `backend/services/deepseek_client.py` — `deepseek_text_completion` is reused for the rec call (D-10)
- `backend/services/simulation.py` — Existing sim pathway; Phase 3 consumes its output unchanged
- `backend/services/overlay.py` — Output structure informs how Phase 4 renders the sim map; recs point to the same `target_region` coords

### External references
- nilearn `fetch_atlas_surf_destrieux` docs — fsaverage5 surface parcellation returns per-vertex region label IDs, the missing piece in current `aggregate_roi_scores` (D-15)
- TRIBEv2 HF model card — output shape `(n_timesteps, ~20k vertices)` is the input contract for D-15

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/core/queue.py:_process_job` — Extend in-place; add the new stages between existing INFERENCE and final DONE transition
- `backend/core/queue.py:transition` — Mandatory for every new stage write
- `backend/services/deepseek_client.py:deepseek_text_completion` — Used as-is for the recommendations call with a new Pydantic response model
- `backend/services/roi_aggregation.py:ROI_CIRCUIT_MAP` — The circuit → region mapping is correct; only the vertex-aggregation function needs a fix
- `backend/services/inference.py:run_tribev2_text` — Called once per screen; no signature changes
- `Job.result_json` JSON column — Everything Phase 3 emits fits here under new keys; no new columns, no alembic migration
- `Job.stage` String column — Accepts the two new StageEnum values without migration

### Established Patterns
- Pydantic v2 response models validated by `deepseek_text_completion` (Phase 2 precedent) — apply same pattern to a `Recommendations` model
- Retry-once-then-ERROR across all external calls (Phase 1 D-07, Phase 2 D-04) — apply to both per-screen inference loop and the single rec call
- StageEnum + `transition()` helper (Phase 2 D-19) — every new service integrates via this pattern, not direct string writes
- Pure-code stages fail hard (Phase 2 D-20) — continuity and ROI aggregation exceptions are bugs, no retry

### Integration Points
- Phase 4 consumes `result_json.activations[i].path` + per-screen ROI + recommendations; Phase 3 must emit the schema exactly as documented in D-19 or Phase 4 reads need to be rewritten
- Phase 5 re-open reads the same `result_json` without re-running inference; the `schema_version: 1` field gates the re-open logic
- Model-swap boundary stays at `backend/services/inference.py` — nothing else in Phase 3 may depend on TRIBEv2-specific shapes beyond the `(n_timesteps, n_vertices)` contract
- Vision provider (Phase 2) is untouched by Phase 3 — rec engine is text-only (D-07)

</code_context>

<specifics>
## Specific Ideas

- Follow the Phase 2 coding style: `from __future__ import annotations`, async SQLAlchemy 2.0, Pydantic v2, no sync I/O in request handlers, module-level constants over magic numbers.
- The `Recommendations` Pydantic model should live in `backend/models/recommendations.py` with a docstring describing the flat discriminated list and the mandatory `evidence` field — downstream readers (rec engine prompt, blind-eval test, Phase 4) will read this as the contract.
- The `roi_aggregation.py` vertex-label wiring (D-15) is the correctness cornerstone. Land it FIRST in Phase 3 execution; every other Phase 3 deliverable depends on it producing numerically meaningful per-screen ROI scores.
- Blind-eval fixtures should be readable — name circuits and regions explicitly in the JSON, avoid magic numbers in the test file so a human reviewer can verify the two profiles really are opposite.

</specifics>

<deferred>
## Deferred Ideas

- Normalized SQL tables for ScreenActivation / ROIResult / Recommendation — deferred to v1.x; v1 uses single result_json blob (D-19)
- `/eval` on-demand endpoint for re-running blind-eval without pytest — not needed in Phase 3; pytest fixture is the gate
- Retroactive `element_id` field on SimulationLog events — not needed; `target_region` + event note is sufficient per D-08. If Phase 4 rendering needs stronger IDs we'll revisit.
- Subcortical activation (ADV-02, GitHub issue #23) — blocked on Meta releasing a subcortical checkpoint; v2
- A/B variant comparison (ADV-01) — v2, depends on stable session persistence
- 300s job timeout watchdog — Phase 5
- Queue-depth 429 rejection — Phase 5
- Smoothing / interpolation between screen scores for continuity — not needed; deltas + trend tags are richer for the rec engine than an interpolated curve

</deferred>

---

*Phase: 03-full-pipeline-integration-and-recommendations-engine*
*Context gathered: 2026-04-16*
