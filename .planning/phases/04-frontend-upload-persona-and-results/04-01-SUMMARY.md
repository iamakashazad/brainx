---
phase: 04-frontend-upload-persona-and-results
plan: 01
subsystem: ui
tags: [react, vite, typescript, tailwindcss, radix-ui, react-query, zustand, vitest, msw]
requires:
  - phase: 03-full-pipeline-integration-and-recommendations-engine
    provides: stable persona/content/analyze/job backend contracts and result envelope types
  - phase: 03.2-verification-and-traceability-reconciliation
    provides: reconciled backend verification and stable Phase 4 execution baseline
provides:
  - Greenfield `frontend/` app scaffold with Vite, React 19, TypeScript, Tailwind v4, Vitest, Playwright, and MSW
  - Zod-validated API client for `/personas`, `/content/*`, `/analyze`, and `/jobs/{id}`
  - Persisted wizard shell with functional Persona and Content steps plus analyze kickoff
  - Phase 4 token pipeline copied from `04-DESIGN-TOKENS.css`
affects: [04-02, 04-03, frontend, phase-5]
tech-stack:
  added: [react@19.2.5, react-dom@19.2.5, vite@8.0.10, tailwindcss@4.2.4, @tanstack/react-query@5.100.1, zustand@5.0.12, react-hook-form@7.73.1, zod@4.3.6, msw@2.13.5, vitest@4.1.5, @playwright/test@1.59.1]
  patterns: [zod-validated fetch wrappers, persisted zustand wizard state, radix-plus-tailwind tokenized UI, TDD for step flows]
key-files:
  created: [frontend/package.json, frontend/src/lib/api.ts, frontend/src/stores/wizardStore.ts, frontend/src/features/persona/PersonaForm.tsx, frontend/src/features/content/ContentTypeTabs.tsx]
  modified: [frontend/src/App.tsx, frontend/src/features/wizard/WizardShell.tsx, frontend/tests/msw/handlers.ts]
key-decisions:
  - "Pinned React 19 and validated it against CONTEXT.md D-02's 2026-04-24 'React 18 or 19' allowance."
  - "Kept Step 3 and Step 4 intentionally stubbed in `WizardShell` because 04-02 and 04-03 own those views."
  - "Stored `jobId` in the wizard persist partial so 04-02 can resume polling after refresh without reworking store shape."
patterns-established:
  - "API boundary: every frontend fetch wrapper parses backend JSON through Zod before returning."
  - "Wizard state: persona/content/job progress lives in a persisted Zustand store under `brainx-wizard-state`."
  - "Frontend tests: Vitest + Testing Library + MSW are the default harness for step-level UI work."
requirements-completed: [FE-02]
duration: 10m
completed: 2026-04-24
---

# Phase 4 Plan 01: Frontend Upload Persona and Results Summary

**React 19 frontend foundation with token-driven wizard shell, saved-persona flow, upload tabs, and analyze kickoff against the shipped backend contract**

## Performance

- **Duration:** 10 min
- **Started:** 2026-04-24T14:55:58+02:00
- **Completed:** 2026-04-24T13:05:50Z
- **Tasks:** 3
- **Files modified:** 49

## Accomplishments

- Scaffolded `frontend/` with the Phase 4 stack: Vite, React 19, TypeScript, Tailwind v4, Vitest, Playwright, MSW, and the copied Phase 4 design-token pipeline.
- Delivered the Step 1 persona experience: persisted wizard shell, saved-persona library, 4-tab persona form, React Query mutations, and localStorage rehydration.
- Delivered the Step 2 content experience: text entry, UI screen upload, static image upload, and analyze kickoff that stores `jobId` and advances the wizard to Step 3.

## Scaffold Structure

- `frontend/src/lib/` establishes the typed boundary: `api-types.ts`, `api-schemas.ts`, `api.ts`, `logger.ts`, and `queryClient.ts`.
- `frontend/src/features/persona/` owns the persona library, card, tabbed form, progress indicator, schema, and React Query hooks.
- `frontend/src/features/content/` owns the three content tabs, shared drop zone, upload mutations, and client-side upload preflight.
- `frontend/src/features/wizard/` owns the stepper shell, persisted flow state hookup, and analyze submission hook.
- `frontend/src/styles/tokens.css` is a verbatim copy of `04-DESIGN-TOKENS.css`, imported by `frontend/src/styles/index.css`.

## Package Versions

- `react`: `19.2.5`
- `react-dom`: `19.2.5`
- `vite`: `8.0.10`
- `tailwindcss`: `4.2.4`
- `@tanstack/react-query`: `5.100.1`
- `zustand`: `5.0.12`
- `react-hook-form`: `7.73.1`
- `zod`: `4.3.6`
- `msw`: `2.13.5`
- `vitest`: `4.1.5`
- `@playwright/test`: `1.59.1`
- `@testing-library/jest-dom`: `6.9.1`

## API Client Surface

- `listPersonas(signal?: AbortSignal)`
- `createPersona(body: PersonaCreate, signal?: AbortSignal)`
- `deletePersona(id: string, signal?: AbortSignal)`
- `createTextContent(text: string, signal?: AbortSignal)`
- `uploadScreens(files: File[], signal?: AbortSignal)`
- `uploadStatic(file: File, signal?: AbortSignal)`
- `submitAnalyze(body: { persona_id: string; content_id: string }, signal?: AbortSignal)`
- `getJobStatus(jobId: string, signal?: AbortSignal)`

## Wizard Store

`frontend/src/stores/wizardStore.ts` persists this shape:

- `currentStep`
- `selectedPersonaId`
- `contentId`
- `contentType`
- `jobId`
- `activeScreenIndex`
- `activeCircuit`
- `activeRecId`
- `secondaryRecLocationCursor`

Final `partialize` list persisted to `brainx-wizard-state`:

- `currentStep`
- `selectedPersonaId`
- `contentId`
- `contentType`
- `jobId`

The view-only Step 4 fields are intentionally excluded from persistence: `activeScreenIndex`, `activeCircuit`, `activeRecId`, and `secondaryRecLocationCursor`.

## MSW Handlers Registered

- `GET http://localhost:8000/personas`
- `POST http://localhost:8000/personas`
- `DELETE http://localhost:8000/personas/:id`
- `POST http://localhost:8000/content/text`
- `POST http://localhost:8000/content/screens`
- `POST http://localhost:8000/content/static`
- `POST http://localhost:8000/analyze`
- `GET http://localhost:8000/jobs/:id`
- `GET http://localhost:8000/jobs/:id/activations/:screen`

## Task Commits

1. **Task 1: Scaffold frontend project with API/test foundation** - `1b78116` (`feat`)
2. **Task 2 RED: Add failing persona/store tests** - `846f13c` (`test`)
3. **Task 2 GREEN: Implement persona step and persisted wizard shell** - `6ba8248` (`feat`)
4. **Task 3 RED: Add failing content/analyze tests** - `279547f` (`test`)
5. **Task 3 GREEN: Implement content step and analyze kickoff** - `01634b9` (`feat`)

## Files Created/Modified

- `frontend/package.json` and `frontend/package-lock.json` pin the frontend toolchain and test stack.
- `frontend/src/lib/api.ts` centralizes all backend calls with Zod parsing on every response path.
- `frontend/src/stores/wizardStore.ts` establishes the persisted step/persona/content/job contract for later plans.
- `frontend/src/features/persona/PersonaForm.tsx` ships the 4-tab RHF + Zod persona builder.
- `frontend/src/features/content/ScreenUploader.tsx` and `frontend/src/features/content/StaticUploader.tsx` ship multipart upload flows.
- `frontend/src/features/wizard/WizardShell.tsx` wires navigation, Step 1/2 rendering, and analyze submission.
- `frontend/tests/msw/handlers.ts` provides the reusable mock contract for 04-02 and 04-03.

## Decisions Made

- React 19 was kept because CONTEXT.md D-02 was updated on 2026-04-24 to allow React 18 or 19, so the plan's React 19 pin is compliant rather than a deviation.
- Step 3 and Step 4 remain explicit placeholders in the wizard shell to preserve the plan boundary: 04-02 owns progress/polling and 04-03 owns results/brain rendering.
- The upload flow stores `contentId` immediately on successful upload/mutation, making the stepper and analyze CTA stateful without adding an intermediate content-review screen.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `@testing-library/jest-dom` to match the required Vitest setup**
- **Found during:** Task 1 (frontend scaffold verification)
- **Issue:** `frontend/tests/setup.ts` correctly imported `@testing-library/jest-dom/vitest`, but the package was missing from the pinned dependency list, causing the first test run to fail before suite execution.
- **Fix:** Added `@testing-library/jest-dom` to `frontend/package.json` and refreshed `frontend/package-lock.json`.
- **Files modified:** `frontend/package.json`, `frontend/package-lock.json`
- **Verification:** `cd frontend && npm run test -- --run src/lib/__tests__` passed after installation.
- **Committed in:** `1b78116`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The fix was necessary for the test harness the plan explicitly required. No scope creep.

## Issues Encountered

- The plan's `submitAnalyze.test.ts` filename is `.ts`, so the analyze-hook harness was implemented with `React.createElement` instead of JSX to keep the requested path while preserving coverage.
- TypeScript initially lacked `vite/client` and `vitest/globals` typing; the scaffold was corrected before Task 1 commit so `import.meta.env` and test globals typecheck cleanly.

## Known Stubs

- `frontend/src/features/wizard/WizardShell.tsx:15` - Step 3 renders `"Run - delivered by plan 04-02"` because progress polling is intentionally deferred to plan 04-02.
- `frontend/src/features/wizard/WizardShell.tsx:17` - Step 4 renders `"Results - delivered by plan 04-03"` because results visualization is intentionally deferred to plan 04-03.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 04-02 can build directly on `jobId` persistence, `getJobStatus()`, the stepper shell, and the existing MSW `/jobs/:id` handler without recreating the foundation.
- 04-03 can extend the same wizard store, token pipeline, and API boundary while adding the brain/result view and activation streaming.
- `.planning/STATE.md` and `.planning/ROADMAP.md` were intentionally left untouched in this execution because the orchestrator owns those writes.

## Self-Check

- PASSED
- `FOUND: .planning/phases/04-frontend-upload-persona-and-results/04-01-SUMMARY.md`
- `FOUND: 1b78116`
- `FOUND: 846f13c`
- `FOUND: 6ba8248`
- `FOUND: 279547f`
- `FOUND: 01634b9`
