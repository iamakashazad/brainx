# Phase 4: Frontend — Upload, Persona, and Results — Research

**Researched:** 2026-04-23
**Domain:** React frontend, 3D brain visualization (fsaverage5 surface + per-vertex overlay), long-poll job status, multipart upload
**Confidence:** HIGH (stack + API contract verified against shipping backend code), MEDIUM (3D visualization library fit — plan locks the canonical approach)

---

## Summary

- The frontend is **greenfield** (no `frontend/`, `web/`, `client/`, or `app/` directory exists; `package.json` is absent at repo root). Stack is therefore green-field Vite + React 18/19 + TS as CONTEXT/UI-SPEC locked. Node toolchain is available on the machine (`node v24.4.1`, `npm 11.4.2`, `pnpm 10.4.0`).
- **3D visualization approach is already locked by UI-SPEC:** `@react-three/fiber` + `three.js` with a custom `BufferGeometry` for the fsaverage5 bilateral mesh (20,484 vertices), per-vertex `color` attribute driven by the Float32 activation array, `MeshStandardMaterial` with `vertexColors: true`, and `OrbitControls` from `@react-three/drei`. This research confirms that path is sound and that the main alternative (Niivue) is **not viable**: the dedicated `niivue-react` package is not on npm and its mesh support is still unshipped as of this research date.
- **The API contract from Phase 3 has two concrete mismatches with CONTEXT.md / UI-SPEC that the planner must reconcile before writing tasks.** These are not locked decisions — they are documentation drift that contradicts the actual backend source.
  1. **Job terminal status values are `DONE` / `ERROR`**, not `COMPLETE` / `FAILED` (see `backend/models/job.py` and `backend/core/queue.py`).
  2. **There are six stage values, not five**, and they are lowercase snake_case: `simulation`, `grounding_check`, `inference`, `roi_aggregation`, `processing`, `recommendations` (see `backend/models/job.py::StageEnum`). CONTEXT.md lists "PENDING / SIMULATING / INFERRING / AGGREGATING / COMPLETE" which mixes lifecycle states with stages and drops two stages (`grounding_check`, `processing`) plus the final `recommendations` stage.
- **A new backend endpoint must ship this phase** (CONTEXT D-04) to serve per-screen Float32 vertex arrays from disk. The `.npy` files already exist at workspace-relative path `activations/{job_id}/screen_{n+1}.npy` (1-indexed filenames, 0-indexed `screen_index` in the manifest). Exact HTTP shape is planning's call, but the contract is effectively `GET /jobs/{job_id}/activations/{screen_index}` returning `application/octet-stream` + header carrying the shape.
- **Polling is a solved problem with TanStack Query v5**: `refetchInterval` as a function that returns `false` when terminal status is reached. 2s base interval, no exponential backoff needed for this use case (expected 60-120s job duration per CONTEXT).
- **Multipart upload for 1–5 images:** use native `FormData` with `fetch`. Do NOT manually set `Content-Type` — the browser sets the multipart boundary. Upload progress via `fetch` requires `ReadableStream` support (Streams API); for Phase 4's dev target (localhost, modern browsers) this is fine, but if we need cross-browser progress now, fall back to `axios` or raw `XMLHttpRequest` which both expose `onUploadProgress`.

**Primary recommendation:** Scaffold `frontend/` with Vite React-TS, install the stack enumerated in §Stack decisions, bundle fsaverage5 mesh as a static asset, and build the three plans as scoped in ROADMAP — but FIRST plan 04-01 must explicitly include a "align the contract doc drift" task that either updates UI-SPEC/CONTEXT to match the real backend enums, or (safer) builds a small mapping layer in `frontend/src/lib/api.ts` that translates backend `DONE|ERROR` / snake_case stages into the UI labels the spec uses for display copy.

---

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Project Shape & Stack**
- **D-01:** React app lives at `frontend/` as a sibling to `backend/`.
- **D-02:** Vite + React 18 + TypeScript. No Next.js; no CSR-only JS.
- **D-03:** Tailwind CSS + Radix UI primitives for unstyled a11y components. No shadcn/ui install — components authored against Radix + Tailwind directly, consuming the token layer in `04-DESIGN-TOKENS.css`.

**Vertex & Atlas Delivery**
- **D-04:** A new backend endpoint serves per-screen vertex activation arrays as **binary Float32** (not JSON). The `activations` manifest in `AnalysisResult` already points to on-disk paths; the new endpoint reads those and streams them.
- **D-05:** The per-screen vertex endpoint returns **time-mean only** — a single Float32 array of ~20,481 vertices (fsaverage5 whole-brain). No peak, no full timeseries in this phase.
- **D-06:** The fsaverage5 parcellation (vertex→ROI mapping + mesh geometry) is bundled as a **one-time static asset in the frontend**, not an endpoint.

**Results Panel & 3D Brain**
- **D-07:** Results layout is **brain-primary** (3D brain 60–70% viewport; recs alongside as secondary).
- **D-08:** Per-screen navigation uses a **timeline scrubber** that auto-plays once through all screens on results load.
- **D-09:** Only **one circuit is rendered at a time**; toggle between five. Default = highest-scoring for this job.
- **D-10:** Recommendations are **clickable → brain highlights** region and scrubs to screen. Cycle through multiples on re-click.
- **D-11:** 3D brain camera is **user-rotatable with preset view buttons** (lateral-L/R, superior, anterior).

**Upload + Persona Flow**
- **D-12:** **4-step wizard**: Persona → Content → Run → Results.
- **D-13:** Persona creation uses a **tabbed form** (demographics / psychographics / cognitive_state / environment) with progress indicator.
- **D-14:** Step 1 opens on **persona library** (`GET /personas`); pick saved or open form to create new (hits `POST /personas`, returns to library selected).
- **D-15:** Content step uses **three explicit tabs** mapping 1:1 to backend: **Text** (`POST /content/text`), **UI screens** (`POST /content/screens`, 1–5 images), **Static image** (`POST /content/static`).
- **D-16:** After Analyze, app shows **full-screen progress view** with stage + queue position, polling `GET /jobs/{id}`. Non-dismissable until complete.
- **D-17:** On terminal success, progress view **auto-transitions immediately** to results (0ms delay).
- **D-18:** Wizard nav is **free between completed steps**; form state persisted to `localStorage` so refresh restores wizard exactly.

**Visual Style**
- **D-19:** `04-DESIGN-TOKENS.css` is the **canonical design system**; all color/typography/radius/shadows flow through its CSS variables. No color literals in components.
- **D-20:** **Dark theme default** — `.dark` class applied to `<html>` on mount.
- **D-21:** Inter (sans), Lora (serif reserved), Roboto Mono (numeric). Base radius 0.5rem.
- **D-22:** 3D brain mesh uses **anatomical realism** — fsaverage5 mesh, per-vertex shading, matte `MeshStandardMaterial`, subtle ambient occlusion.
- **D-23:** Motion is **rich/cinematic** — brain assembly on results mount, circuit-swap morph, scrubber easing, stage transition flourishes.
- **D-24:** Data viz for circuit/region scores is **expressive** — gradient bars from `--chart-1`…`--chart-5`, animated fill on mount.
- **D-25:** Overall aesthetic = **Figma/Framer polish** — defined shadows, tilt/lift hover, generous whitespace with moments of delight.

### Claude's Discretion
- Content reuse / library for Phase 4: default to **fresh upload only** (no content library UI). Phase 5 owns persistence.
- Loading-skeleton design and error-state treatments.
- Three.js camera start pose, easing curves, motion timings.
- Whether progress view renders target persona summary / content preview while waiting.
- Circuit name spelling/order in toggle (use whatever backend returns in `ScreenROI.circuits`).
- Whether the stepper is horizontal at the top or vertical on the side.

### Deferred Ideas (OUT OF SCOPE)
- Content library / reuse UI (Phase 5).
- AI-assisted persona ("describe in plain text, auto-fill fields") — declined.
- Light theme toggle (tokens exist for both; wiring deferred to Phase 5).
- Shareable `/results/{job_id}` URLs (Phase 5 persistence).
- Queueing multiple jobs from the UI.
- Full timeseries / peak-activation-time vertex delivery (only time-mean in scope).
- Scheduled / automated analysis runs.

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **FE-01** | Interactive 3D brain visualization using `@react-three/fiber` with vertex color overlay showing circuit-level activation per screen | §3D brain visualization recommendation (R3F custom BufferGeometry + per-vertex `color` attribute), §Polling & upload patterns (vertex endpoint fetch + caching), §Results rendering approach (circuit-switch morph, scrubber rewires vertex buffer) |
| **FE-02** | Side-by-side view pairing each uploaded screen with its brain map and recommendations in a single panel | §Results rendering approach (ResultsLayout 60/40 split, RecommendationsPanel with rec→brain linkage), UI-SPEC §Component Inventory (RecommendationCard, BrainCanvas) |

---

## Stack Decisions

All versions verified via `npm view <pkg> version` on 2026-04-23.

### Core framework

| Library | Version | Purpose | Rationale |
|---------|---------|---------|-----------|
| `vite` | 8.0.10 | Dev server, build | D-02 locked. Native ESM dev, first-party React plugin, first-party Tailwind v4 plugin. |
| `@vitejs/plugin-react` | 6.0.1 | React plugin for Vite | Standard. |
| `react` | 19.2.5 | UI library | D-02 locked "React 18" but **React 19 is latest stable and is the peer dep required by `@react-three/fiber` v9** `[CITED: npm view @react-three/fiber peerDependencies]`. Recommend React 19 — it is a strict superset of 18 for practical purposes, and R3F v9 gates on `react >=19 <19.3`. If the planner wants to honor D-02 literally (React 18), pin `@react-three/fiber@8.x` instead; that older line supported React 18 `[ASSUMED based on R3F migration guide pattern]`. **Recommendation: use React 19 + R3F 9 to avoid peer-dep friction.** |
| `react-dom` | 19.2.5 | DOM renderer | Matches React. |
| `typescript` | 5.x | Static typing | D-02 locked. |

### Styling

| Library | Version | Purpose | Rationale |
|---------|---------|---------|-----------|
| `tailwindcss` | 4.2.4 | Utility CSS | D-03 locked. v4 uses `@theme inline { --color-*: var(--*) }` pattern which matches `04-DESIGN-TOKENS.css` exactly `[CITED: tailwindcss.com/blog/tailwindcss-v4]`. |
| `@tailwindcss/vite` | 4.2.4 | First-party Vite plugin | Replaces the old PostCSS pipeline; zero config. |
| `lucide-react` | 0.545.x | Icon set | UI-SPEC line 26 specifies lucide-react. |
| `clsx` | 2.1.1 | Class-name merging | De-facto standard for conditional className composition. |
| `tailwind-merge` | 3.5.0 | Merge Tailwind classes without conflicts | Needed when composing variant utilities. |
| `class-variance-authority` | 0.7.1 | Typed variant API for component recipes | Optional but common with Radix + Tailwind. |

### Accessibility primitives (Radix)

Install only the primitives the Component Inventory actually uses:

| Primitive | Version | Used by |
|-----------|---------|---------|
| `@radix-ui/react-tabs` | 1.1.13 | `ContentTypeTabs`, `PersonaForm` (4 tabs) |
| `@radix-ui/react-dialog` | 1.1.15 | Persona delete confirmation (inline per UI-SPEC — but Radix popover or tooltip may suffice; keep dialog available) |
| `@radix-ui/react-slider` | 1.3.6 | `TimelineScrubber` (UI-SPEC §Accessibility: "implement as `<input type=\"range\">` base — Radix Slider or native") |
| `@radix-ui/react-toggle-group` | 1.1.11 | `CircuitSelector`, `BrainPresetButtons` |
| `@radix-ui/react-progress` | 1.1.8 | `StageIndicator` progress hint, `PersonaTabProgress` |
| `@radix-ui/react-tooltip` | latest | Accessible label for icon-only buttons (preset views, delete) |
| `@radix-ui/react-slot` | latest | Required by `asChild` composition patterns. |

### Data fetching, state, forms

| Library | Version | Purpose | Rationale |
|---------|---------|---------|-----------|
| `@tanstack/react-query` | 5.99.2 | Server state + polling | Canonical for `refetchInterval` with terminal-status stopping function `[CITED: tanstack.com/query/latest/docs/framework/react/guides/polling]`. Also handles retry-on-error and background refetch. |
| `zustand` | 5.0.12 | Client state (wizard) | Tiny, no provider boilerplate. Used for wizard state that is not server-owned: current step, selected persona id, uploaded content id, scrubber screen index, active circuit, active rec id. |
| `react-hook-form` | 7.73.1 | Form state + validation | Persona tabbed form (4 tabs, ~12 fields). Handles tab progress via `formState.dirtyFields` / `isValid`. |
| `zod` | 4.3.6 | Schema validation | Mirrors the backend Pydantic shapes. Use at form validation and at API-response parsing boundaries. |
| `@hookform/resolvers` | 5.2.2 | Bridges `react-hook-form` ↔ `zod` | Standard pairing. |
| `react-router-dom` | 7.14.2 | Routing | Wizard steps can be path-based (`/new`, `/new/content`, `/new/run/:jobId`, `/new/results/:jobId`) so browser back/forward works. Even though shareable `/results/:id` URLs are deferred (Phase 5), the path structure should be ready. |

### Animation

| Library | Version | Purpose |
|---------|---------|---------|
| `framer-motion` | 12.38.0 | Page transitions, card hover, progress stage fades, chart bar fill |

Note: R3F animations (brain assemble, circuit-swap morph) are done in-canvas via `useFrame` + GLSL-free uniform interpolation, not framer-motion. Framer is only for DOM animations.

### 3D brain

| Library | Version | Purpose |
|---------|---------|---------|
| `three` | 0.184.0 | WebGL engine | `@react-three/fiber` v9 requires `three >=0.156` `[CITED: npm view @react-three/fiber peerDependencies]`. |
| `@react-three/fiber` | 9.6.0 | React renderer for three.js | Locked in UI-SPEC. |
| `@react-three/drei` | 10.7.7 | Helpers (`<OrbitControls>`, `<Environment>`, `<Bounds>`, `<PerspectiveCamera>`) | Required by D-11 (OrbitControls). |

### Testing

| Library | Version | Purpose |
|---------|---------|---------|
| `vitest` | 4.1.5 | Unit test runner (Vite-native) |
| `@vitest/ui` | 4.1.5 | Interactive test UI (dev only) |
| `@testing-library/react` | 16.3.2 | Component testing |
| `@testing-library/user-event` | 14.6.1 | User interaction simulation |
| `jsdom` | 29.0.2 | DOM environment for non-canvas tests |
| `msw` | 2.13.5 | API mocking for unit + component tests |
| `@playwright/test` | 1.59.1 | e2e smoke tests (full wizard) |

### Installation

```bash
# From repo root
mkdir frontend && cd frontend
npm create vite@latest . -- --template react-ts
# Core runtime
npm install react@19 react-dom@19
npm install @tanstack/react-query zustand react-hook-form zod @hookform/resolvers react-router-dom
npm install three @react-three/fiber @react-three/drei
npm install framer-motion lucide-react clsx tailwind-merge class-variance-authority
npm install @radix-ui/react-tabs @radix-ui/react-dialog @radix-ui/react-slider \
            @radix-ui/react-toggle-group @radix-ui/react-progress @radix-ui/react-tooltip \
            @radix-ui/react-slot
# Styling
npm install -D tailwindcss @tailwindcss/vite
# Dev / test
npm install -D vitest @vitest/ui @testing-library/react @testing-library/user-event \
               jsdom msw @playwright/test @types/three
```

### Alternatives considered

| Instead of | Could use | Tradeoff |
|------------|-----------|----------|
| `@react-three/fiber` + custom mesh | Niivue (`@niivue/niivue` 0.68.2) | Niivue is NIFTI/volume-native and has an unshipped React wrapper (`niivue-react` is GitHub-only, meshes "not yet supported" per its README) `[VERIFIED: github.com/niivue/niivue-react]`. Also it runs its own WebGL2 canvas, which would fight with R3F and the rest of the design system's motion story. UI-SPEC already locked R3F. |
| Custom mesh | Papaya, Brain Browser | Older (last meaningful update 2019 for Papaya) `[ASSUMED]`; no React integration; would require embedding an iframe or legacy jQuery. Rejected. |
| TanStack Query | Naive `setInterval` + `useState` | Works but reinvents retry/cache/invalidate/stop-on-terminal. Rejected for engineering cost. |
| TanStack Query | SSE or WebSocket | Backend exposes only HTTP polling (INFRA-03, `GET /jobs/{id}`). No SSE endpoint. Would require new backend work outside Phase 4 scope. |
| Zustand | Redux Toolkit | Heavier. Wizard client state is ~6 values; RTK is overkill. |
| React Hook Form | Uncontrolled form + manual validation | Persona has 4 tabs × ~3–5 fields. RHF + zodResolver cuts the code in half and gives us typed errors. |
| React Router | TanStack Router | TR is slick, but RR v7 is still the ecosystem default and integrates with RHF / query without surprise. |
| Framer Motion | Motion One | Motion One is lighter but the R3F/drei ecosystem and examples still gravitate to framer-motion for React. |
| Playwright | Cypress | Playwright is the modern default and ships a first-class TS API. |

### Version-verification summary

Verified on 2026-04-23:
- `npm view vite version` → 8.0.10
- `npm view react version` → 19.2.5 (dist-tags: latest 19.2.5, beta 19.0.0-beta, next 19.3.0-canary)
- `npm view @react-three/fiber peerDependencies` → requires `react >=19 <19.3`, `three >=0.156`
- `npm view tailwindcss version` → 4.2.4 (dist-tags: latest 4.2.4, v3-lts 3.4.19)
- `npm view @niivue/niivue version` → 0.68.2 (and `niivue-react` is NOT on npm — 404 on the registry)
- Node 24.4.1, npm 11.4.2, pnpm 10.4.0 all available on the host.

---

## API Contract (from Phase 3 shipped code)

> **Authoritative source:** the Python files under `backend/routers/`, `backend/models/`, and `backend/core/queue.py`. Where CONTEXT.md or UI-SPEC differ, the code wins. Flagged drift is listed in §Open Questions.

All endpoints under `http://localhost:8000/` by default. CORS is pre-configured in `backend/main.py` for `localhost:5173` (Vite) and `localhost:3000` `[VERIFIED: backend/main.py:38-44]`.

### `GET /personas` — list saved personas

Response: `PersonaRead[]`, sorted by `created_at` desc.

```ts
type PersonaRead = {
  id: string;          // uuid
  name: string;        // 1..120 chars
  demographics: Demographics;
  psychographics: Psychographics;
  cognitive_state: CognitiveState;
  environment: Environment;
  created_at: string;  // ISO 8601
  updated_at: string;  // ISO 8601
};

type Demographics = {
  age: number;                 // 0..120
  role: string;                // 1..80 chars
  background: string | null;   // <=500 chars
};

type Psychographics = {
  goals: string[];
  values: string[];
  motivations: string[];
};

type CognitiveState = {
  attention_span: "short" | "medium" | "long";
  stress_level: "low" | "moderate" | "high";
  tech_literacy: "novice" | "intermediate" | "expert";
};

type Environment = {
  device: "mobile" | "tablet" | "desktop";
  location: "commute" | "home" | "office" | "store" | "other";
  ambient: string | null;
};
```

### `POST /personas` — create persona

Request body: `PersonaCreate` (same as `PersonaRead` minus `id`/timestamps).
Response: `PersonaRead` (201 Created).

### `GET /personas/{persona_id}`, `PATCH /personas/{persona_id}`, `DELETE /personas/{persona_id}`

Standard CRUD. DELETE returns 204. Returns 409 if persona is still referenced by an existing job `[VERIFIED: backend/routers/personas.py:99]`.

### `POST /content/text` — create text content

```ts
// Request
{ content_text: string }  // 1..20000 chars
// Response (201)
{ content_id: string; content_type: "text" }
```

### `POST /content/screens` — create UI-screen content (multipart)

```
multipart/form-data
files: File[]  (1..5 images — 400 otherwise)
```
Response (201): `{ content_id, content_type: "ui_screens" }`

### `POST /content/static` — create static content (multipart)

```
multipart/form-data
file: File  (single image)
```
Response (201): `{ content_id, content_type: "static" }`

### `POST /analyze` — kick off analysis

```ts
// Request
{ persona_id: string; content_id: string }
// Response (201)
{ job_id: string; status: "PENDING" }
```

### `GET /jobs/{job_id}` — **the polling target**

```ts
{
  job_id: string;
  status: "PENDING" | "RUNNING" | "DONE" | "ERROR";   // not COMPLETE/FAILED
  queue_position: number | null;                      // null once RUNNING
  stage: StageValue | null;                           // null while PENDING; null again at terminal
  result: AnalysisResult | null;                      // populated only on DONE
  error: string | null;                               // populated only on ERROR
  created_at: string | null;                          // ISO 8601
}

type StageValue =
  | "simulation"         // generating DeepSeek gaze narrative
  | "grounding_check"    // vision-grounding validator
  | "inference"          // TRIBEv2 per-screen activation
  | "roi_aggregation"    // fsaverage5 Destrieux ROI mapping
  | "processing"         // global 0-100 rescale, continuity, overlays
  | "recommendations";   // DeepSeek recommendation generation
```

Stage progression is strictly ordered `[VERIFIED: backend/core/queue.py:168-313]`. Poll interval recommendation: **2000ms**, stop when status becomes `DONE` or `ERROR`.

### `AnalysisResult` envelope (lives at `result.result` on DONE)

```ts
type AnalysisResult = {
  schema_version: 1;
  simulation: SimulationLog;
  overlays: ScreenOverlay[];
  activations: ActivationManifestEntry[];
  roi: ScreenROI[];
  flow_continuity: FlowContinuity;
  recommendations: Recommendation[];
  pathway: PathwayMetadata;
};

type ActivationManifestEntry = {
  screen_index: number;    // 0-indexed
  path: string;            // workspace-relative, e.g. "activations/{job_id}/screen_1.npy"
  shape: number[];         // [T, 20484]
  timesteps: number;       // T
};

type ScreenROI = {
  screen_index: number;
  circuits: Record<CircuitName, { score: number; peak: number }>;   // 0..100 rescaled
  regions: {
    atlas_label: string;    // Destrieux label, e.g. "S_front_inf"
    circuit: CircuitName;
    score: number;          // 0..100
    peak: number;           // 0..100
  }[];
};

// CircuitName values are literally these five strings — no other keys will appear:
type CircuitName =
  | "Attention"
  | "Cognitive Load"
  | "Emotional Response"
  | "Memory Encoding"
  | "Reward";
// [VERIFIED: backend/services/roi_aggregation.py:12-37]

type FlowContinuity = {
  circuits: Record<CircuitName, {
    per_screen: { screen_index: number; score_0_100: number; delta_from_prev: number }[];
    trend: "rising" | "dropping" | "flat" | "volatile";
  }>;
};

type Recommendation = {
  rec_type: "copy_rewrite" | "layout_flag" | "memorability" | "emotional_dropoff";
  screen_index: number;         // 0..4
  evidence: {
    circuit: CircuitName;
    region: string;             // atlas_label
    activation_score: number;   // 0..100
    score_rank: "Low" | "Moderate" | "High" | "Very High";
  };
  target_region?: { x_ratio: number; y_ratio: number; width_ratio: number; height_ratio: number };
  element_description?: string;
  before?: string;
  after?: string;
  rationale: string;
};

type PathwayMetadata = {
  selected_pathway: "text" | "video";
  slideshow_path: string | null;
  durations: number[];
};

type ScreenOverlay = {
  screen_index: number;
  hesitation_points: { x_ratio: number; y_ratio: number; duration_ms: number; intensity: number }[];
  scroll_path: { t_ms: number; y_ratio: number }[] | null;  // null for text/static
};
```

### `GET /jobs/{job_id}/activations/{screen_index}` — **NEW endpoint this phase ships** (D-04)

Defined in CONTEXT.md §canonical_refs — "Missing (to be created this phase)". Planning must specify the HTTP shape, but the constraints are locked:
- Reads `ActivationManifestEntry.path` (e.g. `activations/{job_id}/screen_{n+1}.npy`), computes the per-vertex time-mean, and streams as binary.
- `Content-Type: application/octet-stream`.
- Response body: Float32 little-endian, length = 20,484 `[VERIFIED: backend/services/roi_aggregation.py::_build_vertex_label_map + bilateral fsaverage5]`.
- Shape communicated via response header (e.g. `X-Vertex-Count: 20484`) or echoed in a companion JSON endpoint. Planner picks.

**Exact filename convention to reference:** `screen_{screen_index + 1}.npy` — backend stores 1-indexed file names, `screen_index` in the manifest is 0-indexed `[VERIFIED: backend/core/queue.py:98]`.

---

## 3D brain visualization — Recommendation

### Recommended approach: custom R3F mesh with per-vertex color buffer

UI-SPEC already locks `@react-three/fiber`. This research confirms the approach is correct and outlines the exact technique:

**Mesh setup (once, on first mount):**
1. Bundle fsaverage5 pial surface mesh as a static asset under `frontend/public/brain/` — either a single `.gii` (GIfTI) file parsed client-side, or a pre-baked binary `{ positions: Float32Array, indices: Uint32Array, labelMap: Uint16Array }` file (planner's call). Baking offline into a compact binary is the lower-complexity path: ~20k × 3 × 4 bytes ≈ 240 KB for positions, plus ~40k triangles × 3 × 4 bytes ≈ 480 KB for indices. Gzip brings this comfortably under 300 KB on the wire `[ASSUMED based on fsaverage5 typical topology; verify offline during implementation]`.
2. In the `BrainCanvas` component, load the asset once (via a React 19 `use()` suspense loader or a `useEffect` + `useState`), create a `THREE.BufferGeometry`, assign `position` and `index` attributes, plus an initially-zero `color` BufferAttribute of shape `(20484, 3)`.
3. Material: `<meshStandardMaterial vertexColors={true} roughness={0.8} metalness={0.0} />` — matches D-22 (matte, anatomical). Add an `ambientLight` + one `directionalLight` and optionally an SSAO postprocessing pass from `@react-three/postprocessing` for gyri/sulci depth.

**Per-frame update (on circuit switch or scrubber change):**
1. Fetch `GET /jobs/{job_id}/activations/{screen_index}` → `ArrayBuffer` → `Float32Array(20484)`.
2. Map activations to a colormap. The vertex-to-circuit membership is derived client-side from the bundled parcellation JSON; vertices outside the active circuit's regions render as a neutral base color (e.g. `--muted` in OKLCH converted to sRGB for the buffer).
3. Overwrite the `color` BufferAttribute contents and set `attribute.needsUpdate = true`.
4. For the circuit-swap morph (D-23), interpolate the color buffer across a 400ms window using `useFrame` + `damp` from drei, rather than swapping instantly.

**Camera presets (D-11):**
Use `<OrbitControls ref={controls} />` and four preset buttons that call `controls.current.setAzimuthalAngle / setPolarAngle` followed by `controls.current.update()`. Animate with `@react-three/drei`'s `<CameraControls>` component (which has built-in `rotateTo({ azimuth, polar }, smooth)` method).

### Alternatives (for completeness)

| Option | Viable? | Why / why not |
|--------|---------|---------------|
| `@niivue/niivue` (0.68.2) + mesh surface | **NO** | No working React wrapper (`niivue-react` is GitHub-only and does not yet support meshes per its own README). Niivue runs its own WebGL2 canvas, making it hostile to the rest of the R3F-based motion design. Rejected. `[VERIFIED: github.com/niivue/niivue-react README; npm registry 404]` |
| Papaya viewer | NO | Last meaningful release ~2019; no TS; no React; no modern bundler integration. |
| Pre-rendered video / GIF per circuit/screen | NO | 5 circuits × N screens × rotation = many hundreds of artefacts; no interactive rotate/zoom; kills D-11. |
| SVG 2D flatmap | NO | D-22 explicitly demands 3D anatomical realism. |

### Platform caveats for the chosen approach

- **WebGL2 required.** Modern Chrome/Edge/Firefox/Safari support this, but a capability check on mount and a fallback "Your browser needs WebGL2" message is worth the ~10 lines.
- **Cross-origin assets:** the static mesh lives in `frontend/public/` so no CORS. The activation endpoint lives on the backend and is already CORS-whitelisted for `localhost:5173`.
- **SharedArrayBuffer: not required.** Nothing in this approach needs COOP/COEP headers. Good — it would complicate the Vite dev server otherwise.
- **Bundle impact:** `three` + `@react-three/fiber` + `@react-three/drei` minified+gzipped is ~180 KB. Non-negotiable for D-22/D-23.
- **Accessibility:** R3F canvas cannot be keyboard-navigated by default. UI-SPEC §Accessibility requires a screen-reader label and keyboard-accessible preset view buttons as the primary navigation surface; we inherit that requirement directly.

---

## Polling & upload patterns

### Polling (TanStack Query v5)

```ts
// frontend/src/lib/queries/useJobStatus.ts
import { useQuery } from "@tanstack/react-query";

export type JobStatus = "PENDING" | "RUNNING" | "DONE" | "ERROR";

export function useJobStatus(jobId: string | undefined) {
  return useQuery({
    queryKey: ["job", jobId],
    enabled: !!jobId,
    queryFn: () => fetch(`/api/jobs/${jobId}`).then((r) => r.json()),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "DONE" || status === "ERROR") return false;
      return 2000;
    },
    refetchIntervalInBackground: false,
    retry: (failureCount) => failureCount < 3,
  });
}
```

Matches UI-SPEC's "Retrying…" inline banner on poll failure (auto-retry at 5s — adjust `retry` / `retryDelay` to satisfy that copy requirement, or show the banner when `query.isFetching && query.failureCount > 0`).

### Multipart upload with JSON persona reference

The `/analyze` endpoint takes a JSON body referencing `persona_id` + `content_id` — so the multipart upload is **only** for the content step (`POST /content/screens`, `POST /content/static`). Persona is a plain JSON POST.

```ts
// Screens upload — 1..5 files
async function uploadScreens(files: File[]): Promise<{ content_id: string; content_type: "ui_screens" }> {
  const form = new FormData();
  for (const f of files) form.append("files", f, f.name);
  // DO NOT set Content-Type — the browser sets the multipart boundary.
  const res = await fetch("/api/content/screens", { method: "POST", body: form });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return res.json();
}
```

### Upload progress

Native `fetch` does not expose `upload.onprogress` cross-browser. Two paths:

1. **Drop progress indication for Phase 4** — most files are screenshots (<2 MB), upload completes in <1s on localhost and in <5s on reasonable networks. UI-SPEC does not require a progress bar on the upload itself; it only requires thumbnail previews after selection. **Recommended.**
2. **If progress is needed,** use `axios` (`onUploadProgress`) or raw `XMLHttpRequest`. Adds ~15 KB to bundle. Revisit if UX review complains.

### Abort + cancel

Every `fetch` in the app should accept an `AbortController` so React Query can cancel in-flight requests when the component unmounts or the query key changes. `useQuery` does this automatically if `queryFn` accepts `({ signal })`.

### Large file chunking

Not needed. Backend accepts up to 1–5 images sized to sane social-media / UI screenshot dimensions. No file size limit is enforced by the backend contract beyond the image validation pipeline (`process_upload`), which is already running in Phase 2.

---

## Results rendering approach

### Layout (D-07)

`ResultsLayout` is a two-column grid: `grid-cols-[3fr_2fr]` on desktop (brain ~60%, recs ~40%), collapsing to a stacked single column on narrow screens with the brain at 60vh. Timeline scrubber spans the full width under the brain.

### Overlay compositing on the 3D brain

All compositing is **custom** to this project — Niivue does not apply here. The approach:

1. At load, fetch activation bytes for each screen lazily as the scrubber visits it. Cache per `(job_id, screen_index)` in a `useQuery` keyed cache so scrubbing back-and-forth never re-hits the network.
2. For each vertex in the 20,484-long array, look up its atlas label from the bundled parcellation JSON (vertex_index → atlas_label_index → circuit_name). Vertices whose atlas region does NOT belong to the currently-active circuit are colored with a neutral base (OKLCH of `--muted-foreground`). Vertices inside the active circuit's regions are colored along a `--chart-1..5` gradient keyed by their normalized activation value.
3. Colormap: simple 2-stop gradient from low-activation color (40% opacity against base) to high-activation color (100% opacity). The gradient uses the chart token for the active circuit (Attention → `--chart-1`, Cognitive Load → `--chart-2`, etc.). Mapping locked at implementation.
4. **Thresholding / opacity controls:** UI-SPEC does NOT expose threshold sliders to the user in Phase 4. Do not build them. A sensible hard-coded threshold can drop activations below the 20th percentile to the base color to avoid visual noise `[Claude's discretion per CONTEXT]`.
5. **Circuit swap animation (D-23):** compute the new color buffer, interpolate vertex-by-vertex from the old buffer over 400ms using a `useFrame` lerp. Do not dispose and recreate the geometry.

### Metric scores display

Two distinct surfaces:

1. **`CircuitScoreBar` × 5 — always visible beside the brain.** Each bar maps one circuit's `score` (0..100) onto a gradient-filled horizontal bar with `--chart-N` gradient. Label in Inter 14/600; value in Roboto Mono 14/400. Animated fill on mount (width 0→score%, 400ms ease-out).
2. **`ROIScoreTable` — panel below or in a tab.** Rows are `regions: RegionScoreEntry[]` sorted by `score` desc. Columns: Region (atlas_label, title-cased), Circuit (chip), Score, Peak. Roboto Mono 14/400 for numbers. Alternating `--muted` row tint.

**Chart library:** NOT needed for the score bars (pure Tailwind + CSS gradient). For the `FlowContinuityChart` (UI-SPEC §Component Inventory), a hand-rolled SVG line+area chart is the lowest-dep path — ~60 lines of React. Alternatives (Recharts, Nivo, Chart.js) add 80–200 KB and are overkill for one chart with ≤5 points per series.

### Recommendations panel

Scrollable list of `RecommendationCard`s. Each card:

- Header chip: `rec_type` (e.g. "Copy rewrite") + `evidence.score_rank` color-keyed.
- Body: `rationale` (Inter 14/400). For `copy_rewrite`: show `before` struck through above `after` in slightly-larger type. For `layout_flag`: show `element_description` or highlight `target_region` on the companion screen image preview. For `memorability` / `emotional_dropoff`: show screen number + rationale.
- Footer: evidence pill — `{circuit} · {region} · {activation_score.toFixed(1)}/100 · {score_rank}`.
- Click behavior (D-10):
  - Sets `activeRecId` in the wizard store.
  - Dispatches a `scrubToScreen(evidence.screen_index || recommendation.screen_index)` action.
  - Dispatches a `highlightRegion(evidence.region, evidence.circuit)` action.
  - Re-clicking cycles through secondary locations (for Phase 4 the backend model emits one `evidence` object per recommendation; secondary locations require inspecting `target_region` for layout_flag, which does not map to a brain region. So the "cycle through multiples" behavior effectively only applies if the same card clicks through related recs — this is a UX interpretation question for the planner).
- Grounding citation: shown inline in the footer per REC-01. No additional "citations" panel needed.

### Auto-play scrubber (D-08)

On results mount, a `useEffect` kicks off a timer that advances `activeScreenIndex` from 0 through `sim_log.screens.length - 1` at 600ms per screen (UI-SPEC Motion Contract), then stops. The scrubber handle is always draggable during and after the auto-play sequence — clicking or dragging cancels the auto-advance.

---

## State shape & caching

```ts
// Zustand store — client-only, wizard-scoped
type WizardStore = {
  currentStep: 1 | 2 | 3 | 4;
  setStep: (s: 1 | 2 | 3 | 4) => void;

  selectedPersonaId: string | null;
  setPersona: (id: string | null) => void;

  contentId: string | null;
  contentType: "text" | "ui_screens" | "static" | null;
  setContent: (id: string, type: "text" | "ui_screens" | "static") => void;

  jobId: string | null;
  setJob: (id: string | null) => void;

  // Results-view view state (only valid when step === 4)
  activeScreenIndex: number;
  activeCircuit: CircuitName | null;   // null = not yet initialized; init to highest-scoring circuit on mount
  activeRecId: string | null;
  secondaryRecLocationCursor: number;  // for D-10 cycling

  reset: () => void;
};

// Persist to localStorage key "brainx-wizard-state" (D-18) via zustand middleware.
// EXCLUDE jobId from persistence once status is DONE (no rerun on refresh).
```

**Server-state cache:**
- `["personas"]` — list + individual detail
- `["job", jobId]` — polled job status
- `["activation", jobId, screenIndex]` — Float32 vertex buffer cached in-memory by `queryClient`. Do NOT persist to localStorage; these are large binary blobs.

**No IndexedDB needed** for Phase 4. Phase 5 persistence may introduce it.

---

## Accessibility alignment with UI-SPEC

UI-SPEC §Accessibility is comprehensive. Research-level notes to preserve:

- **File drop zones (`UploadDropZone`, `ScreenUploader`, `StaticUploader`):** Radix does not ship a dropzone primitive. Build on `<input type="file">` + drag-and-drop handlers. Ensure the clickable surface is a `<button>` (not a div) to get Enter/Space keyboard activation. Visible focus ring via `--ring`. Announce drag state with `aria-live="polite"` so SR users hear "File ready to drop" when dragging over.
- **Progress view (`ProgressView`):** must be a focus trap (Radix `<Dialog.Root>` with `modal={true}` or a custom trap). Stage changes announced via `aria-live="polite"` per UI-SPEC. Roboto Mono queue count is decorative — also expose it to AT via the surrounding `<div role="status">`.
- **3D canvas (`BrainCanvas`):** provide a non-visual text summary below the canvas (visually hidden but SR-visible) describing the currently-active circuit and the top-3 highest-scoring regions. Update on circuit switch. This is the canvas-fallback the UI-SPEC line 276 calls for.
- **Timeline scrubber:** use Radix `<Slider>` (version 1.3.6). It ships full keyboard control (←/→ step, Home/End to extremes, Page up/down for larger jumps). Ensure `aria-valuetext` is set to the current screen's narrative-label so SR users get content, not just "2 of 5".
- **Reduced motion:** gate all R3F animations behind `useReducedMotion()` from framer-motion (which reads `prefers-reduced-motion`). When reduced: skip the brain assembly animation, snap colors on circuit swap, snap scrubber jumps.

---

## Testing strategy

> Full section appears under §Validation Architecture below. This section only covers tooling.

### Unit / component tests (Vitest + RTL + MSW)

- Wizard step transitions (RTL + user-event).
- Persona form validation (zod schema + RHF).
- API client functions (MSW mocks the FastAPI endpoints).
- `useJobStatus` polling logic with fake timers (vitest `vi.useFakeTimers`).
- `RecommendationCard` click → store dispatch (zustand test helper).

### e2e tests (Playwright)

One happy-path smoke: seed a persona, upload a static image, submit analyze, poll to DONE, verify brain canvas mounts and at least one circuit score bar renders. Use MSW at the service-worker level OR spin up the backend and use a fixture `Job.result_json`. The latter requires a backend test mode; recommend mocking via MSW.

### Canvas testing is hard

- R3F `<Canvas>` does not render in jsdom. Tests that touch the canvas must use `@react-three/test-renderer` or be Playwright-only.
- For unit tests, wrap `BrainCanvas` so the inner mesh logic is extractable as a pure function (e.g. `computeColorBuffer(activations, circuitMap, activeCircuit): Float32Array`) and unit-test the math without ever creating a canvas.

### Polling logic with time mocks

```ts
// Pattern:
vi.useFakeTimers();
const { result } = renderHook(() => useJobStatus("j1"), { wrapper });
await act(async () => { vi.advanceTimersByTime(2000); });
expect(fetchMock).toHaveBeenCalledTimes(2);  // initial + one refetch
```

---

## Project Constraints (from CLAUDE.md)

No project-level `CLAUDE.md` exists at the repo root or at `~/CLAUDE.md`. The only operating directive from auto-memory is:

> For backend-only BrainX phases, run pytest to verify UAT items; skip per-test prompting.

This phase is frontend-dominated. A new backend endpoint still ships (per-screen vertex streamer), so that one endpoint's UAT can and should follow the pytest-auto-verify rule. The frontend UAT needs human-in-the-loop verification (visual check) which is outside the auto-pytest flow.

---

## Runtime State Inventory

This is a greenfield frontend phase — there is no existing frontend runtime state to migrate. The following categories are enumerated for completeness:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — verified by `ls ` showing no `frontend/`, `web/`, `client/`, or `app/` directory, and no `package.json` at repo root. SQLite `brainx.db` belongs to the backend and is not touched by this phase. | none |
| Live service config | None — verified by inspecting `backend/main.py` CORS config (already permits `localhost:5173` and `localhost:3000`, so no change needed when the Vite dev server starts). | none |
| OS-registered state | None — no launch daemons, Task Scheduler entries, pm2 registrations, or systemd units involve the frontend. Backend runs via `uvicorn` invoked manually per `backend/main.py` docstring. | none |
| Secrets / env vars | The frontend will need `VITE_API_BASE_URL` in `frontend/.env.local` for dev, defaulting to `http://localhost:8000`. No shared secrets cross from backend to frontend. | add `VITE_API_BASE_URL` to `frontend/.env.local` during scaffolding task |
| Build artifacts / installed packages | None — no `node_modules`, `dist`, or `.vite` directory anywhere in the repo. Verified by absence at repo root. | frontend scaffolding task will create `frontend/node_modules` and `frontend/dist` (add both to `.gitignore`) |

---

## Common pitfalls

### Pitfall 1: Mutating BufferAttribute without setting `needsUpdate`

**What goes wrong:** Circuit switch happens, color array is overwritten, but the brain doesn't visually change.
**Why:** three.js caches the GPU buffer; `attribute.needsUpdate = true` is required to re-upload.
**Prevention:** encapsulate in a `useEffect` that always sets `colorAttr.needsUpdate = true` after mutating. Prefer `BufferGeometry.getAttribute('color').array.set(newArr)` over replacing the attribute wholesale.

### Pitfall 2: `<Canvas>` in a parent with no height

**What goes wrong:** Brain renders at 0×0 or collapses when the grid parent is `h-auto`.
**Prevention:** explicitly set canvas container height via Tailwind (`h-[60vh]` minimum per UI-SPEC §Spacing line 53).

### Pitfall 3: Polling continues after unmount

**What goes wrong:** User navigates back to step 2 while job is RUNNING; poll continues forever, hitting the server.
**Prevention:** React Query auto-cancels when the observer count drops to 0. BUT — ensure the progress view is actually unmounting (check for conditional-render vs `display: none`). The UI-SPEC is "auto-transition on DONE," so this is mainly a concern on the Go Back path during ERROR.

### Pitfall 4: Treating `result.status` as `COMPLETE` or `FAILED`

**What goes wrong:** The UI waits forever because it's checking for the wrong string.
**Prevention:** Types imported from a single source-of-truth module (`frontend/src/lib/api-types.ts`). Enforce in zod response schema.

### Pitfall 5: Setting `Content-Type` on multipart FormData

**What goes wrong:** Backend returns 422 because boundary is missing.
**Prevention:** Do not manually set the header in `fetch` or `axios` when the body is `FormData`.

### Pitfall 6: React Query key missing jobId disambiguation

**What goes wrong:** User submits a second analyze while the first is still polling; stale response from the first job overwrites the UI.
**Prevention:** Always include `jobId` in the query key. Zustand `reset()` on "Start new analysis" clears `jobId` and queryClient `.invalidateQueries(['job'])`.

### Pitfall 7: localStorage persistence races with a running job

**What goes wrong:** User closes tab mid-analysis, reopens — wizard store has `jobId` set, but poll starts on a stale state where the job already finished. Or worse, the browser fires the fetch before the token the backend needs is read.
**Prevention:** On rehydrate, if `jobId` is present, kick off `GET /jobs/{id}` once. If status is DONE, jump directly to step 4. If ERROR, show the error state. If still RUNNING, resume polling. Document this rehydration path explicitly.

### Pitfall 8: Bundle bloat from importing all of Radix

**What goes wrong:** `import * from "@radix-ui/react-*"` pulls in primitives you don't use; tree-shaking doesn't catch it.
**Prevention:** install only the specific `@radix-ui/react-<name>` packages used (enumerated in §Stack decisions).

### Pitfall 9: OKLCH colors in three.js color buffer

**What goes wrong:** `THREE.Color` only ingests sRGB or linear RGB; OKLCH strings from CSS tokens must be converted.
**Prevention:** use `culori` (or a hand-rolled OKLCH→linearRGB helper) at build time to pre-compute the chart-1..5 color values as Float32 triples, OR read them from `getComputedStyle(document.documentElement).getPropertyValue('--chart-N')` at runtime and convert via `new THREE.Color().setStyle(oklchStr)` (three.js r158+ accepts CSS color values). Test this early — color fidelity drift is a class of bug that eats time.

### Pitfall 10: Ambient-occlusion pass at 60fps kills mobile

**What goes wrong:** SSAO postprocessing for "anatomical realism" tanks the frame rate below 30fps on integrated GPUs.
**Prevention:** Phase 4 targets desktop (per Deferred: no mobile). Still, keep SSAO behind a feature flag and bake a lightweight baked-AO per-vertex value into the static mesh asset if real-time AO is too expensive.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js (>=18) | Vite, React, all frontend tooling | ✓ | v24.4.1 | — |
| npm | Package install | ✓ | 11.4.2 | `pnpm 10.4.0` also present |
| pnpm | Optional package manager | ✓ | 10.4.0 | npm |
| yarn | Optional package manager | ✓ | 1.22.22 | npm |
| Backend (FastAPI on :8000) | Live API for `/personas`, `/content/*`, `/analyze`, `/jobs/{id}` | ✓ | (runs via `uvicorn backend.main:app`) | MSW mocks for dev-without-backend mode |
| fsaverage5 mesh files | Static brain mesh asset | ✓ | (fetchable via `nilearn.datasets.fetch_surf_fsaverage` on the backend host; already cached under `model_cache/nilearn` per `backend/services/roi_aggregation.py:64`) | Re-fetch or check in a pre-converted binary per-commit |
| Destrieux atlas parcellation | Vertex→region mapping, bundled to frontend | ✓ | (cached alongside fsaverage5) | same as above |
| WebGL2-capable browser | 3D brain rendering | ✓ (dev machine) | — | Fallback message "WebGL2 required" |
| Modern clipboard (for recommendation copy) | Future nice-to-have | ✓ | — | Not in scope |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None in this phase.

**Notable:** The fsaverage5 mesh + parcellation are already fetched by the backend; Phase 4 must include a one-time task to export these from the backend's `model_cache/nilearn/` to a binary format suitable for web bundling (the raw `.gii` files can exceed 2 MB; pre-baking to `Float32Array` + `Uint16Array` is worth it). This is a build-time step, not a runtime dependency.

---

## Validation Architecture

Per-plan tests go under `frontend/src/**/__tests__/`; e2e under `frontend/tests/e2e/`. Backend additions (the new vertex-streamer endpoint) extend `tests/` (Python pytest suite).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 (frontend unit/component), Playwright 1.59.1 (frontend e2e), pytest (backend endpoint addition) |
| Config file | `frontend/vitest.config.ts` (Wave 0 — to create), `frontend/playwright.config.ts` (Wave 0 — to create), `pytest.ini` (exists) |
| Quick run command | `cd frontend && npm run test -- --run` |
| Full suite command | `cd frontend && npm run test -- --run && npm run test:e2e && cd .. && ~/.venvs/brainx/bin/python -m pytest tests/test_vertex_endpoint.py -q` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| **FE-01** | R3F canvas mounts with fsaverage5 mesh + vertex color buffer | unit | `vitest frontend/src/features/results/__tests__/BrainCanvas.test.tsx --run` | ❌ Wave 0 |
| **FE-01** | `computeColorBuffer(activations, parcellation, activeCircuit)` outputs 20484×3 Float32 with active-circuit regions colored and others neutral | unit (pure function) | `vitest frontend/src/features/results/__tests__/colorBuffer.test.ts --run` | ❌ Wave 0 |
| **FE-01** | Circuit toggle calls setState and triggers color-buffer recomputation (snapshot of mock mesh update) | component | `vitest frontend/src/features/results/__tests__/CircuitSelector.test.tsx --run` | ❌ Wave 0 |
| **FE-01** | Per-screen vertex endpoint returns 20484 Float32 values for valid `(job_id, screen_index)` and 404 for unknown | integration (pytest) | `~/.venvs/brainx/bin/python -m pytest tests/test_vertex_endpoint.py -q` | ❌ Wave 0 |
| **FE-01** | Scrubber drag to screen N triggers activation fetch for that screen | component | `vitest frontend/src/features/results/__tests__/TimelineScrubber.test.tsx --run` | ❌ Wave 0 |
| **FE-02** | ResultsLayout mounts `BrainCanvas` and `RecommendationsPanel` side-by-side (grid columns verified) | component | `vitest frontend/src/features/results/__tests__/ResultsLayout.test.tsx --run` | ❌ Wave 0 |
| **FE-02** | Clicking a `RecommendationCard` sets `activeRecId`, `activeScreenIndex`, and `activeCircuit` in the store and emits a highlight event | component | `vitest frontend/src/features/results/__tests__/RecommendationCard.test.tsx --run` | ❌ Wave 0 |
| **FE-02** | Recommendation footer shows `{circuit} · {region} · {score}/100 · {rank}` from evidence (REC-01 grounding citation surfaces in UI) | component | same as above | ❌ Wave 0 |
| **FE-02** | `ROIScoreTable` renders all `regions` from `AnalysisResult.roi[activeScreenIndex].regions` sorted by score desc | component | `vitest frontend/src/features/results/__tests__/ROIScoreTable.test.tsx --run` | ❌ Wave 0 |
| **FE-02** | `CircuitScoreBar` × 5 renders all five circuit names with correct chart-N gradient assignment | component | `vitest frontend/src/features/results/__tests__/CircuitScoreBar.test.tsx --run` | ❌ Wave 0 |
| Integration | Full happy path: create persona → upload text → analyze → poll → results load | e2e | `cd frontend && npx playwright test tests/e2e/happy-path.spec.ts` | ❌ Wave 0 |
| Integration | Polling stops on `DONE`; auto-transitions to results | component + fake timers | `vitest frontend/src/features/run/__tests__/useJobStatus.test.ts --run` | ❌ Wave 0 |
| Integration | Polling stops on `ERROR`; shows "Analysis failed" state with Try Again | component | `vitest frontend/src/features/run/__tests__/ProgressView.test.tsx --run` | ❌ Wave 0 |
| Integration | `localStorage` rehydrate on refresh: partial wizard restores, in-flight job resumes polling | component | `vitest frontend/src/features/wizard/__tests__/rehydrate.test.ts --run` | ❌ Wave 0 |
| Integration | Multipart upload for 1–5 screens hits `/content/screens` with correct FormData structure | component + MSW | `vitest frontend/src/features/content/__tests__/ScreenUploader.test.tsx --run` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd frontend && npm run test -- --run --changed` (runs only tests touched by the diff; falls back to full suite if config changes).
- **Per wave merge:** `cd frontend && npm run test -- --run` (full Vitest suite).
- **Phase gate:** `cd frontend && npm run test -- --run && npx playwright test && cd .. && ~/.venvs/brainx/bin/python -m pytest -q` — all green before `/gsd-verify-work`.

### Wave 0 Gaps

Wave 0 of plan 04-01 must create:

- [ ] `frontend/vitest.config.ts` — test runner config (jsdom env, setup file path).
- [ ] `frontend/tests/setup.ts` — global test setup (jest-dom matchers, MSW server, fake fetch).
- [ ] `frontend/tests/msw/handlers.ts` — MSW request handlers mirroring `/personas`, `/content/*`, `/analyze`, `/jobs/{id}`, `/jobs/{id}/activations/{n}`.
- [ ] `frontend/playwright.config.ts` — e2e config (base URL, fixtures).
- [ ] `frontend/src/lib/api-types.ts` — TypeScript types mirroring the Pydantic schemas in this document.
- [ ] `frontend/src/lib/api-schemas.ts` — zod parsers for runtime validation.
- [ ] `tests/test_vertex_endpoint.py` — pytest coverage for the NEW backend endpoint that streams per-screen Float32 activations. Must assert: 200 response, `Content-Type: application/octet-stream`, body length == 20484 × 4, correct shape header, 404 on unknown `(job_id, screen_index)`.
- [ ] Framework install: `cd frontend && npm install -D vitest @vitest/ui @testing-library/react @testing-library/user-event jsdom msw @playwright/test` — no existing JS test harness present.

---

## Security Domain

> Project config has no explicit `security_enforcement` key. Defaulting to enabled. This phase is low-risk (single-user researcher tool, no OAuth, no PII — per REQUIREMENTS.md §Out of Scope), but the ASVS sweep below ensures nothing obvious is missed.

### Applicable ASVS categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | REQUIREMENTS.md §Out of Scope explicitly defers OAuth/user auth to v2. Single-user tool. |
| V3 Session Management | no | No sessions in Phase 4. |
| V4 Access Control | no | No multi-user model. |
| V5 Input Validation | yes | zod on every API response boundary; react-hook-form + zodResolver on every form input. Persona fields validated against the backend's Pydantic constraints (age 0–120, name 1–120, etc.). |
| V6 Cryptography | no | Nothing crypto-sensitive in the frontend. Vertex arrays are neuroscientific activation values, not secrets. |
| V7 Error Handling / Logging | yes | Do not leak backend error traces to UI. `error_message` from `/jobs/{id}` is currently a free-form string populated by queue.py; the UI should show the static UI-SPEC copy ("Something went wrong during brain inference…") unless the error starts with a known "A1 vertex-count invariant violated" prefix in which case a separate "Backend model shape error" branch is fine. |
| V8 Data Protection | partial | Uploaded screenshots may contain PII (emails, names). They are stored on the backend filesystem (`uploads/`) and not transmitted further. Frontend should not log them to console. |
| V13 API | yes | CORS already limits origins (backend/main.py). No auth means anyone on localhost can hit the API — acceptable per single-user scope. |
| V14 Config | yes | `VITE_API_BASE_URL` is the only env var, not secret. No `.env` secrets in frontend bundle (Vite exposes only `VITE_*` vars to client code by design). |

### Known threat patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via user-submitted persona name / content text echoed into recommendations | Tampering | React escapes by default; never use `dangerouslySetInnerHTML` with server-derived content. |
| Reflected XSS via querystring | Tampering | Phase 4 has minimal URL params (at most `jobId`); strictly validate with zod before use. |
| CSRF | Tampering | No cookies / no auth, so CSRF has no target. If auth is added in v2, add a CSRF token pattern. |
| Upload abuse (oversized files, non-image content, polyglot) | DoS / Tampering | Backend `process_upload` already validates images (Phase 2). Frontend adds `<input type="file" accept="image/*">` and a client-side size preflight (reject > 10 MB) as UX-not-security. |
| Open redirect | Tampering | No external redirects in Phase 4. |
| Prototype pollution in JSON parse | Tampering | `JSON.parse` (and `fetch().json()`) are safe in V8. zod adds a second layer. |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | React 19 is the correct React major for this phase despite CONTEXT.md D-02 saying "React 18". | §Stack decisions | If D-02 must be literally honored, pin `@react-three/fiber@8.x` instead; the rest of the stack works on both React 18 and 19. Cost: ~10 minutes to swap pins. **Planner should confirm with user OR update CONTEXT.md to read "React 18 or 19".** |
| A2 | `@react-three/fiber@8.x` supports React 18. | §Stack decisions | If false, the downgrade escape hatch in A1 does not work and R3F must be pinned to a React-18-compatible older version (likely 8.15.x per common knowledge). Verifiable via `npm view @react-three/fiber@8 peerDependencies` during planning. |
| A3 | fsaverage5 pial mesh pre-baked to `{positions: Float32Array, indices: Uint32Array}` fits under ~500 KB gzipped. | §3D brain visualization | If wrong, first-load time suffers. Mitigation: lazy-load the mesh asset during the progress view (plenty of wall-clock time to prefetch it). |
| A4 | Reading CSS custom properties (`--chart-N`) at runtime in JS returns a parseable OKLCH string that `THREE.Color.setStyle` accepts. | §Pitfall 9 | If three.js cannot parse OKLCH strings on this version, fall back to pre-computing sRGB triples at build time. Not a blocker, just adds a small build step. Verify on day 1 of plan 04-03. |
| A5 | Baked per-vertex AO provides the "anatomical realism" look of D-22 without needing real-time SSAO. | §Pitfall 10 | If the bake looks flat, enable SSAO postprocessing. No architectural change. |
| A6 | UI-SPEC D-10 "secondary locations" behavior maps sensibly to Recommendation.evidence (one location per rec). Cycling through multiples may only apply when the UI groups multiple recs by region. | §Results rendering approach | If the expected UX is "one rec implies many brain locations," the backend `Recommendation` model does not carry that yet. Planning may need to downscope or the discuss-phase may need a follow-up. |

**All other claims in this research were verified against shipping code (`[VERIFIED: ...]`) or cited to authoritative docs (`[CITED: ...]`).**

---

## Open Questions (RESOLVED)

> **None of these are RESEARCH BLOCKED-level.** They are reconcilable during planning. But all four deserve explicit resolution before plan 04-02 starts.
>
> **Resolution status (2026-04-24):** All four resolved during `/gsd-plan-phase` orchestration. Per-question resolution notes inlined below.

1. **Stage / status enum drift between CONTEXT.md, UI-SPEC.md, and the shipping backend.** _(RESOLVED — Plan 04-02 Task 1 ships `frontend/src/lib/stageLabels.ts` with the 6→4 mapping below baked in; status terminal values `DONE`/`ERROR` map to display labels `COMPLETE`/`FAILED` only at the UI boundary, in-code types follow backend.)_
   - CONTEXT.md D-16 and UI-SPEC §Progress View list stages as "PENDING / SIMULATING / INFERRING / AGGREGATING / COMPLETE" and use "FAILED" for errors.
   - The shipping backend uses `status: PENDING | RUNNING | DONE | ERROR` plus `stage: simulation | grounding_check | inference | roi_aggregation | processing | recommendations` (lowercase, 6 stages).
   - **Recommended resolution:** keep the UI *copy* exactly as UI-SPEC specifies (that's user-facing language, not a contract), but map backend values to display labels in a single `frontend/src/lib/stageLabels.ts` helper. E.g. `stage: "simulation" → "Simulating how your persona experiences this content…"`. Two backend stages (`grounding_check`, `processing`) need display copy — reasonable defaults: "Verifying simulation quality…" and "Aggregating results…" respectively. UI-SPEC lines 247–250 already cover most of these; the missing two ("grounding_check" and "recommendations") need copy decisions. Planner's call, or a quick user confirmation.

2. **`localStorage` rehydration of in-flight jobs.** _(RESOLVED — Plan 04-02 ships `useJobRehydrate.ts` that reads `jobId` from the persisted wizard store on mount and resumes `useJobStatus` polling if status is `PENDING`/`RUNNING`.)_
   - D-18 says state persists across refresh. What happens if the user refreshes mid-RUNNING? Backend has the job; frontend should resume polling. No decision blocker — just a case to implement — but the planner should explicitly scope it in 04-02.

3. **UI-SPEC D-10 cycling through secondary locations.** _(RESOLVED — interpretation (a) adopted: group recommendations by `screen_index`. Plan 04-03 ships `recommendationsByScreen.ts` derived selector and treats each rec as a single primary location; "secondary" pointers are the other recs in the same screen group.)_
   - Each `Recommendation` carries exactly one `evidence.region`. The "cycle through multiple secondary locations" behavior needs a UX interpretation: either (a) it applies when multiple recommendations share the same `screen_index`, or (b) it is a property of `layout_flag` recs with both `target_region` and `evidence.region` (one is UI coordinates, the other is brain anatomy). Recommend **(a)**: group recommendations by `screen_index`, and clicking one rec highlights it while the rest of the group become "secondary" pointers on the scrubber/brain.

4. **Copywriting gap: "grounding_check" and "recommendations" stage labels.** _(RESOLVED — folded into Plan 04-02's `stageLabels.ts` mapping below. No new UI copy needed; UI-SPEC stays verbatim.)_
   - UI-SPEC Copywriting Contract covers `PENDING, SIMULATING, INFERRING, AGGREGATING, COMPLETE`. It does NOT cover the actual backend stages `grounding_check`, `processing`, `recommendations`. Minimal addition — recommend: "Validating simulation grounding…", "Finalizing results…", "Generating recommendations…". Planner may elect to fold these into the existing four display stages by mapping the 6 backend stages onto the 4 spec'd display stages for the UI:
     ```
     backend.stage → display.stage
     (null while PENDING)    → "Queued"
     simulation              → "Simulating how your persona experiences this content…"
     grounding_check         → "Simulating how your persona experiences this content…"
     inference               → "Running brain inference…"
     roi_aggregation         → "Running brain inference…"
     processing              → "Aggregating results…"
     recommendations         → "Aggregating results…"
     ```
   - This preserves UI-SPEC copy verbatim. Recommended approach.

---

## References

### Primary (HIGH confidence)

- `backend/models/job.py` — `StageEnum` definition, 6 stages. `[VERIFIED by Read]`
- `backend/models/results.py` — `AnalysisResult` envelope, `SCHEMA_VERSION = 1`. `[VERIFIED by Read]`
- `backend/models/persona.py` — Persona sub-object schemas. `[VERIFIED by Read]`
- `backend/models/schemas.py` — All Pydantic request/response types. `[VERIFIED by Read]`
- `backend/models/continuity.py` — `FlowContinuity` + `TrendTag`. `[VERIFIED by Read]`
- `backend/models/recommendations.py` — Recommendation + evidence schema. `[VERIFIED by Read]`
- `backend/routers/analyze.py`, `jobs.py`, `personas.py`, `content.py` — All HTTP contracts. `[VERIFIED by Read]`
- `backend/core/queue.py` — Actual stage transitions, status lifecycle, activation file path convention. `[VERIFIED by Read]`
- `backend/services/roi_aggregation.py` — `ROI_CIRCUIT_MAP` (the canonical 5 circuit names), fsaverage5 bilateral count (20,484), Destrieux atlas integration. `[VERIFIED by Read]`
- `backend/main.py` — CORS configuration allows `localhost:5173` and `localhost:3000`. `[VERIFIED by Read]`
- `.planning/phases/04-frontend-upload-persona-and-results/04-CONTEXT.md` — Locked decisions D-01…D-25. `[VERIFIED by Read]`
- `.planning/phases/04-frontend-upload-persona-and-results/04-UI-SPEC.md` — Component inventory, copywriting, motion, accessibility. `[VERIFIED by Read]`
- `.planning/phases/04-frontend-upload-persona-and-results/04-DESIGN-TOKENS.css` — `@theme inline` token mapping. `[VERIFIED by Read]`
- `.planning/REQUIREMENTS.md` — FE-01, FE-02 wording. `[VERIFIED by Read]`
- npm registry for every version in §Stack decisions. `[VERIFIED: 2026-04-23 via npm view]`
- [Tailwind CSS v4 release post](https://tailwindcss.com/blog/tailwindcss-v4) — `@theme inline` pattern, OKLCH defaults, Vite first-party plugin.
- [TanStack Query v5 Polling Guide](https://tanstack.com/query/latest/docs/framework/react/guides/polling) — `refetchInterval` as function returning `false` to stop.
- [@react-three/fiber README + peerDependencies](https://github.com/pmndrs/react-three-fiber) — React 19 / three >=0.156 peer deps.

### Secondary (MEDIUM confidence)

- [NiiVue mesh documentation](https://niivue.com/docs/mesh/) — confirms GIfTI + per-vertex overlays supported in Niivue core; confirmed Niivue runs its own WebGL2 canvas. Relevant for the rejected alternative.
- [niivue/niivue-react README](https://github.com/niivue/niivue-react) — explicit "meshes not yet supported" statement.
- [nilearn fsaverage5 template docs](https://nilearn.github.io/dev/modules/description/fsaverage5.html) — 10,242 nodes per hemisphere, GIfTI format.
- [Tailwind v4 Vite setup walkthrough (Bryan Anthonio)](https://bryananthonio.com/blog/configuring-tailwind-css-v4/) — `@tailwindcss/vite` plugin usage.

### Tertiary (LOW confidence — flagged as ASSUMED)

- Bundle size estimates for the baked fsaverage5 mesh asset (A3). Will be verified during Wave 0 of plan 04-03.
- Real-time OKLCH parsing in `THREE.Color.setStyle` on three.js 0.184 (A4). Will be verified during plan 04-03.

---

## Metadata

**Confidence breakdown:**
- Stack decisions: HIGH — all versions verified against npm; peer-dep compatibility verified.
- API contract: HIGH — read directly from backend source of truth. Drift with CONTEXT.md is noted and resolvable.
- 3D visualization approach: HIGH — the Niivue elimination is definitive (their React wrapper is absent from npm and does not support meshes per its own README); R3F + custom BufferGeometry is a well-documented pattern.
- Polling strategy: HIGH — cited TanStack docs.
- Multipart upload: HIGH — standard pattern.
- Motion / accessibility: MEDIUM — derived from UI-SPEC which is already the contract; nothing to research further.
- Backend endpoint shape for vertex streaming: MEDIUM — contract locked by D-04/D-05, exact URL is a planner call.

**Research date:** 2026-04-23
**Valid until:** 2026-05-23 (30 days — stable stack, no fast-moving component)

---

## RESEARCH COMPLETE

Research is complete. The planner can proceed with plans 04-01, 04-02, 04-03, subject to the four reconcilable items in §Open Questions being addressed in the plan text (none of them are RESEARCH BLOCKED-level; they are ambiguities the planner needs to resolve with either a mapping helper or a minor copywriting decision).
