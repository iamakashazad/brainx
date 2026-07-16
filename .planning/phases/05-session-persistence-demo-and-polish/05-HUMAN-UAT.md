---
status: partial
phase: 05-session-persistence-demo-and-polish
source: [05-VERIFICATION.md]
started: 2026-04-30T12:16:00Z
updated: 2026-04-30T12:16:00Z
---

## Current Test

awaiting human testing

## Tests

### 1. Root Dashboard/Session History Browser Flow

expected: Open `/`; past sessions and the pinned demo card are visible, and New Analysis starts the routed analysis flow.
result: [pending]

### 2. Reload Completed Session Without Rerunning Inference

expected: Click a completed session card; results render from `GET /jobs/{jobId}`. No `POST /analyze` is fired.
result: [pending]

### 3. Demo Case Study Browser Flow

expected: Click the pinned demo card; results render from `/demo/result.json` and `/demo/activations/screen_1.bin`. No `POST /analyze` is fired.
result: [pending]

### 4. Theme Persistence and No-FOUC

expected: Toggle theme, reload the page, and confirm the selected palette is applied before React hydrates.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps

