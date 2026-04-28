# Phase 5: Session Persistence, Demo, and Polish - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-28
**Phase:** 05-session-persistence-demo-and-polish
**Areas discussed:** Session History Design, Demo Entry Point & Data, Production Hardening, Deferred Phase 4 Polish

---

## Session History Design

| Option | Description | Selected |
|--------|-------------|----------|
| Card grid | Cards showing brain thumbnail + persona name + date + status badge | ✓ |
| Table / list | Compact row-based list; new pattern, no existing table component | |
| You decide | Claude picks given Phase 4 patterns | |

**User's choice:** Card grid

---

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal: date + persona name + status | Fast to render, no extra data fetching | ✓ |
| Rich: brain thumbnail + top recommendation snippet | Requires storing a preview asset during analysis | |
| Medium: date + persona + content type + top circuit | Shows highest-scoring circuit; data in result_json | |

**User's choice:** Minimal (date + persona name + status)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Home screen IS the history | App root shows history + New Analysis button | ✓ |
| Sidebar / nav link | Persistent nav; adds nav component not in Phase 4 | |
| You decide | Claude picks based on existing WizardShell structure | |

**User's choice:** Home screen IS the history

---

| Option | Description | Selected |
|--------|-------------|----------|
| Loads directly into results view | Re-opens Phase 4 results view with result_json | |
| Wizard replay from step 4 | Re-enters wizard at Results step | ✓ |
| Shareable URL /results/{job_id} | Bookmarkable; resolves Phase 4 deferred feature | |

**User's choice:** Wizard replay from step 4

---

## Demo Entry Point & Data

| Option | Description | Selected |
|--------|-------------|----------|
| Pinned card in history | Special "Demo" card always at top of history grid | ✓ |
| Prominent banner on home screen | Hero banner above history grid | |
| Dedicated /demo route | Separate URL; good for external sharing | |

**User's choice:** Pinned card in history

---

| Option | Description | Selected |
|--------|-------------|----------|
| Committed JSON fixture in frontend/public/ | Real AnalysisResult JSON; no backend call | ✓ |
| Seeded DB record on first startup | Requires backend change; DB-dependent | |
| Backend stub endpoint /demo/result | Dedicated read-only endpoint | |

**User's choice:** Committed JSON fixture in frontend/public/

---

| Option | Description | Selected |
|--------|-------------|----------|
| UI screen flow — a real product design | 2-3 screen design flow vs a marketing persona | |
| Static ad or social image | Single marketing image; doesn't showcase flow continuity | |
| You decide | Claude picks a reasonable scenario | |

**User's choice:** "I'll give the demo stuff later" — user will supply demo content. Claude provides documented placeholder.

---

## Production Hardening

| Option | Description | Selected |
|--------|-------------|----------|
| Mark FAILED after N minutes + log it | Configurable timeout, simple, recoverable | ✓ |
| Auto-retry once, then FAILED | retry_count already in Job model | |
| You decide | Claude picks appropriate behavior | |

**User's choice:** Mark FAILED after N minutes + log it

---

| Option | Description | Selected |
|--------|-------------|----------|
| Reject at depth ≥ 3, show friendly error | 503 response; prevents unbounded queue | ✓ |
| Allow any depth, just show queue position | No rejection; user may wait long | |
| You decide | Claude picks based on single-worker constraint | |

**User's choice:** Reject at depth ≥ 3 with friendly error

---

| Option | Description | Selected |
|--------|-------------|----------|
| Labels + error states + empty states | Full audit of all user-facing text | ✓ |
| Labels only | Just status/stage strings | |
| You decide | Claude audits incomplete strings | |

**User's choice:** Labels + error states + empty states

---

## Deferred Phase 4 Polish

| Option | Description | Selected |
|--------|-------------|----------|
| Light theme toggle | Wire :root token palette; tokens already exist | ✓ |
| Shareable /results/{job_id} URLs | Bookmarkable per-session URLs | ✓ |
| Neither — Phase 5 is persistence + demo + hardening only | Keep Phase 5 focused | |

**User's choice:** Both — light theme toggle AND shareable URLs are in scope for Phase 5.

---

## Claude's Discretion

- Demo fixture placeholder content and scenario
- Exact timeout value (suggested 10 min) and configuration approach
- Visual treatment of pinned demo card
- Positioning of "New Analysis" CTA on home screen
- 503 error message copy and whether queue depth is surfaced to user

## Deferred Ideas

- Content library / reuse UI — still deferred post-Phase 5
- AI-assisted persona creation — still deferred
- Full timeseries / peak-activation-time vertex delivery — still deferred
- A/B variant comparison (ADV-01) — v2 requirement
