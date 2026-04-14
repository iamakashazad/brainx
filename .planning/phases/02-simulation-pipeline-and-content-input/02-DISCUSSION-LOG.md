# Phase 2: Simulation Pipeline and Content Input - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-14
**Phase:** 02-simulation-pipeline-and-content-input
**Areas discussed:** DeepSeek simulation service, Persona builder + content upload APIs, Simulation log + scroll/hesitation overlay

---

## DeepSeek Simulation Service

### Q1 — Model mix per content type

| Option | Description | Selected |
|--------|-------------|----------|
| VL2 for anything with an image, V3 for text-only | Content type dispatches model; matches REQUIREMENTS note | ✓ |
| V3 everywhere — pre-describe images with a vision pass | Two LLM hops for image content | |
| VL2 everywhere — even for pasted text | Uniform pipeline; wastes vision capacity | |

**User's choice:** VL2 for image content, V3 for text-only.

### Q2 — Output shape

| Option | Description | Selected |
|--------|-------------|----------|
| Strict JSON schema via response_format + Pydantic validation | Clean contract; rejects/repairs on parse failure | ✓ |
| Freeform narrative text only — parse downstream | More faithful to SIM-04 raw log, second LLM call needed | |
| Hybrid — structured JSON + embedded narrative field | One call, both needs met | |

**User's choice:** Strict JSON schema via response_format + Pydantic validation. (Per-screen `narrative_text` inside the schema covers SIM-04 — see D-13/D-14.)

### Q3 — Hallucination / grounding validation

| Option | Description | Selected |
|--------|-------------|----------|
| LLM-as-judge with VL2 re-check | Second VL2 pass returns unseen references; zero-tolerance threshold | ✓ |
| Regex-based pattern check | Cheap but brittle; fails for paraphrased references | |
| Prompt-only guardrails, no validation pass | Fastest; can't prove Phase 2 SC #3 | |

**User's choice:** LLM-as-judge with VL2 re-check, zero-tolerance.

### Q4 — Failure handling

| Option | Description | Selected |
|--------|-------------|----------|
| Retry once, then ERROR with descriptive message | Matches Phase 1 D-07 pattern; repair prompt for schema failures | ✓ |
| Retry up to 3x with exponential backoff | More forgiving; extends latency, blocks worker | |
| Fail immediately on any error — no retry | Simplest; risk of transient-error frequency | |

**User's choice:** Retry once with repair prompt for schema errors; no retry on hallucination; then ERROR.

---

## Persona builder + content upload APIs

### Q1 — Persona schema

| Option | Description | Selected |
|--------|-------------|----------|
| Single personas row with typed JSON fields per group | Matches Phase 1 JSON-in-SQLite pattern; Pydantic validates | ✓ |
| Fully normalized — separate tables per group | Queryable fields; overkill for single-user tool | |
| Single flat table with all fields as columns | Brittle; requires migration per field | |

**User's choice:** Typed JSON columns per group.

### Q2 — Resource composition

| Option | Description | Selected |
|--------|-------------|----------|
| Persona and Content saved independently; Job references both by ID | Enables PERS-04 reuse and FE-04 re-open | ✓ |
| Single POST /analyze accepts everything inline | Can't reuse persona without a save endpoint anyway | |
| Two-step: save persona, content submitted with /analyze | Breaks FE-04 session re-open | |

**User's choice:** Persona and Content as independent resources; Job references both.

### Q3 — Content storage

| Option | Description | Selected |
|--------|-------------|----------|
| Files on disk under uploads/{content_id}/, metadata + paste text in SQLite | Mirrors activations/{job_id}.npy pattern | ✓ |
| Everything in SQLite as BLOBs | Practical limits breached quickly | |
| Files on disk + JSON sidecar, no content table | Breaks session history queryability | |

**User's choice:** Disk for files, SQLite for metadata + text.

### Q4 — Image processing

| Option | Description | Selected |
|--------|-------------|----------|
| Pillow resize max 1024px long-edge, JPEG Q85, strip EXIF, 5MB pre-resize cap | Matches STACK.md; small VL2 payload, privacy-friendly | ✓ |
| Validate MIME and size only, pass original bytes | Wastes tokens; slower VL2 calls | |
| Aggressive 768px + WebP | VL2 WebP support undocumented; small-text risk | |

**User's choice:** 1024px JPEG Q85 pipeline with EXIF strip.

---

## Simulation log + scroll/hesitation overlay

### Q1 — Log schema

| Option | Description | Selected |
|--------|-------------|----------|
| Per-screen event list with narrative + structured events | Rich for overlays, readable as SIM-04, supports per-screen downstream | ✓ |
| Flat event stream across the session | Loses per-screen narrative grouping | |
| Narrative-only with lightweight event tags inline | Parsing brittle, implicit timestamps | |

**User's choice:** Per-screen `{ narrative_text, events[], summary_emotional_state, memorability_hypothesis }`.

### Q2 — Overlay derivation

| Option | Description | Selected |
|--------|-------------|----------|
| Deterministic backend derivation from structured events | No second LLM call; testable; cheap | ✓ |
| Second LLM pass translates narrative → overlay coordinates | Faithful but expensive, coordinates not well-calibrated | |
| Frontend parses and renders from raw events directly | Splits logic across layers | |

**User's choice:** Deterministic backend derivation via `backend/services/overlay.py`.

### Q3 — SIM-04 storage / exposure

| Option | Description | Selected |
|--------|-------------|----------|
| Persist full structured JSON in Job.result_json; GET /jobs/{id} returns it | Reuses Phase 1 column; one source of truth | ✓ |
| Separate simulation_logs table + dedicated endpoint | Overkill for per-job-by-definition data | |
| Save raw DeepSeek response to disk, serve via static path | Loses typed API access | |

**User's choice:** Persist in `Job.result_json`; single `GET /jobs/{id}` surface.

### Q4 — 5-stage lifecycle implementation

| Option | Description | Selected |
|--------|-------------|----------|
| Enum column + explicit transition helper | Single source of truth; Phase 1 column reused with zero migration | ✓ |
| String literals in worker code as today | Drift and typo risk | |
| Event-sourced stage history table | Overkill for research preview | |

**User's choice:** StageEnum + `transition(job, StageEnum.X)` helper in `backend/core/queue.py`.

---

## Claude's Discretion

- Exact DeepSeek prompt text for V3 and VL2 paths
- Internal module layout under `backend/services/`
- Alembic migration file naming
- Exact repair-prompt wording for schema-failure retry
- Whether to cache base64 of resized images vs re-encode per call
- Intensity-scale normalization rules for `events[].intensity`

## Deferred Ideas

- Job lifecycle / `/analyze` orchestration as a standalone area — folded into D-11/D-12/D-18..D-20 rather than discussed separately
- Rate limiting / queue-depth rejection — Phase 5
- 300s job timeout watchdog — Phase 5
- Multiple personas per session — OOS
- URL screenshot auto-capture — v2 (EXT-02)
- A/B variant comparison — v2 (ADV-01)
- Persisted auth / ownership — no auth in v1
