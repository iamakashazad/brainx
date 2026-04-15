# Phase 2: Simulation Pipeline and Content Input — Research

**Researched:** 2026-04-14
**Domain:** Multimodal LLM orchestration (DeepSeek V3 + VL2) + content-input plumbing (multipart uploads, image processing, persona CRUD, 5-stage job lifecycle)
**Confidence:** MEDIUM-HIGH — stack/FastAPI/Pillow/alembic/Pydantic patterns are HIGH; DeepSeek-VL2 cloud-availability is MEDIUM (ecosystem is in flux); per-image token cost and VL2 strict `json_schema` support are LOW and must be validated at implementation time

## Summary

Phase 2 adds the user-facing orchestration layer — persona CRUD, content upload (three types), `POST /analyze` composition, DeepSeek simulation + grounding, and deterministic overlay derivation — on top of the Phase 1 GPU worker. The phase has no new ML risk (TRIBEv2 is already proven and locked to `DEFAULT_PATHWAY=text` post-01-04), but introduces meaningful integration risk around (a) DeepSeek's JSON mode which officially supports only `json_object` (not `json_schema`), forcing a "JSON-mode + Pydantic-validate + repair-once" pattern rather than schema-enforced OpenAI-style structured outputs, and (b) DeepSeek-VL2 not being a first-class model on DeepSeek's own cloud API — reaching it requires a third-party provider (Replicate, DeepInfra) or self-hosting.

**Primary recommendation:** Treat DeepSeek as two subtly different clients — an OpenAI-SDK client against `https://api.deepseek.com` for V3 (`deepseek-chat`) and a separate adapter (Replicate or DeepInfra, configurable via env var) for VL2 — behind a single `backend/services/deepseek_client.py` facade. Use `response_format={"type": "json_object"}` plus Pydantic v2 post-validation plus a single "repair" retry. Make the grounding judge return a structured list of hallucinated elements, not prose. Do every image resize/JPEG/EXIF-strip step with Pillow 11.x in the POST handler (synchronous, atomic) and use `python-magic` for MIME sniffing on the first 2KB of each upload.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**DeepSeek Simulation Service**
- **D-01:** DeepSeek-VL2 for any content containing images (UI-screen flows CONT-01 and static image content CONT-02). DeepSeek-V3 for pasted-text content (CONT-03). Content type dispatches model choice — no cross-routing.
- **D-02:** Simulation output is a strict JSON schema enforced via DeepSeek's `response_format` (JSON mode) and validated by a Pydantic v2 model on return. Schema violations trigger a single "repair" retry prompt before failing the job.
- **D-03:** Screen grounding is validated by a second DeepSeek-VL2 pass acting as judge: given the uploaded screens and the narrative produced by D-01, return a list of referenced UI elements not visible in the images. Any hallucination returned ⇒ job fails grounding. No threshold — zero-tolerance for v1.
- **D-04:** Transient/schema failures retry once (schema → "repair" prompt; API → identical prompt). Hallucination failures do NOT retry. Exhaustion → ERROR with descriptive `error_message` visible via `GET /jobs/{id}`.

**Persona Builder API**
- **D-05:** Personas in a single `personas` SQLAlchemy table with typed JSON columns per group: `demographics`, `psychographics`, `cognitive_state`, `environment`, plus `id`, `name`, `created_at`, `updated_at`. Each JSON blob validated by a dedicated Pydantic v2 model on write.
- **D-06:** Persona endpoints: `POST /personas`, `GET /personas`, `GET /personas/{id}`, `PATCH /personas/{id}`, `DELETE /personas/{id}`. No ownership/auth checks in v1.

**Content Input API**
- **D-07:** `Content` is an independent resource keyed by `content_id`. Three types: `ui_screens` (1–5 images), `static` (1 image), `text` (inline string). `POST /content` → returns `content_id`. Referenced by `POST /analyze { persona_id, content_id }`.
- **D-08:** Image files on disk under `uploads/{content_id}/` (`screen_{n}.jpg` / `image.jpg`). Text stored inline in a `content_text` column. Metadata in a `contents` SQLite table.
- **D-09:** Pillow 11.x pipeline: validate MIME (`image/{png,jpeg,webp}`), enforce pre-resize size ≤ 5 MB, resize so longest edge ≤ 1024 px, re-encode as JPEG Q85, strip EXIF. 400 on envelope violation. Synchronous in POST handler.
- **D-10:** `ui_screens` bounded to 1–5 images; 400 outside this range.

**Composition and Orchestration**
- **D-11:** `POST /analyze` accepts `{ persona_id, content_id }` → `{ job_id, status: "PENDING" }`. Creates job row, enqueues, returns immediately.
- **D-12:** `Job` gains two nullable FKs: `persona_id`, `content_id`. Phase 1 `/test-inference` continues to work with NULL.

**Simulation Log Schema (SIM-01, SIM-04)**
- **D-13:** Shape: `screens: [{ screen_index, narrative_text, summary_emotional_state, memorability_hypothesis, events: [{ timestamp_ms, type, target_region, intensity: 0..1, note }] }]`. Static/text = single screen (index=0).
- **D-14:** `narrative_text` per screen is the user-facing raw log for SIM-04. No top-level narrative.

**Overlay Derivation (SIM-02)**
- **D-15:** Deterministic derivation in `backend/services/overlay.py` — no second LLM call. Emits per screen: `hesitation_points` and `scroll_path`. Text/static = hesitation only; `scroll_path` empty/null.
- **D-16:** Computed once at end of simulation stage, merged into job result.

**Log Storage (SIM-04)**
- **D-17:** Full log + overlays persisted in `Job.result_json`. `GET /jobs/{id}` returns the structure once DONE. No new endpoint.

**Job Lifecycle**
- **D-18:** 5-stage lifecycle using existing `stage` column: `simulation` → `grounding_check` → `inference` → `processing` → (DONE). Status remains PENDING → RUNNING → DONE/ERROR.
- **D-19:** `StageEnum` in `backend/models/job.py` (or sibling). `transition(job, StageEnum.X)` helper in `backend/core/queue.py` replaces inline string assignments — writes DB + emits log line.
- **D-20:** Per-stage failure policy:
  - `simulation`: retry once (D-04)
  - `grounding_check`: no retry; job → ERROR with concrete `error_message`
  - `inference`: Phase 1 D-07 (single retry)
  - `processing`: any exception fails hard with ERROR

### Claude's Discretion
- Exact DeepSeek prompt text for V3 and VL2 paths
- Internal module layout for `backend/services/` additions (keep files small)
- Alembic migration file naming (`00N_description.py`)
- Exact repair-prompt wording for schema-failure retry
- Whether to store a cached base64 of resized images or re-encode on VL2 call
- Intensity scale normalization rules for `events[].intensity` (must be 0..1 but exact mapping up to Claude)

### Deferred Ideas (OUT OF SCOPE for this phase)
- Job lifecycle stand-alone deep-dive (captured implicitly by D-11/D-12/D-18..D-20)
- Rate limiting / queue-depth rejection (`429` at depth ≥ 5) — Phase 5
- 300 s job timeout watchdog — Phase 5
- Multiple personas per session
- URL screenshot auto-capture (EXT-02) — v2
- A/B variant comparison (ADV-01) — v2
- Persisted content ownership / auth scoping — no auth in v1
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SIM-01 | System generates gaze narrative via DeepSeek (persona + content → structured text session log) as TRIBEv2 input | DeepSeek JSON-mode + Pydantic validate + repair-once pattern (§Standard Stack, §DeepSeek Integration, D-01..D-04) |
| SIM-02 | System produces scroll/hesitation map overlay derived from the simulation log | Deterministic `overlay.py` algorithm sketch (§Overlay Derivation) |
| SIM-04 | User can view the raw simulation log (full DeepSeek session output) | `Job.result_json.simulation.screens[].narrative_text` via existing `GET /jobs/{id}` (D-14, D-17) |
| CONT-01 | User can upload 1–5 UI screens as images to form an analysis flow | Multipart upload pattern + Pillow pipeline + count enforcement (§FastAPI Multipart, D-09, D-10) |
| CONT-02 | User can upload static content (ads, social images) for standalone analysis | Same pipeline as CONT-01 with `type=static`, single-image path (D-07, D-08) |
| CONT-03 | User can paste text directly as content | JSON body branch of `POST /content`; inline `content_text` column (D-07, D-08) |
| PERS-01 | Persona with demographics + psychographic profile | Single `personas` table + 4 typed JSON columns (D-05) |
| PERS-02 | Cognitive state (attention span, stress, tech literacy) | `cognitive_state` JSON column + dedicated Pydantic model (D-05) |
| PERS-03 | Usage environment (device, location, ambient) | `environment` JSON column + dedicated Pydantic model (D-05) |
| PERS-04 | Save persona and reuse across sessions | 5 CRUD endpoints (D-06); reuse via `POST /analyze { persona_id }` (D-11) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

No `./CLAUDE.md` in repo root (verified 2026-04-14). No `.claude/skills/` or `.agents/skills/` directory present. Standard project conventions apply as established by existing `backend/` code:
- `from __future__ import annotations` at top of every module
- Async SQLAlchemy 2.0 idioms (`select(...).where(...)` + `async with session`)
- Pydantic v2 (model_config, model_dump, Field validators — not Config, not .dict())
- No sync I/O in request handlers
- `settings` object via `pydantic-settings` at `backend/core/config.py`
- Test convention: `pytest` + `pytest-asyncio` + `httpx.AsyncClient` with `ASGITransport`, monkeypatching `backend.core.database` and `backend.core.queue` for isolation (see `tests/test_api.py`)

## Standard Stack

### Core (new for Phase 2)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Pillow | 11.3.x (verified 12.2.0 available 2026-04-01 but pin to 11.3.x for Phase 1 parity unless STACK.md is re-verified) | JPEG encode, Lanczos resize, EXIF strip | [CITED: pillow.readthedocs.io] — dominant Python imaging library; Lanczos + Q85 is the canonical "UI screenshot" recipe |
| python-magic | 0.4.27 | MIME sniffing via libmagic first bytes | [VERIFIED: PyPI] — defeats Content-Type spoofing; macOS requires `brew install libmagic` |
| aiofiles | 24.1.x | Async disk writes for upload bytes | [CITED: fastapi.tiangolo.com] — avoids blocking event loop on `f.write()` |
| openai (SDK) | ≥1.40.0 (already planned per STACK.md) | OpenAI-compatible client pointed at DeepSeek | [CITED: api-docs.deepseek.com] — "compatible with OpenAI SDK, just swap base_url" |
| pydantic | 2.x (already installed) | Validate DeepSeek JSON output + persona groups + content request | Already the project standard |
| SQLAlchemy | 2.0.x (already installed) | `personas` and `contents` tables + new FKs on `jobs` | Already the project standard |
| alembic | 1.18.x (already installed) | Migration 002 adds personas/contents, migration 003 adds FKs on jobs | Already the project standard |

### Supporting / test
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| respx | 0.23.1 | Mock all DeepSeek HTTP calls in pytest | [VERIFIED: PyPI 2026-04-08] — required since openai SDK uses httpx under the hood; no real DeepSeek calls in CI |
| pytest-asyncio | 0.24.x (already installed) | Async test fixtures | Already the project standard |
| httpx | 0.27.x (already installed) | `httpx.AsyncClient` test client | Already the project standard |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| python-magic | file extension + PIL `Image.open()` then catch `UnidentifiedImageError` | Extension can be spoofed (jpg rename of .exe). PIL will catch most but not all non-image bytes. python-magic is the defense-in-depth option — the extra install step (libmagic via brew/apt) is worth it for untrusted upload handling. |
| respx | Patching `AsyncOpenAI.chat.completions.create` directly | Patching the SDK method works but couples tests to SDK internals. respx mocks at the HTTP layer, so it stays valid if the SDK rewrites. Prefer respx. |
| aiofiles | `await asyncio.to_thread(path.write_bytes, data)` | Functionally equivalent for small files. aiofiles is cleaner for streaming chunks; `to_thread` is fine for one-shot writes after Pillow has fully buffered the image in memory. Either is acceptable — prefer aiofiles for consistency with ecosystem. |
| DeepSeek-VL2 on Replicate | Self-hosted VL2 via lmdeploy | Self-hosting means another GPU service to manage and blows the single-GPU-worker invariant. Use a hosted provider. |

**Installation:**
```bash
# Pillow, python-magic, aiofiles — add to requirements
pip install "Pillow>=11.3,<12" python-magic aiofiles respx

# libmagic system dependency
# macOS:
brew install libmagic
# Debian/Ubuntu:
sudo apt-get install libmagic1
```

**Version verification:** At implementation time, pin Pillow to the version reported by `pip show Pillow` in the existing conda env so Phase 2 cannot drift the env Phase 1 locked. Same for `openai`.

## DeepSeek Integration — Critical Detail

This is the phase's highest-risk area. Training data says "OpenAI-compatible structured outputs, just works." Reality as of 2026-04-14 is more nuanced.

### What DeepSeek's Official API Supports

[CITED: api-docs.deepseek.com/guides/json_mode, api-docs.deepseek.com/]

| Capability | Status |
|-----------|--------|
| Endpoint | `https://api.deepseek.com/chat/completions` (or `…/v1/chat/completions` for OpenAI-SDK) |
| Auth | `Authorization: Bearer $DEEPSEEK_API_KEY` |
| Text model | `deepseek-chat` (current = V3.2, 128K context) |
| Reasoning model | `deepseek-reasoner` (V3.2 thinking) |
| JSON mode | `response_format={"type": "json_object"}` — text-only |
| `json_schema` mode | **Not documented as supported.** Do not assume OpenAI-style strict schema enforcement. [CITED: api-docs.deepseek.com/guides/json_mode — "Only json_object type is supported"] |
| Known issue | Occasional empty content in JSON mode; docs explicitly flag this. |
| Vision model (`deepseek-vl2`) | **Not documented on the official chat-completions endpoint** as of 2026-04-14 [VERIFIED: WebSearch + api-docs.deepseek.com/ — neither `deepseek-chat` nor `deepseek-reasoner` is advertised as multimodal; VL2 is distributed as open weights on Hugging Face / Replicate] |
| `deepseek-v4` multimodal | Announced / rumored for mid-2026 but not GA at research time [ASSUMED — press coverage only] |

### Implication for D-01

D-01 says "DeepSeek-VL2 for images, V3 for text." The V3 half is easy: `deepseek-chat` with `json_object` mode against the official API. **The VL2 half requires a hosted-vision adapter** because VL2 is not on DeepSeek's official cloud chat endpoint. Two viable routes:

**Route A — Replicate** [CITED: replicate.com/deepseek-ai/deepseek-vl2]
- Model: `deepseek-ai/deepseek-vl2` (4.5B activated-param MoE VL2)
- ~$0.0058 per run, ~5s on A100
- Input: image URLs or base64, prompt string, temperature ≤ 0.7 recommended
- Dynamic tiling for ≤ 2 images; 3+ images padded to 384×384 (relevant for 5-screen flows — means VL2 gets less visual detail per screen in larger flows)

**Route B — DeepInfra / OpenRouter**
- OpenRouter as of 2026-04-14 does NOT carry deepseek-vl2 [VERIFIED: openrouter.ai/deepseek WebFetch] — only chat/reasoning variants
- DeepInfra catalog lists VL-family models but specific VL2 availability needs to be re-verified at implementation time [ASSUMED]

**Recommended:** Plan 02-03 should implement a `VisionProvider` abstraction with two concrete backends — `ReplicateVL2Backend` as the v1 default and a `DeepInfraVL2Backend` stub for later. Provider selected via env var `VISION_PROVIDER` (default `replicate`). The facade exposes one method: `async def analyze(images: list[Path], prompt: str, json_schema: dict) -> dict`.

### JSON-Mode Pattern (for both V3 and VL2 where supported)

Since DeepSeek JSON mode is `json_object`-only (no schema-side enforcement), the pattern is:

```python
# backend/services/deepseek_client.py  [ILLUSTRATIVE — verify types at impl time]
from __future__ import annotations
from openai import AsyncOpenAI
from pydantic import ValidationError
from backend.models.simulation import SimulationLog  # Pydantic v2 model

client = AsyncOpenAI(api_key=settings.deepseek_api_key, base_url="https://api.deepseek.com")

async def simulate_text_content(persona_json: dict, text_content: str) -> SimulationLog:
    schema_hint = SimulationLog.model_json_schema()  # embed in prompt, NOT as response_format schema
    system = (
        "You simulate how a specific persona experiences content. "
        "Return ONLY valid JSON matching this schema (no prose, no markdown fences):\n"
        f"{json.dumps(schema_hint)}"
    )
    user = f"Persona: {json.dumps(persona_json)}\n\nContent:\n{text_content}"

    for attempt in (1, 2):  # single retry per D-04
        response = await client.chat.completions.create(
            model="deepseek-chat",
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
            response_format={"type": "json_object"},
            max_tokens=4000,
            temperature=0.6,
        )
        raw = response.choices[0].message.content
        try:
            return SimulationLog.model_validate_json(raw)
        except ValidationError as err:
            if attempt == 1:
                user = f"Previous attempt failed validation:\n{err}\n\nResend valid JSON. Same content as before:\n{text_content}"
                continue
            raise
```

Key points:
1. JSON schema is injected **as prompt text**, not as `response_format.schema` — DeepSeek doesn't honor the OpenAI `json_schema` extension (per official docs).
2. Pydantic v2 `model_validate_json` is the enforcement layer.
3. Repair retry re-submits the ValidationError message so the model can self-correct — this is the D-04 "repair" prompt.
4. `max_tokens` must be generous (4000+) for the full `screens[]` array of 5-screen flows; empty-content bug from DeepSeek docs is less likely with explicit max_tokens.
5. `temperature ≤ 0.7` for VL2 per Replicate guidance; 0.6 is a safe start.

### Grounding Judge Pattern (D-03)

Critical finding: the judge must return **structured output**, not a prose verdict. Otherwise the "zero-tolerance hallucination" gate becomes a string-parsing nightmare.

Schema the judge returns:
```json
{
  "hallucinations": [
    {
      "screen_index": 2,
      "narrative_claim": "\"Submit order\" button in top-right corner",
      "reason": "No such button visible; only a \"Continue\" link at bottom-center"
    }
  ],
  "verified_elements": ["Hero headline \"Try free\"", "Product image", "..."]
}
```

- `len(hallucinations) == 0` ⇒ PASS, continue to inference stage.
- `len(hallucinations) > 0` ⇒ FAIL, no retry (D-20), job → ERROR with `error_message` built from the list. Per `.planning/phases/02-simulation-pipeline-and-content-input/02-CONTEXT.md` <specifics>: "Narrative references 'Submit order' button not visible in screen 2".
- Prompt explicitly instructs: "If a claim is ambiguous, classify as hallucination." This matches D-03's zero-tolerance framing.
- Judge gets the **same images** that the simulator got, plus the **narrative_text** from the simulator output (not the full events array — judge only validates prose claims).

### Prompt Engineering Heuristics for the Judge

[ASSUMED — standard prompt-engineering practice, not DeepSeek-specific verified]

1. **Give the judge an extraction step before the verdict.** First asks it to list every concrete UI-element claim in the narrative (button, headline, form, image, icon, etc.); then asks it whether each is visible. Two-step is more reliable than one-step "is this narrative accurate?"
2. **Concrete > abstract.** The judge should only flag claims about *named / visible UI elements*. Emotional tone ("user feels rushed") is not subject to grounding — flag only "clicks the green button", "reads the pricing section", "scrolls past the footer".
3. **Use low temperature (0.2).** Judge calls want determinism.
4. **Bound output length.** `max_tokens=1200` is enough for 5 screens.

## Architecture Patterns

### Recommended Module Layout
```
backend/
├── routers/
│   ├── personas.py         # POST/GET/PATCH/DELETE /personas
│   ├── content.py          # POST /content (multipart + JSON)
│   ├── analyze.py          # POST /analyze — or fold into jobs.py
│   └── jobs.py             # existing — unchanged except response schema expansion
├── models/
│   ├── job.py              # add persona_id, content_id FKs + StageEnum
│   ├── persona.py          # new — Persona ORM + 4 Pydantic group models
│   ├── content.py          # new — Content ORM + Pydantic input variants
│   └── simulation.py       # new — SimulationLog / Screen / Event Pydantic v2
├── services/
│   ├── deepseek_client.py  # new — OpenAI-SDK facade, retry-repair loop
│   ├── simulation.py       # new — orchestrates V3 vs VL2 dispatch (D-01)
│   ├── grounding.py        # new — VL2 judge pass + hallucination parse (D-03)
│   ├── overlay.py          # new — deterministic event → overlay derivation (D-15)
│   ├── content_processing.py  # new — MIME sniff, Pillow resize/Q85/EXIF strip
│   └── vision_providers/   # new — Replicate / DeepInfra adapters for VL2
│       ├── base.py
│       └── replicate.py
└── core/
    └── queue.py            # extended — transition() helper, 5-stage worker
```

### Pattern 1: 5-Stage Worker Loop (D-18..D-20)

**What:** The existing `_process_job` is a single try/except around `run_tribev2_*`. Phase 2 expands it into a sequence of stage blocks, each with per-stage failure policy.

**When to use:** Every new simulation job.

**Example skeleton** (merge into existing `backend/core/queue.py`):
```python
from backend.models.job import StageEnum

async def transition(session, job: Job, stage: StageEnum) -> None:
    job.stage = stage.value
    await session.commit()
    logger.info("job %s → %s", job.id, stage.value)

async def _process_job(job_id: str) -> None:
    # ... load job, set status=RUNNING ...
    try:
        await transition(session, job, StageEnum.SIMULATION)
        sim_log = await simulation.simulate(persona, content)       # D-04 retry internally

        await transition(session, job, StageEnum.GROUNDING_CHECK)
        verdict = await grounding.judge(content, sim_log)           # no retry (D-20)
        if verdict.hallucinations:
            raise HallucinationError(verdict.hallucinations)

        await transition(session, job, StageEnum.INFERENCE)
        # build text input for TRIBEv2 from sim_log.screens[].narrative_text
        activation = await run_tribev2_text(build_narrative(sim_log))  # Phase 1 retry-once

        await transition(session, job, StageEnum.PROCESSING)
        overlays = overlay.derive(sim_log)                          # pure code, no retry
        np.save(activations_path, activation)
        job.result_json = {"simulation": sim_log.model_dump(), "overlays": overlays, ...}
        job.status = "DONE"
        job.stage = None
    except HallucinationError as e:
        job.status = "ERROR"
        job.error_message = format_hallucination_message(e)
    except Exception as e:
        job.status = "ERROR"
        job.error_message = str(e)
```

### Pattern 2: Persona as ORM + Group Pydantic Models (D-05)

**What:** One SQLAlchemy table; four JSON columns each validated by a distinct Pydantic model. The full `PersonaCreate`/`PersonaRead` request/response schemas are composites.

```python
# backend/models/persona.py  [ILLUSTRATIVE]
from sqlalchemy import Column, String, DateTime, JSON
from pydantic import BaseModel, Field

class DemographicsModel(BaseModel):
    age: int = Field(ge=0, le=120)
    role: str = Field(min_length=1, max_length=80)
    background: str | None = Field(default=None, max_length=500)

class PsychographicsModel(BaseModel):
    goals: list[str]
    values: list[str]
    motivations: list[str]

class CognitiveStateModel(BaseModel):
    attention_span: Literal["short", "medium", "long"]
    stress_level: Literal["low", "moderate", "high"]
    tech_literacy: Literal["novice", "intermediate", "expert"]

class EnvironmentModel(BaseModel):
    device: Literal["mobile", "tablet", "desktop"]
    location: Literal["commute", "home", "office", "store", "other"]
    ambient: str | None

class Persona(Base):
    __tablename__ = "personas"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    demographics = Column(JSON, nullable=False)       # DemographicsModel.dump
    psychographics = Column(JSON, nullable=False)
    cognitive_state = Column(JSON, nullable=False)
    environment = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)
```

### Pattern 3: Content Upload — Three Entrypoints, One Endpoint

`POST /content` must accept either multipart (for `ui_screens` / `static`) or JSON (for `text`). The clean FastAPI idiom is **separate endpoints keyed by type**, *not* a branching endpoint — but since D-07 locks "one endpoint", use multiple route functions mounted under the same path:

```python
# backend/routers/content.py  [ILLUSTRATIVE]
@router.post("/content", response_model=ContentCreated)
async def create_text_content(payload: TextContentRequest) -> ContentCreated:
    """JSON body path — CONT-03."""
    # ... validate, persist, return content_id ...

@router.post("/content/screens", response_model=ContentCreated)
async def create_ui_screens(files: list[UploadFile] = File(...)) -> ContentCreated:
    """Multipart path — CONT-01 (1–5 images)."""
    if not 1 <= len(files) <= 5:
        raise HTTPException(400, "ui_screens requires 1–5 images")
    # ... MIME sniff, Pillow resize, save under uploads/{content_id}/screen_{n}.jpg ...

@router.post("/content/static", response_model=ContentCreated)
async def create_static_content(file: UploadFile = File(...)) -> ContentCreated:
    """Multipart path — CONT-02 (single image)."""
    # ... same pipeline, save as image.jpg ...
```

If D-07's "single endpoint" reading is strict, use `POST /content` with a `type` form field and branch inside — but the three-sub-endpoint approach matches FastAPI multipart semantics cleanly. **Recommend deferring to planner: `POST /content/text`, `POST /content/screens`, `POST /content/static` reads more cleanly in OpenAPI than a single overloaded endpoint.** Flag for plan_check.

### Pattern 4: Pillow Processing Pipeline (D-09)

[CITED: pillow.readthedocs.io/en/stable/handbook/concepts.html — LANCZOS for downscale]

```python
# backend/services/content_processing.py  [ILLUSTRATIVE]
from io import BytesIO
from pathlib import Path
import magic
from PIL import Image, ImageOps

ALLOWED_MIMES = frozenset({"image/png", "image/jpeg", "image/webp"})
MAX_INPUT_BYTES = 5 * 1024 * 1024
LONGEST_EDGE = 1024
JPEG_QUALITY = 85

class ImageValidationError(ValueError): ...

def process_upload(raw: bytes, out_path: Path) -> dict:
    if len(raw) > MAX_INPUT_BYTES:
        raise ImageValidationError(f"image > 5MB ({len(raw)} bytes)")
    detected = magic.from_buffer(raw[:2048], mime=True)
    if detected not in ALLOWED_MIMES:
        raise ImageValidationError(f"unsupported MIME {detected}")
    with Image.open(BytesIO(raw)) as im:
        im = ImageOps.exif_transpose(im)        # apply orientation BEFORE stripping
        im = im.convert("RGB")                   # drop alpha / palette — JPEG can't store alpha
        im.thumbnail((LONGEST_EDGE, LONGEST_EDGE), Image.Resampling.LANCZOS)
        # strip EXIF: save without exif kwarg
        out_path.parent.mkdir(parents=True, exist_ok=True)
        im.save(out_path, format="JPEG", quality=JPEG_QUALITY, optimize=True)
    return {"width": im.width, "height": im.height, "bytes": out_path.stat().st_size}
```

**Memory:** A 5 MB JPEG at max ~8000×6000 px decompresses to ~144 MB as RGB bitmap. For 5 concurrent uploads that's ~720 MB peak — acceptable on any dev machine but worth documenting. `Image.open` is lazy; `im.convert` is where the decode lands. Keep the `with` block tight so GC can reclaim.

**Sync-in-POST is fine** (D-09) because the full pipeline on a 1024×1024 image after decode is < 200 ms per screen; 5 screens ≈ 1 s total. Still inside FastAPI's acceptable request-handler budget. The alternative — offload to the GPU worker — adds queueing latency for what is synchronous CPU work the worker doesn't need to do.

### Pattern 5: MIME Sniffing — python-magic on First 2KB

[CITED: python-magic PyPI + security guide WebSearch]

Do NOT trust `UploadFile.content_type`. The first 2KB of the upload is sufficient for libmagic to identify every image format we care about. After Pillow decode succeeds, we have a second layer of validation (malformed bytes fail `Image.open`). Keep both layers — defense in depth is cheap here.

### Pattern 6: Alembic Batch Mode for SQLite FK Additions

[CITED: alembic.sqlalchemy.org/en/latest/batch.html]

SQLite can't `ALTER TABLE ADD FOREIGN KEY` directly. `op.batch_alter_table()` handles the copy-rename dance. Critical: turn off `PRAGMA foreign_keys` during batch ops or parent table drops fail.

```python
# alembic/versions/003_job_fks.py  [ILLUSTRATIVE]
def upgrade() -> None:
    op.execute("PRAGMA foreign_keys=OFF")
    with op.batch_alter_table("jobs") as batch:
        batch.add_column(sa.Column("persona_id", sa.String(), nullable=True))
        batch.add_column(sa.Column("content_id", sa.String(), nullable=True))
        batch.create_foreign_key("fk_jobs_persona", "personas", ["persona_id"], ["id"])
        batch.create_foreign_key("fk_jobs_content", "contents", ["content_id"], ["id"])
    op.execute("PRAGMA foreign_keys=ON")
```

Nullable=True is required: existing Phase 1 `/test-inference` rows have no persona/content (D-12).

### Anti-Patterns to Avoid

- **Do not call DeepSeek inside the FastAPI request handler for `/analyze`.** That endpoint must return PENDING in < 50 ms. All DeepSeek calls happen inside the GPU worker coroutine (same pattern as Phase 1 inference).
- **Do not mutate `Job.result_json` in place via SQLAlchemy default JSON column** and expect the UPDATE to fire. Default `JSON` type is not mutation-tracked. Always re-assign: `job.result_json = {**job.result_json, "simulation": ...}`. [CITED: sqlalchemy.org discussion #11050]
- **Do not re-encode the stored JPEG on VL2 call.** Pass the already-processed `uploads/{content_id}/screen_{n}.jpg` bytes directly. Re-encoding double-compresses → quality loss.
- **Do not use `detail: "high"` or OpenAI image-token tricks in DeepSeek calls.** Those are OpenAI-specific. VL2 does its own tiling.
- **Do not infer content type from filename** in the content endpoint. Always libmagic-sniff.
- **Do not let the grounding judge return prose.** Force structured output (hallucinations list + verified list). See §DeepSeek Integration → Grounding Judge.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| MIME detection | Extension-based switch | `python-magic` | Extensions lie; libmagic reads actual bytes |
| JPEG encode / resize / EXIF | PIL manual primitives | `Image.thumbnail` + `ImageOps.exif_transpose` | Handles aspect ratio, orientation, non-standard EXIF |
| OpenAI-compatible client | `httpx` direct calls | `openai.AsyncOpenAI(base_url=...)` | Retries, auth, streaming, error shapes all handled |
| JSON schema enforcement | Manual dict-walks after `json.loads` | Pydantic v2 `model_validate_json` | Gives typed output, location-of-error messages for repair prompt |
| DeepSeek mocking in tests | Monkeypatch `AsyncOpenAI` | `respx` | Mocks at the HTTP layer, survives SDK refactors |
| SQLite FK addition | Raw `ALTER TABLE` in alembic | `op.batch_alter_table()` | SQLite doesn't support bare ALTER; batch handles copy-rename |
| Multipart upload parsing | Manual boundary parsing | FastAPI `UploadFile` | Standard; handles spooling to tempfile transparently |
| Async disk I/O | `open(...).write()` in handler | `aiofiles` or `asyncio.to_thread` | Sync `write` blocks event loop |
| Overlay derivation | Another LLM call | Deterministic Python (D-15) | LLM adds ambiguity; math is exact from `events[]` |

**Key insight:** Phase 2's novelty is composition, not algorithms. Every piece of logic is a well-trodden pattern. Pitfalls cluster around DeepSeek API misunderstanding (VL2 not on cloud, no `json_schema`), SQLite migration mechanics, and JSON-mutation tracking — all of which have known workarounds documented here.

## Runtime State Inventory

Not applicable — this is a greenfield additive phase (new tables, new endpoints, extended worker). No renames, no migrations of existing data, no reuse of string identifiers in external systems. Existing Phase 1 `jobs` rows continue to work with `persona_id=NULL, content_id=NULL` (D-12).

## Common Pitfalls

### Pitfall 1: Assuming DeepSeek supports `json_schema` response format
**What goes wrong:** You write `response_format={"type": "json_schema", "json_schema": {...}}` (the OpenAI pattern). DeepSeek silently ignores the schema and returns either free-form JSON or plain text.
**Why it happens:** DeepSeek docs advertise "OpenAI-compatible" but `json_schema` is an OpenAI extension not part of the original spec.
**How to avoid:** Use `response_format={"type": "json_object"}` and validate with Pydantic v2. Inject the schema into the prompt as text, not as a structured param.
**Warning signs:** Returned JSON doesn't match schema; extra fields; missing required keys; repeated on identical retry.

### Pitfall 2: Assuming DeepSeek-VL2 is callable at `api.deepseek.com`
**What goes wrong:** You configure `AsyncOpenAI(base_url="https://api.deepseek.com", ...)` and call `model="deepseek-vl2"`. 404 or "model not found" at runtime.
**Why it happens:** DeepSeek's official cloud currently exposes `deepseek-chat` and `deepseek-reasoner`. VL2 is distributed as open weights (HuggingFace) or via third-party hosts (Replicate, DeepInfra).
**How to avoid:** Build a `VisionProvider` abstraction. Default to Replicate's `deepseek-ai/deepseek-vl2` model. Keep the DeepSeek-SDK client path only for the text/V3 branch.
**Warning signs:** 404s on `model="deepseek-vl2"`; no image field accepted by `deepseek-chat`.

### Pitfall 3: SQLite FK addition fails with `ALTER TABLE ADD FOREIGN KEY`
**What goes wrong:** Direct `op.add_column` + `op.create_foreign_key` raises OperationalError: "near FOREIGN".
**Why it happens:** SQLite doesn't support adding FK constraints via ALTER.
**How to avoid:** `op.batch_alter_table()` — creates a new table, copies data, renames. See Pattern 6.
**Warning signs:** alembic `upgrade` fails with SQL syntax error; or constraint silently not enforced.

### Pitfall 4: `Job.result_json` mutation doesn't persist
**What goes wrong:** `job.result_json["simulation"] = sim_log.model_dump(); await session.commit()` — the row is unchanged after commit.
**Why it happens:** SQLAlchemy's default `JSON` column type is not mutation-tracked; in-place dict mutations don't flag the attribute as dirty.
**How to avoid:** Always re-assign the whole dict: `job.result_json = {**(job.result_json or {}), "simulation": ...}`. Or switch the column to `MutableDict.as_mutable(JSON)` — but re-assignment is simpler.
**Warning signs:** DB shows old JSON after worker claims to have written new; test asserts pass locally on in-memory object but fail after session refresh.

### Pitfall 5: Image orientation lost or flipped after resize
**What goes wrong:** Screenshots taken on phones have EXIF orientation flags. Calling `Image.thumbnail()` without applying orientation first produces sideways output. Stripping EXIF after thumbnail loses the flag forever.
**Why it happens:** EXIF orientation is metadata, not pixel rotation. Tools that respect EXIF render correctly; raw JPEG bytes are still sideways.
**How to avoid:** `ImageOps.exif_transpose(im)` **before** thumbnail; then strip EXIF on save (no `exif=` kwarg).
**Warning signs:** Images upload correctly in browser but appear rotated in VL2 / downstream processing.

### Pitfall 6: Multipart UploadFile exhausted after first `.read()`
**What goes wrong:** Read the file once for MIME sniffing, then try to read again for Pillow → empty bytes.
**Why it happens:** `UploadFile.file` is a SpooledTemporaryFile; read positions are stateful.
**How to avoid:** Read `await file.read()` once into `raw: bytes`, pass bytes to both MIME sniff and `Image.open(BytesIO(raw))`.
**Warning signs:** Pillow raises `UnidentifiedImageError` on a valid upload when sniffing is enabled.

### Pitfall 7: libmagic missing on dev machines / CI
**What goes wrong:** `import magic` → ImportError or RuntimeError about libmagic.
**Why it happens:** python-magic is a pure-Python wrapper; libmagic itself is a system library.
**How to avoid:** Document `brew install libmagic` (macOS) / `apt-get install libmagic1` (Linux) in README. Add to CI container image if CI ever runs.
**Warning signs:** Phase 1 tests pass, Phase 2 tests fail on a fresh macOS at `import magic`.

### Pitfall 8: DeepSeek empty-content bug on JSON mode
**What goes wrong:** DeepSeek returns `choices[0].message.content = ""` intermittently.
**Why it happens:** Documented known issue per DeepSeek's own JSON-mode docs.
**How to avoid:** Treat empty content as a repair-eligible failure (same path as ValidationError). Set `max_tokens=4000+` to reduce frequency.
**Warning signs:** `SimulationLog.model_validate_json("")` ValidationError "Expecting value: line 1 column 1".

### Pitfall 9: Simulation → grounding chain blocks the worker for 30-60s
**What goes wrong:** Two sequential DeepSeek calls (sim + judge) plus a TRIBEv2 call push a single job to 90+ seconds.
**Why it happens:** VL2 on Replicate ~5s cold, simulation 10-20s, judge 5-10s, TRIBEv2 30-60s = wall-clock adds.
**How to avoid:** This is an accepted cost, not a bug. Surface stage transitions via `Job.stage` so the frontend shows progress (INFRA-03 / FE processing view deferred to Phase 4). Phase 5 300s timeout remains appropriate.
**Warning signs:** N/A — expected behavior.

### Pitfall 10: VL2 Replicate tiling degrades > 2 screens
**What goes wrong:** Replicate's VL2 docs note dynamic tiling for ≤ 2 images; 3+ images padded to 384×384.
**Why it happens:** VL2 architectural constraint.
**How to avoid:** For 3-5 screen flows, call VL2 once per screen (parallel or serial) rather than all-at-once, if differentiation suffers. Plan 02-03 should expose this as a knob.
**Warning signs:** Narrative for flows of 4-5 screens reads generic / confuses screen 3 with screen 4. Visual differentiation check: narratives for two maximally-different screens in the same flow should be distinguishable.

## Code Examples

### Pillow pipeline — full reference
See Pattern 4 above.

### DeepSeek V3 text simulation — full reference
See §DeepSeek Integration → JSON-Mode Pattern above.

### Grounding judge prompt skeleton
```python
JUDGE_SYSTEM = """
You verify whether a narrative about UI screens references only visible elements.

Output JSON matching this schema:
{
  "hallucinations": [{"screen_index": int, "narrative_claim": str, "reason": str}],
  "verified_elements": [str]
}

Rules:
- Flag claims about concrete UI elements (buttons, text, images, icons, forms) that are NOT visible.
- Do NOT flag emotional or behavioral descriptions (e.g., "user feels rushed", "pauses to think").
- If a claim is ambiguous or you're uncertain, flag it as a hallucination.
- Return empty hallucinations array only if EVERY UI-element claim is verifiable.
"""

JUDGE_USER_TMPL = """
For each screen, the simulator produced this narrative:

{per_screen_narratives}

The uploaded screens are provided as images.

Verify each UI-element claim in each screen's narrative against the corresponding image.
"""
```

### Overlay derivation algorithm sketch (D-15)
```python
# backend/services/overlay.py  [ILLUSTRATIVE]
def derive(sim_log: SimulationLog) -> list[ScreenOverlay]:
    overlays = []
    for screen in sim_log.screens:
        hesitation_events = [e for e in screen.events if e.type == "hesitation" and e.target_region]
        # Cluster events within 100px radius: simple greedy pass
        hesitation_points = cluster_and_aggregate(
            [(e.target_region.x_ratio, e.target_region.y_ratio, e.intensity, 300)  # 300ms default duration
             for e in hesitation_events],
            radius=0.1,  # ratio space
        )
        # Scroll path: take events of type "scroll", order by timestamp_ms, use target_region.y_ratio
        scroll_events = sorted([e for e in screen.events if e.type == "scroll"], key=lambda e: e.timestamp_ms)
        scroll_path = (
            [{"t_ms": e.timestamp_ms, "y_ratio": e.target_region.y_ratio} for e in scroll_events]
            if scroll_events else None
        )
        # For text/static content, scroll_path is forced to None regardless
        overlays.append(ScreenOverlay(
            screen_index=screen.screen_index,
            hesitation_points=hesitation_points,
            scroll_path=scroll_path,
        ))
    return overlays
```

The clustering algorithm:
1. Sort events by intensity descending.
2. For each event, if its centroid is within `radius` of any existing cluster, merge (sum intensities, keep centroid weighted-average). Otherwise start a new cluster.
3. Each cluster emits `{x_ratio, y_ratio, duration_ms, intensity}` where duration_ms = sum of event durations and intensity = min(1.0, sum / N) for some N chosen by experimentation (start with N=3).

This is deterministic, unit-testable, and requires no ML input.

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| OpenAI GPT-4o with `json_schema` strict mode | DeepSeek JSON mode (`json_object`) + Pydantic validate | Loses compile-time schema enforcement; gains cost + privacy; need repair-retry pattern |
| SQLAlchemy 1.4 sync + alembic | SQLAlchemy 2.0 async + alembic batch | Required for non-blocking FastAPI |
| python-magic-bin (old Windows workaround) | python-magic + libmagic1 system package | python-magic-bin last updated ~2020; use system libmagic |

**Deprecated / outdated:**
- **OpenAI-style `json_schema` on DeepSeek**: Not supported. Do not copy patterns from OpenAI structured-outputs docs directly.
- **Assuming DeepSeek-VL2 lives at `api.deepseek.com`**: It doesn't. Use Replicate / DeepInfra / self-host.
- **Celery / separate worker process**: Explicitly rejected for BrainX (PITFALLS.md). Continue with single asyncio.Queue worker.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `json_schema` on DeepSeek stays unsupported through Phase 2 build window | §DeepSeek Integration | If DeepSeek ships schema mode, we can simplify code — no breakage |
| A2 | Replicate is the most reliable VL2 host in April 2026 | §DeepSeek Integration → Route A | If Replicate flakes, abstraction allows swap to DeepInfra/OpenRouter or self-host |
| A3 | ~5s latency per VL2 call on Replicate A100 | §DeepSeek Integration → Route A (cited from Replicate page) | If latency is 15s+, 5-screen flows approach Phase 5 timeout (300s); revisit timeout |
| A4 | Pillow 11.3.x is safe to pin (12.2.0 is newer but Phase 1 env expectation unclear) | §Standard Stack | If 11.3.x conflicts with existing env, bump to 12.x — no API breaking changes documented |
| A5 | VL2 Tiny/Small variants are adequate for UI-screen descriptions; no need to bench full VL2 in Phase 2 | Implicit in D-01 | If VL2-Tiny hallucinates more, switch to VL2-Small or full VL2 — cost bump only |
| A6 | DeepSeek text/V3 `max_tokens=4000` suffices for 5-screen simulation JSON | §DeepSeek Integration | If truncation happens, bump to 8000; observable via ValidationError |
| A7 | Replicate's 3+ image 384×384 padding is acceptable quality for UI screenshots | §Common Pitfalls 10 | If visual differentiation degrades per-screen call is the fallback |
| A8 | Judge prompt can reliably classify UI-element claims vs. emotional claims | §DeepSeek Integration → Grounding | If false positives (judge flags emotional prose), relax prompt with explicit negative examples |
| A9 | Grounding zero-tolerance is the right v1 default; users can retry with clearer content | D-03 | If rejection rate > 40% in practice, allow a `min_severity` threshold in Phase 2.x |

## Open Questions

1. **Should VL2 be called once-per-screen or once-per-flow?**
   - What we know: Replicate dynamic-tiling at ≤ 2 images; padding at 3+. Per-screen costs 5x API calls; per-flow risks visual blur.
   - What's unclear: Which produces better grounding accuracy on UI flows specifically.
   - Recommendation: Default to per-flow (single call, all images) for simplicity; add per-screen flag in Plan 02-03 as a code-level toggle, not a user setting. Revisit empirically.

2. **What is the user-visible error when DeepSeek API is unreachable?**
   - D-04 says "retry once then ERROR with descriptive error_message". Should the message expose the DeepSeek error (might leak API key / internal detail) or sanitize?
   - Recommendation: Sanitize — "Simulation service temporarily unavailable. Please retry." Log the raw error server-side only.

3. **Does the grounding judge need the resized images or originals?**
   - Using the resized `uploads/{content_id}/screen_{n}.jpg` (1024 px longest edge, Q85) is cheaper and consistent with what the simulator saw.
   - Recommendation: Use the processed images. This ensures judge "sees the same thing" as simulator.

4. **Should `POST /content` be one endpoint or three sub-endpoints?**
   - D-07 reads as one endpoint; FastAPI multipart semantics favor three.
   - Recommendation: Three sub-endpoints (`/content/text`, `/content/screens`, `/content/static`). Flag for planner to confirm before implementing.

5. **What happens if persona is deleted while a job referencing it is RUNNING?**
   - Nullable FK prevents a hard error; the job completes with a dangling reference.
   - Recommendation: `ON DELETE SET NULL` on the FK. Job result is still valid (persona was captured in `result_json.simulation` context).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3.11 (conda env from Phase 1) | All phase code | ✓ (assumed from Phase 1 completion) | 3.11 | — |
| libmagic (system) | `python-magic` for MIME sniff | ✗ (not installed by Phase 1) | — | Install via `brew install libmagic` (macOS) or `apt-get install libmagic1` (Linux). Install step belongs in Plan 02-02. |
| Pillow | Image processing pipeline | Likely ✓ (Phase 1 requires it indirectly) | verify at impl time | — |
| DeepSeek API key | Simulation service | ✗ (new env var) | — | Add `DEEPSEEK_API_KEY` to `.env` and `backend/core/config.py`. Block plan 02-03 if unset (fail-fast at app startup). |
| Replicate API token | VL2 vision calls | ✗ (new env var) | — | Add `REPLICATE_API_TOKEN` to `.env`. Alternative: self-host (out of scope) |
| ffmpeg / moviepy | — (video is Phase 1, not re-needed) | ✓ from Phase 1 | — | — |
| respx | Test-only | ✗ (not installed) | — | `pip install respx==0.23.1` in dev deps |

**Missing dependencies with no fallback:**
- `DEEPSEEK_API_KEY` and `REPLICATE_API_TOKEN` — required for simulation to function. Plan 02-03 must include setup instructions + fail-fast startup check.

**Missing dependencies with fallback:**
- libmagic → install via system package manager; document in README.
- Pillow / python-magic / aiofiles / respx → standard pip install in Plan 02-02.

## Validation Architecture

Nyquist validation is **enabled** (config.json `workflow.nyquist_validation: true`). Every requirement must have an automated assertion, sampled at the per-task commit level.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 8.x + pytest-asyncio 0.24.x (already in Phase 1) |
| Config file | `pyproject.toml` (existing) — add `pytest.ini_options` entries if needed |
| Quick run command | `pytest tests/test_phase2_*.py -x -q` |
| Full suite command | `pytest -x` (Phase 1 + Phase 2 combined) |
| HTTP mocking | `respx` for all DeepSeek / Replicate calls — no real external calls in CI |
| DB isolation | per-test `tmp_path / test.db` via existing `conftest.py` fixture pattern |
| GPU isolation | existing monkeypatch of `run_tribev2_text`/`run_tribev2_video` returns constant np arrays |

### Phase Requirements → Test Map

Each requirement gets at least one unit/integration test. Per-task commit sampling = quick run passes; per-wave merge = full suite passes.

| Req ID | Behavior | Test Type | Automated Command | File (W0 if new) |
|--------|----------|-----------|-------------------|------------------|
| **PERS-01** | POST persona with demographics + psychographics persists; GET returns same fields | integration | `pytest tests/test_personas_api.py::test_create_roundtrip -x` | W0: `tests/test_personas_api.py` |
| PERS-01 (neg) | POST persona with missing required fields → 422 | integration | `pytest tests/test_personas_api.py::test_create_rejects_missing -x` | same file |
| **PERS-02** | POST persona with cognitive_state block persists; enum validation rejects invalid | integration | `pytest tests/test_personas_api.py::test_cognitive_state_persists -x` + `::test_cognitive_state_enum_reject -x` | same file |
| **PERS-03** | POST persona with environment block persists; enum validation on device/location | integration | `pytest tests/test_personas_api.py::test_environment_persists -x` | same file |
| **PERS-04** | Persona created once; referenced by two distinct analyze calls; both succeed; same persona id in both result_json | integration | `pytest tests/test_persona_reuse.py::test_persona_reused_across_jobs -x` | W0: `tests/test_persona_reuse.py` |
| PERS CRUD | GET list / GET by id / PATCH / DELETE happy paths + 404s | integration | `pytest tests/test_personas_api.py -x` (file as a whole) | same file |
| **CONT-01** | POST /content/screens with 1 image → content_id returned; file on disk; metadata row present | integration | `pytest tests/test_content_api.py::test_ui_screens_single -x` | W0: `tests/test_content_api.py` |
| CONT-01 | POST /content/screens with 5 images → all 5 files present as screen_1.jpg..screen_5.jpg | integration | `pytest tests/test_content_api.py::test_ui_screens_five -x` | same file |
| CONT-01 (neg) | POST /content/screens with 6 images → 400 | integration | `pytest tests/test_content_api.py::test_ui_screens_too_many -x` | same file |
| CONT-01 (neg) | POST /content/screens with 0 images → 400 | integration | `pytest tests/test_content_api.py::test_ui_screens_zero -x` | same file |
| **CONT-02** | POST /content/static with 1 image → image.jpg on disk | integration | `pytest tests/test_content_api.py::test_static_happy -x` | same file |
| **CONT-03** | POST /content/text with `{content_text: "…"}` → content_id + row has text inline, no disk file | integration | `pytest tests/test_content_api.py::test_text_happy -x` | same file |
| CONT (MIME) | POST /content/screens with renamed .exe bytes → 400 (python-magic detects) | integration | `pytest tests/test_content_api.py::test_mime_spoofing_rejected -x` | same file |
| CONT (size) | POST /content/screens with > 5MB JPEG → 400 | integration | `pytest tests/test_content_api.py::test_oversize_rejected -x` | same file |
| CONT (Pillow) | Upload a 3000×2000 JPEG with EXIF orientation=6; after POST, on-disk JPEG has no EXIF and longest edge ≤ 1024 | unit | `pytest tests/test_content_processing.py::test_pillow_pipeline -x` | W0: `tests/test_content_processing.py` |
| **SIM-01** | Given persona + text content + mocked DeepSeek returning schema-valid JSON → job reaches DONE; `result_json.simulation.screens[0].narrative_text` non-empty | integration | `pytest tests/test_simulation_pipeline.py::test_text_sim_happy -x` | W0: `tests/test_simulation_pipeline.py` |
| SIM-01 | Mocked DeepSeek returns invalid JSON on first call, valid on repair → job DONE; retry_count reflects repair | integration | `pytest tests/test_simulation_pipeline.py::test_repair_retry -x` | same file |
| SIM-01 | Mocked DeepSeek returns invalid JSON twice → job ERROR with error_message mentioning schema | integration | `pytest tests/test_simulation_pipeline.py::test_repair_retry_exhausted -x` | same file |
| SIM-01 (D-03) | Mocked judge returns hallucinations → job ERROR with error_message listing them, no inference called | integration | `pytest tests/test_grounding.py::test_hallucination_fails_fast -x` | W0: `tests/test_grounding.py` |
| SIM-01 (D-03) | Mocked judge returns empty hallucinations → proceeds to inference stage | integration | `pytest tests/test_grounding.py::test_clean_passes_through -x` | same file |
| SIM-01 (D-01) | UI-screens content_type → simulation service dispatches to VisionProvider (VL2 path), never to V3 | unit | `pytest tests/test_simulation_dispatch.py::test_vl2_dispatch -x` | W0: `tests/test_simulation_dispatch.py` |
| SIM-01 (D-01) | text content_type → dispatches to deepseek-chat, never VL2 | unit | `pytest tests/test_simulation_dispatch.py::test_v3_dispatch -x` | same file |
| **SIM-02** | Given a fixture simulation log with 3 hesitation + 4 scroll events on screen 0 → `overlays[0].hesitation_points` clustering is correct; `scroll_path` has 4 entries in timestamp order | unit | `pytest tests/test_overlay.py::test_hesitation_clustering -x` + `::test_scroll_path_order -x` | W0: `tests/test_overlay.py` |
| SIM-02 | Text content → `scroll_path` is None, `hesitation_points` still populated | unit | `pytest tests/test_overlay.py::test_text_no_scroll -x` | same file |
| SIM-02 | Overlay derivation is deterministic — same input produces same output across 10 runs | unit | `pytest tests/test_overlay.py::test_deterministic -x` | same file |
| **SIM-04** | After DONE, GET /jobs/{id} returns `result.simulation.screens[].narrative_text` for frontend consumption | integration | `pytest tests/test_simulation_pipeline.py::test_log_viewable -x` | same file as SIM-01 |
| **D-11 (analyze)** | POST /analyze with valid persona_id + content_id → 200 with job_id and status=PENDING; job row has both FKs populated | integration | `pytest tests/test_analyze.py::test_happy_path -x` | W0: `tests/test_analyze.py` |
| D-11 | POST /analyze with unknown persona_id → 404 | integration | `pytest tests/test_analyze.py::test_bad_persona -x` | same file |
| D-11 | POST /analyze with unknown content_id → 404 | integration | `pytest tests/test_analyze.py::test_bad_content -x` | same file |
| **D-12 (FK migration)** | Phase 1 /test-inference still produces a job with NULL persona_id and NULL content_id and reaches DONE | integration | `pytest tests/test_api.py::test_submit_and_poll_job` (EXISTING — must still pass) | — |
| **D-18..D-20 (lifecycle)** | Across a mocked happy-path job, `Job.stage` transitions through simulation → grounding_check → inference → processing → None (DONE) — observable via polling | integration | `pytest tests/test_analyze.py::test_stage_transitions -x` | same file |
| D-19 (transition helper) | `transition(job, StageEnum.X)` writes DB + logs | unit | `pytest tests/test_queue_transitions.py::test_transition_writes -x` | W0: `tests/test_queue_transitions.py` |
| D-20 (per-stage failure) | simulation-stage retry-once exercised; grounding-stage no-retry exercised; processing-stage exception fails hard — three separate tests | integration | `pytest tests/test_analyze.py::test_failure_policy_* -x` | same file |

### Sampling Rate
- **Per task commit:** `pytest tests/test_phase2_*.py -x -q` (must pass before commit merges to phase branch)
- **Per wave merge:** full `pytest -x` (Phase 1 suite + all of Phase 2)
- **Phase gate (pre `/gsd-verify-work`):** all tests green + manual smoke test of one live-DeepSeek run (flag-gated, not part of CI)

### Assertion Counts (Nyquist framing)

Requirement-to-assertion mapping follows the Phase 1 convention (each requirement gets ≥2 independent assertions to avoid single-point test fragility):

| Req | Test count | Assertion density |
|-----|------------|--------------------|
| PERS-01 | 2 (happy + negative) | shape, types, persistence round-trip |
| PERS-02 | 2 | persistence + enum reject |
| PERS-03 | 2 | persistence + enum reject |
| PERS-04 | 1 (integration) | reused persona_id appears in two job rows |
| CONT-01 | 4 | single/multi/zero/too-many |
| CONT-02 | 1 | happy path |
| CONT-03 | 1 | happy path |
| CONT-processing | 3 | MIME spoof / oversize / Pillow roundtrip |
| SIM-01 | 5 | happy / repair / exhaust / dispatch × 2 |
| SIM-02 | 3 | clustering / scroll order / determinism |
| SIM-04 | 1 | log retrievable |
| D-03 grounding | 2 | hallucinate fails, clean passes |
| D-11..D-20 | 5 | analyze happy, bad FKs × 2, transitions, failure policies |

Total Phase 2 net-new tests: ~32. Phase 1 existing tests (~15) must all continue to pass.

### Wave 0 Gaps (new test files to create before implementation)

- [ ] `tests/test_personas_api.py` — persona CRUD (PERS-01..04)
- [ ] `tests/test_persona_reuse.py` — PERS-04 reuse across jobs
- [ ] `tests/test_content_api.py` — CONT-01, CONT-02, CONT-03 + negative cases
- [ ] `tests/test_content_processing.py` — unit tests for Pillow pipeline, MIME sniff
- [ ] `tests/test_simulation_pipeline.py` — SIM-01 / SIM-04 end-to-end with respx-mocked DeepSeek
- [ ] `tests/test_simulation_dispatch.py` — D-01 content-type → model dispatch
- [ ] `tests/test_grounding.py` — D-03 judge pass/fail
- [ ] `tests/test_overlay.py` — SIM-02 deterministic overlay derivation
- [ ] `tests/test_analyze.py` — POST /analyze composition + lifecycle
- [ ] `tests/test_queue_transitions.py` — D-19 `transition()` helper

New fixtures in `tests/conftest.py`:
- `respx_mock` activation (via pytest-asyncio compatible fixture)
- `persona_fixture` — creates one persona via POST and yields its id
- `text_content_fixture`, `ui_screens_fixture`, `static_content_fixture` — content creation helpers
- `deepseek_mock_ok(respx_mock)` — routes that return valid schema-conformant JSON
- `deepseek_mock_hallucinate(respx_mock)` — routes that return narrative + judge flagging
- `sample_jpeg_bytes()`, `sample_jpeg_with_exif(orientation)` — raw bytes for upload tests

Framework install: none (pytest + pytest-asyncio already present). Only new dep: `pip install respx==0.23.1`.

## Security Domain

`security_enforcement` is not explicitly `false` in config.json, so the security section is required.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | **no** | No auth in v1 per REQUIREMENTS (single-user research preview); locked out of scope |
| V3 Session Management | no | No sessions in v1 |
| V4 Access Control | partial — object-level | No persona/content ownership checks in v1 (D-06 explicit); for v1 this is accepted risk. Document as a known limitation. |
| V5 Input Validation | **yes** | Pydantic v2 for all request bodies; python-magic for file MIME; explicit size + count bounds (D-09, D-10) |
| V6 Cryptography | partial | DeepSeek / Replicate API keys in `.env`; `.env` already gitignored in Phase 1 — verify still gitignored in Plan 02-02 |
| V10 Malicious Code | yes | Filesystem writes constrained to `uploads/{content_id}/` (content_id is server-generated UUID, not user-supplied path) — prevents path traversal |
| V12 File / Resources | **yes** | MIME sniff, size cap, image-type allowlist, decompression bomb protection (Pillow's `MAX_IMAGE_PIXELS` default is 178,956,970 — 5MB JPEG's max decoded size of ~144M pixels is just under this but a zip-bomb WEBP could hit it) |
| V14 Configuration | yes | `DEEPSEEK_API_KEY`, `REPLICATE_API_TOKEN` from env only; no secrets in code or logs; sanitize DeepSeek errors before exposing via `error_message` (Open Question 2) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| MIME spoofing (malicious file renamed to .jpg) | Spoofing / Tampering | python-magic sniff on first 2KB; Pillow decode as second layer |
| Decompression bomb (small JPEG → huge bitmap) | DoS | Pillow `Image.MAX_IMAGE_PIXELS` (default enforced); enforce 5MB pre-decode cap (D-09); wrap Pillow calls in try/except and reject `Image.DecompressionBombError` |
| Path traversal via uploaded filename | Tampering | Never use `UploadFile.filename` for disk path; use server-generated UUID content_id + fixed names (`screen_1.jpg`) |
| API-key leak via error_message | Info disclosure | Sanitize DeepSeek error strings before writing to `Job.error_message`; log raw error server-side only |
| Prompt injection via pasted text content (CONT-03) | Tampering | Low impact in v1 (no downstream tool use); document. Simulator output is still Pydantic-validated. |
| Persona data containing PII | Privacy | No auth / no ownership in v1. Out of scope but document in PROJECT.md as a known v1 limitation. |
| Job table fills (enumerate + spam POST /analyze) | DoS | Phase 5 adds 429 at queue depth ≥ 5 (deferred). Phase 2 is single-user trust model. |

### Security Test Assertions (in the Validation Architecture above)
- MIME spoofing rejection: `test_mime_spoofing_rejected` in `tests/test_content_api.py`
- Oversize rejection: `test_oversize_rejected` in `tests/test_content_api.py`
- Content count bounds: `test_ui_screens_zero` + `test_ui_screens_too_many`
- (Phase 2.x / Phase 5): decompression-bomb test, rate-limit test

## Sources

### Primary (HIGH confidence)
- `https://api-docs.deepseek.com/guides/json_mode` — DeepSeek JSON mode spec, `json_object` only, empty-content known issue
- `https://api-docs.deepseek.com/` — Base URL, auth, deepseek-chat + deepseek-reasoner model IDs
- `https://alembic.sqlalchemy.org/en/latest/batch.html` — SQLite batch migration + PRAGMA foreign_keys handling
- `https://pillow.readthedocs.io/en/stable/handbook/concepts.html` — LANCZOS filter for downscale; ImageOps.exif_transpose
- `https://fastapi.tiangolo.com/tutorial/request-files/` — UploadFile, multipart patterns
- `https://pypi.org/project/pillow/` — Pillow 12.2.0 latest, 11.3.x stable
- `https://pypi.org/project/respx/` — respx 0.23.1, httpx ≥ 0.25 compat
- Existing Phase 1 code at `backend/core/queue.py`, `backend/models/job.py`, `backend/routers/jobs.py`, `tests/conftest.py`, `tests/test_api.py`

### Secondary (MEDIUM confidence)
- `https://replicate.com/deepseek-ai/deepseek-vl2` — pricing ($0.0058/run), latency (~5s A100), tiling rules (≤ 2 dynamic, 3+ padded to 384×384)
- `https://openrouter.ai/deepseek` — verified VL2 NOT on OpenRouter as of 2026-04-14
- `https://github.com/sqlalchemy/sqlalchemy/discussions/11050` — JSON-column mutation tracking discussion
- WebSearch: python-magic best practices, FastAPI 2026 secure-upload patterns

### Tertiary (LOW confidence — needs empirical validation at implementation time)
- DeepInfra / OpenRouter VL2 availability as alternate providers (unverified April 2026)
- Per-image VL2 token cost on Replicate
- VL2 prompt-engineering reliability for judge task (D-03 zero-tolerance grounding)
- 4000-token max_tokens adequacy for 5-screen simulation JSON

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Pillow / python-magic / aiofiles / respx all verified on PyPI 2026-04-14
- DeepSeek V3 integration: HIGH — official docs confirm endpoint, auth, JSON mode
- DeepSeek VL2 integration: MEDIUM — Replicate path verified; availability across providers fluid; per-image latency/tokens need implementation-time benchmark
- Architecture patterns (SQLAlchemy, alembic batch, FastAPI multipart): HIGH
- Grounding judge prompt reliability: MEDIUM-LOW — prompt engineering requires iteration; A8 assumed
- Overlay derivation: HIGH — deterministic math, fully unit-testable
- Validation architecture: HIGH — Phase 1 precedent is strong

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (30 days) — flag for re-verification if DeepSeek V4 multimodal ships and changes the VL2 integration shape

---

## RESEARCH COMPLETE

**Phase:** 02 — Simulation Pipeline and Content Input
**Confidence:** MEDIUM-HIGH

### Key Findings
1. **DeepSeek JSON mode is `json_object` only, not `json_schema`.** Validation must happen client-side via Pydantic v2 with a single repair-retry. Schema gets injected into the prompt as text, not as a structured response_format parameter.
2. **DeepSeek-VL2 is not on DeepSeek's official cloud API.** Reach it via Replicate (`deepseek-ai/deepseek-vl2`, ~$0.006/run, ~5s on A100) or DeepInfra. Plan for a `VisionProvider` abstraction with Replicate as the v1 backend.
3. **SQLite FK addition requires `op.batch_alter_table()` with PRAGMA foreign_keys toggled off** — raw `ALTER TABLE ADD FOREIGN KEY` fails. Migration 002 (new tables) is straightforward; migration 003 (FKs on jobs) needs batch mode.
4. **Grounding judge must return structured output** (hallucinations list + verified list), not prose. Otherwise D-03's zero-tolerance gate is unreliable.
5. **`Job.result_json` mutation does not persist without re-assignment.** Always `job.result_json = {**old, "simulation": ...}`, never in-place dict mutation.
6. **Pillow pipeline order matters:** `ImageOps.exif_transpose` → `convert("RGB")` → `thumbnail(LANCZOS)` → save with `quality=85, optimize=True` and no `exif=` kwarg. Sync-in-POST is fine (< 1s for 5 screens).
7. **Phase 2 needs 10 new test files / ~32 new test functions**, all mocking DeepSeek and Replicate via respx. Existing Phase 1 tests must continue to pass unchanged (D-12 backward compatibility).

### File Created
`/Users/akashazad/Documents/BrainX/.planning/phases/02-simulation-pipeline-and-content-input/02-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | Versions verified on PyPI 2026-04-14 |
| DeepSeek V3 path | HIGH | Official docs confirm mechanics |
| DeepSeek VL2 path | MEDIUM | Replicate verified; availability on other providers is fluid; costs/latency need empirical check |
| Architecture patterns | HIGH | Phase 1 code + alembic / Pillow / FastAPI docs all align |
| Grounding prompt reliability | MEDIUM-LOW | Prompt engineering requires iteration — A8 assumed, fallback plan documented |
| Validation architecture | HIGH | Nyquist precedent from Phase 1 directly applicable |

### Open Questions (non-blocking — surface to planner)
1. VL2: per-screen vs. per-flow call strategy for 3-5 screens (documented — defer to empirical tuning in 02-03)
2. Sanitize DeepSeek error strings in `error_message` (recommended yes)
3. `POST /content` as one endpoint vs. three sub-endpoints (recommend three — flag for plan_check)
4. `ON DELETE SET NULL` on Job FKs when persona/content is deleted mid-job (recommend yes)

### Ready for Planning
Research complete. Planner has stack choices, architectural patterns, migration mechanics, DeepSeek integration specifics (including the VL2 hosting twist), overlay algorithm sketch, full Nyquist validation map (32 tests, 10 new files), and security controls. Open questions are surfaced with recommended defaults so plans can proceed without waiting on a discuss-phase follow-up.
