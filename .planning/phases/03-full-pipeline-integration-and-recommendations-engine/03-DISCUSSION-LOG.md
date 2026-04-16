# Phase 3: Full Pipeline Integration and Recommendations Engine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-16
**Phase:** 03-full-pipeline-integration-and-recommendations-engine
**Areas discussed:** Per-screen activation strategy, Recommendations engine, Flow continuity + ROI score table, Blind-eval test + result schema

---

## Per-screen Activation Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| N inference calls | One `run_tribev2_text` per screen. Clean per-screen arrays; ~N× latency. | ✓ |
| Single call + segment by time | One inference on concatenated narrative; segment time axis by offsets. Risks misattribution. | |
| Single call + per-screen re-run on flags | Hybrid: one concatenated call, re-run any screen with ambiguous metrics. | |

**User's choice:** N inference calls (Recommended)

---

| Option | Description | Selected |
|--------|-------------|----------|
| `activations/{job_id}/screen_{n}.npy` | Per-screen .npy under job-scoped directory. | ✓ |
| `activations/{job_id}.npz` single archive | One compressed archive per job. | |
| Stacked `(n_screens, timesteps, vertices)` .npy | Single 3D array with padding. | |

**User's choice:** `activations/{job_id}/screen_{n}.npy` (Recommended)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Fail the job | Treat empty narrative as deterministic sim failure → ERROR naming the screen. | ✓ |
| Skip screen + zero activation | Partial success with zeros and a warning. | |
| Fallback to persona-only narrative | Synthesize baseline narrative. | |

**User's choice:** Fail the job (Recommended)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Keep `/test-inference` legacy intact | Phase 1 endpoints still work; no migration. | ✓ |
| Retire `/test-inference` | Remove dead code surface; risks breaking Phase 1 smoke tests. | |

**User's choice:** Keep legacy intact (Recommended)

---

## Recommendations Engine

| Option | Description | Selected |
|--------|-------------|----------|
| One consolidated DeepSeek-V3 call | Single call, full bundle, flat rec list covering REC-01..04. | ✓ |
| Per-rec-type (4 calls) | Separate call per REC-01..04 rec type. 4× cost, 4× retry surfaces. | |
| Per-screen call | One call per screen; struggles with cross-screen memorability. | |

**User's choice:** One consolidated call (Recommended)

---

| Option | Description | Selected |
|--------|-------------|----------|
| ROI + sim log + persona (text only) | DeepSeek-V3 text-only. No screen images sent. Cheap, fast, model-swap-friendly. | ✓ |
| ROI + sim log + persona + screen images (VL2) | Re-inspect screens visually; richer element specificity; 10× cost. | |
| ROI + persona only | Minimal input; REC-02 has no basis; not viable. | |

**User's choice:** Text only (Recommended) — confirmed after plain-language explanation of the tradeoffs
**Notes:** User initially asked for an easy-language explanation; after receiving it, explicitly confirmed the recommended option.

---

| Option | Description | Selected |
|--------|-------------|----------|
| `target_region` coords + event note | Reuse existing sim schema; no changes to Phase 2. | ✓ |
| Add `element_id` field to SimulationLog events | Retroactive Phase 2 schema change; high churn. | |
| Separate DeepSeek-VL2 element-labeling pass | New 6th stage; significant complexity. | |

**User's choice:** `target_region` + event note (Recommended)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Flat list with rec_type discriminator | One Pydantic model; blind-eval walks one list. | ✓ |
| Separate lists per rec type | 4 separate keys; 4 separate models. | |
| Nested per-screen | Natural for side-by-side view; awkward for cross-screen recs. | |

**User's choice:** Flat discriminated list (Recommended)

---

## Flow Continuity + ROI Score Table

| Option | Description | Selected |
|--------|-------------|----------|
| Per-screen scores + deltas + trend tags | Rich trajectory structure; cheap to compute; easy to render. | ✓ |
| Per-screen scores only | Raw scores; frontend computes deltas/trends. | |
| Smoothed time-series | Continuous interpolated curve; hides screen boundaries. | |

**User's choice:** Per-screen scores + deltas + trend tags (Recommended)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Both circuits AND regions | 5-circuit summary + ~15-region detail; both `mean` and `peak`. | ✓ |
| Circuits only (5 rows) | Simpler; loses precision for REC-01 citations. | |
| Regions only (~15 rows) | Most precise; frontend must aggregate. | |

**User's choice:** Both circuits AND regions (Recommended)

---

## Blind-eval Test + Result Schema

| Option | Description | Selected |
|--------|-------------|----------|
| Pytest fixture with two opposite profiles | Two synthetic ROI bundles, Jaccard<0.4 on rec text, mandatory evidence scores. Skipped when `DEEPSEEK_API_KEY` absent. | ✓ |
| One-off script in `scripts/` | Manual run before shipping; no CI enforcement. | |
| Both pytest + `/eval` route | CI + on-demand; extra surface to maintain. | |

**User's choice:** Pytest fixture (Recommended)

---

| Option | Description | Selected |
|--------|-------------|----------|
| One `result_json` blob, `schema_version: 1` | Everything in `Job.result_json`; vertex arrays on disk; no new tables. | ✓ |
| Normalized tables (ScreenActivation, ROIResult, Recommendation) | Cleaner queries; alembic migration; Phase 5 loader changes. | |

**User's choice:** One big `result_json` blob (Recommended)

---

## Claude's Discretion

- New service module layout (`continuity.py`, `recommendations.py`, vertex-label helper in `roi_aggregation.py` vs new module)
- DeepSeek rec prompt wording — iterate until blind-eval passes in execution
- Trend-tag delta thresholds (start ±5 on 0–100, tune)
- Score rank cutoffs (default 0–24 / 25–49 / 50–74 / 75–100)
- Whether to cache Destrieux surface atlas under `model_cache/nilearn/`
- Rec call temperature / max_tokens (start with Phase 2 defaults)

## Deferred Ideas

- Normalized SQL tables for results — v1.x
- `/eval` on-demand endpoint — not needed; pytest fixture is the gate
- Retroactive `element_id` on sim events — not needed
- Subcortical activation (ADV-02) — v2, blocked on Meta checkpoint
- A/B variant comparison (ADV-01) — v2
- 300s job timeout + 429 queue-depth — Phase 5
- Smoothing/interpolation of cross-screen scores — deltas + trends are richer
