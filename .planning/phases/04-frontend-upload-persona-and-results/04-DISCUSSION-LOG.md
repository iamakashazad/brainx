# Phase 4: Frontend — Upload, Persona, and Results - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `04-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-04-22
**Phase:** 04-frontend-upload-persona-and-results
**Areas discussed:** Project shape + stack + vertex delivery; Results panel + 3D brain; Upload + persona form flow; Visual style / reference

---

## Project Shape + Stack + Vertex Delivery

*(Captured in the earlier session before interruption. Preserved from the discussion checkpoint for completeness.)*

| Question | Options presented | Selected |
|---|---|---|
| Where should the React app live? | frontend/ sibling, backend/static/, Top-level src/ | frontend/ sibling |
| Build tool + framework? | Vite + React + TS, Next.js 14, Vite + React (no TS) | Vite + React 18 + TypeScript |
| Styling solution? | Tailwind + Radix, Tailwind only, shadcn/ui, CSS Modules | Tailwind CSS + Radix UI |
| Vertex delivery to 3D brain? | Binary Float32, JSON floats, Region-only, Inline in result_json | New endpoint serves binary Float32 |
| Vertex endpoint payload? | Mean only, Mean + peak, Full timeseries | Time-mean only (Float32[~20k]) |
| fsaverage5 parcellation delivery? | Static asset, Backend endpoint, Embedded per response | Static asset bundled in frontend |

---

## Results Panel + 3D Brain

### First-screen layout
| Option | Description | Selected |
|---|---|---|
| Brain primary, recs secondary | 3D brain is the hero (60-70%); recs to the side/below | ✓ |
| Split 50/50 | Brain and recs share screen equally | |
| Recs primary, brain secondary | Recs are hero; brain smaller visual aid | |
| Tabbed (switch between) | One view at a time with toggle tab | |

### Per-screen navigation
| Option | Description | Selected |
|---|---|---|
| Horizontal screen thumbnails + brain updates | Thumbnail strip; click swaps brain data | |
| Play-through timeline scrubber | Timeline auto-advances through screens; brain animates | ✓ |
| Stacked vertical sections | Each screen its own section with its own mini-brain | |
| Aggregate-only | No per-screen UI; mean across screens | |

### Five-circuit representation
| Option | Description | Selected |
|---|---|---|
| Single circuit at a time, user toggles | User picks one from selector | ✓ |
| All five overlaid with distinct colors | All circuits simultaneously in different hues | |
| Single + adjacent score bars | Brain shows one; bars show all 5 | |
| Thumbnails + focused | Small thumbnails per circuit + one large | |

### Recommendation linkage to brain
| Option | Description | Selected |
|---|---|---|
| Click rec → brain highlights region/screen | Recs clickable; highlights and scrubs | ✓ |
| Brain region click → recs filter | Reverse direction | |
| Bidirectional | Both directions work | |
| No linkage | Independent panels | |

### Scrubber behavior on load
| Option | Description | Selected |
|---|---|---|
| Auto-play once, then stop at last screen | Plays through automatically, settles | ✓ |
| Manual only (no auto-play) | Defaults to aggregate; user drags | |
| Auto-play with user-pausable controls | Play/pause + speed control | |

### Brain camera controls
| Option | Description | Selected |
|---|---|---|
| User-rotatable + preset view buttons | Orbit + L/R/top/front quick-jumps | ✓ |
| Fully free orbit controls only | OrbitControls, no presets | |
| Fixed canonical view | Single locked angle | |
| Auto-rotate idle, stops on interaction | Slow rotation until touched | |

### Default circuit on load
| Option | Description | Selected |
|---|---|---|
| Highest-scoring circuit for this job | Job-specific; tailored | ✓ |
| Fixed canonical order | Same every job | |
| "All circuits" summary view first | Adjacent bars; user enters brain after | |

### Rec click when multiple screens/regions
| Option | Description | Selected |
|---|---|---|
| Jump to primary, subtly mark others | Click cycles through; dots indicate others | ✓ |
| Mini-sequence animation | Scrubber auto-animates through referenced screens | |
| Claude's discretion | Planner decides | |

---

## Upload + Persona Form Flow

### Overall flow shape
| Option | Description | Selected |
|---|---|---|
| Step wizard: Persona → Content → Run → Results | Numbered steps with Next buttons | ✓ |
| Single page, stacked sections | All on one page, scroll down | |
| Two-pane: persona left, content right | Side-by-side independent | |
| Persona-first page → content+run page | Two pages | |

### Persona creation UX
| Option | Description | Selected |
|---|---|---|
| Single long form | All four sections on one screen, collapsible | |
| Tabbed form (four tabs) | One tab per sub-object with progress indicator | ✓ |
| Templates + customize | Starter templates to pick from | |
| AI-assisted: plain text → fields | LLM fills from natural language description | |

### Content upload UX
| Option | Description | Selected |
|---|---|---|
| Three clear tabs: Text · UI screens · Static | 1:1 mapping to backend endpoints | ✓ |
| Single dropzone, auto-detect | One drop area; type inferred from files | |
| Radio buttons + dynamic field | "What are you testing?" selector | |

### Run state UX
| Option | Description | Selected |
|---|---|---|
| Full-screen progress with stage + queue position | Replaces form; polls /jobs/{id} | ✓ |
| Inline progress banner, form visible | Banner at top; form locked below | |
| Redirect to /results/{job_id} immediately | Page morphs from progress to results | |

### Persona reuse
| Option | Description | Selected |
|---|---|---|
| Library: pick from saved or create new | Step 1 opens on list; new opens form | ✓ |
| Always create new, no library | Form every time | |
| Implicit library via recent (last 5) | Strip of recents + new-form | |

### Content reuse
| Option | Description | Selected |
|---|---|---|
| Always fresh upload, no content library | Simpler; content ephemeral to run | |
| Library: pick from previous uploads | Like personas | |
| Claude's discretion | Planner decides based on Phase 5 scope | ✓ |

### Wizard navigation + refresh behavior
| Option | Description | Selected |
|---|---|---|
| Free nav between steps; refresh loses progress | Stepper jumps; in-memory only | |
| Free nav; refresh restores via localStorage | Same nav; state persisted | ✓ |
| Linear only; refresh loses progress | Must go in order | |
| Linear with Back; refresh restores via URL | Per-step URLs | |

### On COMPLETE status
| Option | Description | Selected |
|---|---|---|
| Auto-transition immediately on COMPLETE | Zero-click; progress fades into results | ✓ |
| Show "Done! View results" button | Morph into success card with button | |
| Auto-transition after 1s delay | Brief "Complete" flash then auto | |

---

## Visual Style / Reference

*(User supplied a complete OKLCH design token file; tokens drive palette/typography/radius/shadow. The questions below covered what tokens cannot specify.)*

### 3D brain aesthetic
| Option | Description | Selected |
|---|---|---|
| Anatomical realism — gyri/sulci shading, matte surface | MeshStandardMaterial + AO; credible to neuro audiences | ✓ |
| Stylized/semi-abstract | Simplified surface; activation colors dominate | |
| Tech/wireframe hybrid | Mesh + edge lines; "diagnostic" feel | |
| Glassy/translucent | Fresnel rim lighting; aesthetic but muddier | |

### Motion density
| Option | Description | Selected |
|---|---|---|
| Subtle/calm — transitions only at state boundaries | Instrument-like quiet | |
| Moderate — purposeful motion with identity | Polished without showy | |
| Rich/cinematic — motion as part of the story | Hero brain assembly, circuit morphs | ✓ |

### Data viz treatment
| Option | Description | Selected |
|---|---|---|
| Minimal — thin bars, muted colors | Analytical; value/precision focus | |
| Expressive — gradient fills, larger bars, animated on load | Personality; uses chart-* token gradients | ✓ |
| Mixed — minimal default, accent on selected circuit | Calm with highlight on active | |

### Aesthetic reference
| Option | Description | Selected |
|---|---|---|
| Linear / Arc — crisp dark-native, high signal-density | Developer-tool feel | |
| Figma / Framer — product-designer polish, playful moments | Designer-tool feel; defined shadows, hover moments | ✓ |
| Medical/scientific instrument | Roboto Mono readouts, calibrated feel | |
| Claude's discretion | Token palette + standard patterns | |

---

## Claude's Discretion

- Content library / reuse — Phase 4 defaults to fresh upload; Phase 5 owns persistence.
- Loading-skeleton design and error-state treatments.
- Three.js camera start pose, easing curves, specific motion timings.
- Progress view side content (persona summary, content preview while waiting).
- Circuit name ordering in the toggle (follows backend `ScreenROI.circuits`).
- Stepper orientation (horizontal vs vertical).

## Deferred Ideas

- Content library UI
- AI-assisted persona text-to-fields
- Light theme toggle (tokens ready; wiring deferred to Phase 5 polish)
- Shareable `/results/{job_id}` URLs (Phase 5 persistence)
- Queueing multiple jobs from the UI
- Full timeseries / peak-activation vertex delivery
- Scheduled / automated runs
