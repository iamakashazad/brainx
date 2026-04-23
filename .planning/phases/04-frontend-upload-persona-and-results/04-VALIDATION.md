---
phase: 4
slug: frontend-upload-persona-and-results
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-23
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.x (frontend unit/component), Playwright 1.59.x (frontend e2e), pytest (backend vertex-endpoint addition) |
| **Config file** | `frontend/vitest.config.ts` (Wave 0 — to create), `frontend/playwright.config.ts` (Wave 0 — to create), `pytest.ini` (exists) |
| **Quick run command** | `cd frontend && npm run test -- --run` |
| **Full suite command** | `cd frontend && npm run test -- --run && npx playwright test && cd .. && ~/.venvs/brainx/bin/python -m pytest tests/test_vertex_endpoint.py -q` |
| **Estimated runtime** | ~90 seconds (Vitest ~20s, Playwright happy path ~40s, pytest ~5s, overhead ~25s) |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend && npm run test -- --run --changed` (falls back to full suite on config changes)
- **After every plan wave:** Run `cd frontend && npm run test -- --run` (full Vitest suite)
- **Before `/gsd-verify-work`:** Full suite (Vitest + Playwright + pytest) must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

> Task IDs are placeholders — the planner will fill in exact IDs (04-01-XX, 04-02-XX, 04-03-XX). Rows reflect the invariants from RESEARCH.md §Validation Architecture.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-W0 | 01 | 0 | — | — | Wave 0 sets up vitest + playwright + msw | infra | `cd frontend && npm run test -- --run --reporter=verbose tests/setup.ts` | ❌ W0 | ⬜ pending |
| 04-01-XX | 01 | 1 | FE-02 | V5 input validation | Persona form rejects out-of-range age (0–120) via zod | component | `vitest frontend/src/features/wizard/__tests__/PersonaForm.test.tsx --run` | ❌ W0 | ⬜ pending |
| 04-01-XX | 01 | 1 | FE-02 | V5 input validation | Multipart upload posts 1–5 screens to `/content/screens` with correct FormData structure | component + MSW | `vitest frontend/src/features/content/__tests__/ScreenUploader.test.tsx --run` | ❌ W0 | ⬜ pending |
| 04-01-XX | 01 | 1 | FE-02 | V5 input validation | `/analyze` request body validated against API-contract types before submit | unit | `vitest frontend/src/features/wizard/__tests__/submitAnalyze.test.ts --run` | ❌ W0 | ⬜ pending |
| 04-01-XX | 01 | 1 | FE-02 | V8 data protection | Uploaded screen blobs never logged to console in dev or prod build | unit | `vitest frontend/src/lib/__tests__/logger.test.ts --run` | ❌ W0 | ⬜ pending |
| 04-01-XX | 01 | 1 | FE-02 | — | `localStorage` rehydrate restores partial wizard state after refresh | component | `vitest frontend/src/features/wizard/__tests__/rehydrate.test.ts --run` | ❌ W0 | ⬜ pending |
| 04-02-XX | 02 | 1 | FE-02 | V7 error handling | Polling stops on `DONE`; auto-transitions to results view | component + fake timers | `vitest frontend/src/features/run/__tests__/useJobStatus.test.ts --run` | ❌ W0 | ⬜ pending |
| 04-02-XX | 02 | 1 | FE-02 | V7 error handling | Polling stops on `ERROR`; renders "Analysis failed" with Try Again CTA; no backend trace leaked | component | `vitest frontend/src/features/run/__tests__/ProgressView.test.tsx --run` | ❌ W0 | ⬜ pending |
| 04-02-XX | 02 | 1 | FE-02 | — | 6 backend stages map to the 4 UI-SPEC'd display stages via `stageLabels.ts` | unit | `vitest frontend/src/lib/__tests__/stageLabels.test.ts --run` | ❌ W0 | ⬜ pending |
| 04-02-XX | 02 | 1 | FE-02 | — | In-flight job resumes polling after refresh (rehydrate from `localStorage`) | component + fake timers | `vitest frontend/src/features/run/__tests__/rehydrate-polling.test.ts --run` | ❌ W0 | ⬜ pending |
| 04-03-W0 | 03 | 0 | FE-01 | — | Backend vertex endpoint returns 20484 Float32 values for `(job_id, screen_index)` | integration (pytest) | `~/.venvs/brainx/bin/python -m pytest tests/test_vertex_endpoint.py -q` | ❌ W0 | ⬜ pending |
| 04-03-XX | 03 | 1 | FE-01 | — | R3F canvas mounts with fsaverage5 mesh + vertex color buffer | component | `vitest frontend/src/features/results/__tests__/BrainCanvas.test.tsx --run` | ❌ W0 | ⬜ pending |
| 04-03-XX | 03 | 1 | FE-01 | — | `computeColorBuffer(activations, parcellation, activeCircuit)` produces 20484×3 Float32 with active-circuit regions colored and others neutral | unit (pure fn) | `vitest frontend/src/features/results/__tests__/colorBuffer.test.ts --run` | ❌ W0 | ⬜ pending |
| 04-03-XX | 03 | 1 | FE-01 | — | Circuit toggle triggers color-buffer recomputation (mock mesh update) | component | `vitest frontend/src/features/results/__tests__/CircuitSelector.test.tsx --run` | ❌ W0 | ⬜ pending |
| 04-03-XX | 03 | 1 | FE-01 | — | Scrubber drag to screen N triggers activation fetch for that screen | component | `vitest frontend/src/features/results/__tests__/TimelineScrubber.test.tsx --run` | ❌ W0 | ⬜ pending |
| 04-03-XX | 03 | 1 | FE-02 | — | ResultsLayout mounts `BrainCanvas` + `RecommendationsPanel` side-by-side (grid columns verified) | component | `vitest frontend/src/features/results/__tests__/ResultsLayout.test.tsx --run` | ❌ W0 | ⬜ pending |
| 04-03-XX | 03 | 1 | FE-02 | V5 input validation | Clicking `RecommendationCard` sets `activeRecId`, `activeScreenIndex`, `activeCircuit` in store and emits highlight event | component | `vitest frontend/src/features/results/__tests__/RecommendationCard.test.tsx --run` | ❌ W0 | ⬜ pending |
| 04-03-XX | 03 | 1 | FE-02 | — | Recommendation footer shows `{circuit} · {region} · {score}/100 · {rank}` from evidence (grounding citation surfaces) | component | `vitest frontend/src/features/results/__tests__/RecommendationCard.test.tsx --run` | ❌ W0 | ⬜ pending |
| 04-03-XX | 03 | 1 | FE-02 | — | `ROIScoreTable` renders all regions from `roi[activeScreenIndex].regions` sorted by score desc | component | `vitest frontend/src/features/results/__tests__/ROIScoreTable.test.tsx --run` | ❌ W0 | ⬜ pending |
| 04-03-XX | 03 | 1 | FE-02 | — | `CircuitScoreBar` ×5 renders the canonical five circuit names with correct chart-N gradient assignment | component | `vitest frontend/src/features/results/__tests__/CircuitScoreBar.test.tsx --run` | ❌ W0 | ⬜ pending |
| e2e-happy | — | verify | FE-01 + FE-02 | — | Full happy path: persona → upload text → analyze → poll → results load with brain viz + recs | e2e | `cd frontend && npx playwright test tests/e2e/happy-path.spec.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend/package.json` + Vite scaffold — greenfield project init (if not created by plan 04-01 Wave 0 setup task)
- [ ] `frontend/vitest.config.ts` — jsdom env, setup file path
- [ ] `frontend/tests/setup.ts` — jest-dom matchers, MSW server, fake fetch globals
- [ ] `frontend/tests/msw/handlers.ts` — MSW handlers mirroring `/personas`, `/content/*`, `/analyze`, `/jobs/{id}`, `/jobs/{id}/activations/{n}`
- [ ] `frontend/playwright.config.ts` — base URL, fixtures
- [ ] `frontend/src/lib/api-types.ts` — TypeScript types mirroring backend Pydantic schemas
- [ ] `frontend/src/lib/api-schemas.ts` — zod parsers for runtime validation at API boundary
- [ ] `tests/test_vertex_endpoint.py` — pytest coverage for the NEW per-screen vertex-streaming endpoint. Must assert: 200 response, `Content-Type: application/octet-stream`, body length == 20484 × 4, correct shape header, 404 on unknown `(job_id, screen_index)`
- [ ] Framework install: `cd frontend && npm install -D vitest @vitest/ui @testing-library/react @testing-library/user-event jsdom msw @playwright/test` — no existing JS test harness present

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 3D brain canvas visual fidelity (colormap, AO, camera) matches UI-SPEC §Brain Viz | FE-01 | WebGL visual quality is not meaningful to snapshot in jsdom; screenshot diff is brittle with fixed-seed lighting | Run dev server, load a completed fixture job, capture screenshot of `BrainCanvas` with each of the 5 circuits active and visually compare against UI-SPEC §Brain Viz reference |
| Motion / transitions match UI-SPEC §Motion Contract | FE-02 | Animation smoothness / timing is not automatable without visual regression harness | Exercise upload → progress → results transitions in the dev server; confirm no jank, transitions respect UI-SPEC durations |
| Accessibility spot-check: keyboard nav through wizard → progress → results | FE-01 + FE-02 | Axe-core catches most but final keyboard/focus order review is manual | Tab through full happy path without mouse; confirm focus order, visible focus rings, no focus traps |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (all commands use `--run` / non-watch)
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
