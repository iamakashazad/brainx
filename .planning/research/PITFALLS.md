# Pitfalls Research

**Domain:** Neuro-design / brain response analysis tool (ML-serving + GPT-4o simulation + TRIBEv2 inference + React 3D)
**Researched:** 2026-04-06
**Confidence:** HIGH (TRIBEv2 GitHub issues directly verified; PyTorch memory patterns verified; GPT-4o structured output verified via OpenAI official docs; 3D performance via official R3F docs)

---

## Critical Pitfalls

### Pitfall 1: numpy==2.2.6 Exact Pin Breaks the Install Environment

**What goes wrong:**
TRIBEv2's `pyproject.toml` hard-pins `numpy==2.2.6` with an exact equality constraint. Any package installed alongside tribev2 that requires a different numpy version (including most of the scientific Python ecosystem) will produce a dependency resolution error at install time. This is a known upstream bug — it is reported and open as GitHub issue #6 on the facebookresearch/tribev2 repository.

**Why it happens:**
The TRIBEv2 maintainers used `==` instead of `>=2.2.0,<3` when specifying the numpy constraint. This is a packaging mistake common to research code that was never hardened for library distribution. When you install tribev2 with `pip install -e .` into a fresh environment that already has nilearn, scipy, or any other numpy-dependent library, pip's solver sees a conflict and fails.

**How to avoid:**
1. Create a completely isolated conda environment (`conda create -n brainx python=3.11`) before installing anything.
2. Install PyTorch and tribev2 into that environment before adding any other packages.
3. If the exact pin causes conflicts with other required packages (e.g., nilearn requires numpy >=2.3), apply this patch manually after cloning tribev2 before running `pip install -e .`:
   - Open `tribev2/pyproject.toml`
   - Change `"numpy==2.2.6"` to `"numpy>=2.2.6,<3"`
4. Verify the patched install works: `python -c "import tribev2; print('ok')"`.

**Warning signs:**
- `pip install -e ".[plotting]"` exits with `ERROR: Cannot install tribev2 and [package] because these package versions have conflicting dependencies`
- Error message references numpy version mismatch specifically
- The error surfaces during the nilearn or scipy install step, which also require numpy

**Phase to address:** Phase 1 (Environment Setup / TRIBEv2 Integration). This is a day-one installation problem. Never discovered mid-project if the install sequence is correct.

---

### Pitfall 2: Multiple uvicorn Workers OOM the GPU

**What goes wrong:**
Running `uvicorn main:app --workers 2` (or more) causes each worker process to independently load TRIBEv2 into GPU memory. With TRIBEv2's three simultaneous encoders (LLaMA 3.2-3B, V-JEPA2, Wav2Vec-BERT) consuming ~14GB VRAM, two workers require ~28GB VRAM — more than any consumer GPU provides. The second worker's model load will OOM and crash the server. This is directly confirmed by the OOM report in TRIBEv2 GitHub issue #28, where a T4 with 14.56GB VRAM allocated 13.86GB and then failed on a 162MB allocation attempt.

**Why it happens:**
Developers follow standard uvicorn scaling advice ("add more workers for concurrency") without recognizing that GPU memory does not benefit from multi-process scaling — it suffers from it. Each process gets its own GPU memory allocation. FastAPI's `BackgroundTasks` can also accidentally trigger concurrent inference if two requests are processed by the async event loop before the first inference completes.

**How to avoid:**
- Always use `uvicorn main:app --workers 1` — exactly one worker, non-negotiable.
- Use `asyncio.Queue` with a single GPU worker coroutine to serialize all inference jobs. Never rely on FastAPI's `BackgroundTasks` for GPU work — it has no serialization guarantee.
- Set `PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True` in `.env` to reduce fragmentation within the single worker.
- Add an explicit check in startup health route: `GET /model-status` returns 503 until TRIBEv2 loads and the queue worker is running.

**Warning signs:**
- `CUDA out of memory` errors appearing immediately on the second request after server start
- `nvidia-smi` shows VRAM at 95%+ after startup before any inference has run
- Two concurrent requests both returning 500 errors immediately

**Phase to address:** Phase 1 (Backend Architecture). Establish the single-worker + asyncio.Queue pattern in the very first backend skeleton before TRIBEv2 is integrated. Do not defer queue design.

---

### Pitfall 3: TRIBEv2 Text Pathway Produces Undifferentiated Activation Maps Across Designs

**What goes wrong:**
When BrainX feeds the GPT-4o narrative through TRIBEv2's text pathway (`text_path`), the model converts text to synthetic speech via gTTS, then passes the audio through Wav2Vec-BERT for encoding. The critical weakness: gTTS produces flat, robotic prosody with identical timing patterns regardless of what the text describes. A narrative about a calm product landing page and a narrative about a high-urgency checkout flow may produce nearly identical Wav2Vec-BERT embeddings because the acoustic features of synthetic speech have no emotional valence. The V-JEPA2 video encoder (the model's strongest signal pathway) is entirely bypassed when using text input. The result: activation maps that look the same for very different designs, making BrainX's output useless as a comparative tool.

**Why it happens:**
TRIBEv2 was trained on naturalistic video+audio+text stimuli where the text was transcribed from real human-recorded speech with natural prosody, rhythm, and timing. The gTTS synthetic speech pathway exists for accessibility but is not the high-fidelity path the model was optimized for. No published benchmarks exist for TRIBEv2's text-only performance on UI description tasks — this is an unverified assumption in the original architecture proposal.

**How to avoid:**
1. **Implement the video slideshow fallback path before considering the text path validated.** Build both paths from Phase 1 so you can switch.
2. For the text path: inject emotional and kinetic markers into the GPT-4o prompt output to force prosodic variation — e.g., "!!!URGENT!!!" before high-urgency content, all-caps for emphasis, punctuation patterns that cause gTTS to vary its timing. This is a heuristic workaround, not a fix.
3. **The correct fix:** Use the video slideshow path — have GPT-4o output a structured JSON session (`[{screen: 1, duration: 3.2, focus: "headline"}, ...]`), then use moviepy to stitch screen images into a timed MP4. This sends actual visual content through V-JEPA2, which is TRIBEv2's primary encoder for design stimuli.
4. Implement a validation test during Phase 1: run TRIBEv2 on two maximally different inputs (a minimal white screen vs. a complex cluttered design) and check that the activation maps differ by more than noise. If they don't, the text path is not viable.

**Warning signs:**
- Activation scores for "attention", "cognitive_load" etc. are nearly identical (within 0.05) across different screen designs
- The 3D brain visualization shows the same activation pattern regardless of which design is analyzed
- GPT-4o narratives are descriptive but similar in tone and pacing regardless of design complexity

**Phase to address:** Phase 1 (TRIBEv2 Integration + Pipeline Validation). Build the video fallback path in the same phase as the text path. Do not ship Phase 1 without a differentiation test.

---

### Pitfall 4: GPT-4o Simulation Hallucinates Behavior That Isn't Grounded in the Screen Content

**What goes wrong:**
When prompted to simulate user behavior, GPT-4o generates plausible-sounding narratives that reference interface elements, copy, and interactions that do not appear in the uploaded screens. For example, it may describe a user "clicking the green button in the top right" on a screen where no such button exists, or describe hesitation at a form field on a screen that has no form. This hallucinates a usage session that the TRIBEv2 brain model then processes — producing activation maps based on fictional content. The downstream recommendations will then suggest changes to elements that do not exist.

**Why it happens:**
GPT-4o's vision capability can misidentify UI elements at small image sizes or when screenshots have low contrast. The model also pattern-matches to common UI patterns it has seen in training data, inserting expected elements even when they are absent. Without a structured output schema, the model fills narrative gaps with plausible details.

**How to avoid:**
1. Use OpenAI's structured outputs (`response_format={"type": "json_schema", ...}`) for the simulation call. Force the model to output a JSON array where each element references a specific screen index. This makes hallucination detectable — if `screen_index: 3` is referenced but only 2 screens were uploaded, the server can catch and reject it.
2. Include explicit instructions in the system prompt: "You may only describe what is visible in the provided screenshots. Do not invent UI elements, copy, or interactions that are not present. If uncertain, describe what you observe literally."
3. Send screen images at high enough resolution. GPT-4o's "high" detail mode tiles images into 512-pixel chunks — use `detail: "high"` in the API call for UI screenshots to reduce misidentification.
4. Implement a validation pass: after GPT-4o generates the simulation, make a second call asking "List all specific UI elements (buttons, headlines, forms) you referenced. Do all of these appear in the provided screenshots?" and check for discrepancies.
5. For the MVP, limit the simulation to what the model can reliably describe: scroll position, general visual hierarchy (top/center/bottom attention), and reading vs. skimming patterns. Avoid fine-grained interaction claims.

**Warning signs:**
- Simulation narrative mentions specific copy that doesn't match the uploaded screen
- Narrative describes multi-step interactions (drag, swipe, expand) on static screenshots
- Recommendations reference elements that don't exist in the design

**Phase to address:** Phase 2 (GPT-4o Simulation Pipeline). Build structured output schema and validation pass before TRIBEv2 integration to prevent poisoned input propagating downstream.

---

### Pitfall 5: TRIBEv2 TemporalSmoothing Layer Bug Produces Incorrect Inference Output

**What goes wrong:**
There is a confirmed bug in TRIBEv2's model code (GitHub issue #5, open as of April 2026): the `TemporalSmoothing` module in `tribev2/model.py` attempts to freeze its Gaussian kernel with `conv.requires_grad = False`, but this is a no-op in PyTorch — `nn.Module` does not have a `requires_grad` attribute in this form. The correct call is `conv.requires_grad_(False)`. As a result, the smoothing kernel remains trainable, which should not affect inference-only use of the pre-trained model (the weights are whatever they converged to during training). However, this means the temporal smoothing behavior of the pre-trained model may differ from the intended design, and the output shape and smoothness of `(n_timesteps, n_vertices)` predictions may have higher temporal noise than expected.

**Why it happens:**
The bug is in the model training code. For inference-only use (which is BrainX's case), the impact is indirect: the model's shipped weights reflect whatever the TemporalSmoothing layer learned to do with trainable gradients. The outputs are internally consistent but may be noisier than a model with a correctly frozen kernel.

**How to avoid:**
1. Apply the patch when cloning tribev2: in `tribev2/tribev2/model.py`, change `conv.requires_grad = False` to `conv.requires_grad_(False)`.
2. This patch does NOT affect inference with the pre-trained weights — the weights are already baked in. Apply it as hygiene so your local checkout reflects correct code.
3. When aggregating TRIBEv2 output, always apply temporal smoothing before extracting per-ROI statistics: use `np.mean(preds, axis=0)` rather than relying on a single timestep. This reduces noise from the imperfect smoothing layer.
4. Flag for validation: compare `np.std(preds, axis=0)` across timesteps to assess temporal noise. If standard deviation per vertex exceeds the mean activation by a large margin, the output is noise-dominated.

**Warning signs:**
- `(n_timesteps, n_vertices)` output has high variance across timesteps for the same input
- Activation maps look like static noise when visualized as animation across timesteps
- Per-ROI scores change significantly depending on which timestep is sampled

**Phase to address:** Phase 1 (TRIBEv2 Integration). Apply both patches (numpy pin + TemporalSmoothing) as part of the initial model clone setup step.

---

### Pitfall 6: Recommendations Engine Produces Generic GPT Output Uncoupled from Brain Data

**What goes wrong:**
The recommendations engine calls GPT-4o with TRIBEv2 ROI scores and asks for design recommendations. If the prompt is not tightly constrained, GPT-4o will produce generic UX writing advice ("make your CTA more action-oriented") that could apply to any design, regardless of the brain activation data. Users will recognize this as generic AI output, lose trust in the tool's scientific grounding, and disengage. This is the most trust-destroying failure mode for BrainX because it makes the entire TRIBEv2 pipeline feel like a facade.

**Why it happens:**
GPT-4o's default behavior when given any UI description is to produce improvement suggestions from its UX training data. Without explicit anchoring instructions, the model produces "helpful" advice regardless of what the actual ROI scores say. A cognitive load score of 0.81 and a score of 0.22 may produce similar recommendations if the prompt doesn't force the model to reason from the numbers.

**How to avoid:**
1. Use OpenAI's structured outputs with a rigid JSON schema for recommendations. Include fields like `evidence_roi`, `activation_score`, and `reasoning` that force the model to cite the specific ROI score behind each recommendation.
2. Prompt structure: "The following brain activation scores were measured: [ROI JSON]. For each recommendation you make, you MUST cite the specific ROI score that motivates it. Do not make recommendations for ROIs with scores below 0.4. Do not suggest changes to elements that are not present in the original content."
3. Include negative examples in the prompt: "BAD: 'Simplify your headline.' GOOD: 'Headline is processing in working memory (cognitive_load: 0.81) — shorten from 12 words to under 7 to reduce load.'"
4. For the rewrite suggestions specifically, pass the original copy text from the uploaded screens alongside the ROI data and require the model to output the exact original text and the exact replacement text, not generic guidance.
5. Implement a post-generation check: if a recommendation does not contain a number referencing an ROI score, reject it and retry with a stronger constraint prompt.

**Warning signs:**
- Recommendations are identical or near-identical across analyses of very different designs
- Recommendations use generic phrasing ("improve clarity", "reduce friction") without referencing score values
- The same recommendation appears for both high and low scores on the same ROI

**Phase to address:** Phase 3 (Recommendations Engine). This phase should include a blind evaluation test: run the same recommendations engine on two designs with opposite activation profiles (e.g., one with cognitive_load 0.9 and another with 0.2) and verify the recommendations are distinct and cite the correct scores.

---

### Pitfall 7: TRIBEv2 Only Predicts Cortical Surface — Missing Subcortical Reward/Emotion Circuits

**What goes wrong:**
The BrainX feature set includes reward circuit activation and emotional response as key differentiators. TRIBEv2's default pre-trained checkpoint (`facebook/tribev2`) predicts activation on the fsaverage5 **cortical** surface (~20,000 vertices). The subcortical structures most relevant to reward and emotion — striatum, nucleus accumbens, amygdala, hippocampus (deeper structures) — are NOT in the cortical surface mesh. GitHub issue #23 confirms this: a subcortical checkpoint with 8,808 voxels has been requested but had not been released as of April 2026.

**Why it happens:**
TRIBEv2 was trained on cortical parcellations because that is where the fMRI signal is richest and most studied. Subcortical predictions require a separate MRI analysis pipeline (volumetric, not surface-based) and a different model head. The cortical atlas includes some proxies — the cingulate cortex (motivation/conflict monitoring), insula (interoception/emotional salience), and orbitofrontal cortex (reward valuation) are cortical and ARE present. But the striatum proper (dopamine reward) is not on the cortical surface.

**How to avoid:**
1. Reframe BrainX's "reward circuits" label to use cortical proxies that are actually present: relabel as "reward-related cortex" and map to the orbitofrontal cortex and anterior cingulate (both cortical, both in fsaverage5) rather than claiming striatum activation.
2. For "emotional response", use insula and anterior cingulate activation — both cortical, both present, both well-validated as emotion-related in neuroimaging literature.
3. For "memory encoding", use hippocampal formation proxy: parahippocampal cortex is cortical and IS in fsaverage5. Note clearly in the UI that this is a cortical proxy for hippocampal memory encoding, not direct hippocampal measurement.
4. Do NOT label any output as "striatum" or "nucleus accumbens" activation — these are subcortical and not in the model's current output space.
5. Monitor the TRIBEv2 repository for release of the subcortical checkpoint (issue #23) — when released, integrate it as a Phase 2 upgrade.

**Warning signs:**
- Attempting to map vertex indices to subcortical atlas regions returns no matches
- nilearn's `fetch_atlas_destrieux()` parcellation does not include "caudate", "putamen", or "nucleus accumbens" entries when applied to fsaverage5
- Activation maps for "reward" look identical to maps for "attention" (because they are using the same cortical regions)

**Phase to address:** Phase 1 (TRIBEv2 Integration + ROI Mapping). Establish the cortical proxy labeling in the ROI aggregation module from the start. Never ship labels that are anatomically incorrect.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Use FastAPI BackgroundTasks instead of asyncio.Queue for GPU jobs | Faster to implement in Phase 1 | No serialization guarantee — two concurrent requests will race for VRAM and OOM | Never — do not ship without the queue even in MVP |
| Store activation arrays as raw JSON in SQLite | Zero additional infrastructure (no file storage) | A single TRIBEv2 output is ~20,000 floats per hemisphere per timestep — serialized JSON for 1 job can be 5-10MB, making the SQLite DB balloon rapidly | Acceptable for MVP with < 50 stored jobs; swap to file-based storage (write .npy to disk, store path in DB) before any persistent deployment |
| Skip the GPT-4o structured output schema and parse free-text recommendations | Faster prompt development | Recommendations become unparseable when GPT-4o adds explanation prose or changes structure; frontend breaks on JSON parse errors | Never — structured outputs add minimal overhead and prevent the entire class of format failures |
| Use text narrative path only without building the video fallback | Simpler pipeline, fewer dependencies on moviepy | If text-only produces poor differentiation (see Pitfall 3), there is no fallback and Phase 2 becomes a rewrite | Acceptable to ship text-only in Phase 1 IF the differentiation test passes; build fallback trigger in Phase 2 |
| Hardcode ROI-to-label mapping (e.g., vertex 4821 = "attention") | Quick to ship | Vertex indices vary between fsaverage5 resolutions and atlas versions; hardcoding breaks if TRIBEv2 updates its mesh or you switch atlases | Never — always map dynamically via nilearn atlas lookup at runtime |
| Skip model.eval() call on TRIBEv2 at startup | One less line | BatchNorm and Dropout layers behave differently in training vs. eval mode; inference output is non-deterministic without eval() | Never — always call `model.eval()` after loading |
| Inline TRIBEv2 model loading in the route handler instead of lifespan | Simpler code structure | First request takes 30-60+ seconds; all subsequent requests timeout waiting for model re-load (it would reload per request) | Never |
| Use GPT-4o for both simulation AND recommendations in a single call | Fewer API calls, lower latency | Single long call is more likely to lose simulation context by the time recommendations are generated; structured output schema conflicts across two very different tasks | Never for the recommendations — always two separate calls with purpose-built prompts |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| TRIBEv2 `from_pretrained` | Passing `"facebook/tribev2"` as a positional argument without `cache_folder` — causes the model to redownload (~10GB) on every server restart | Always specify `cache_folder="./model_cache"` and gitignore the cache directory. Add the cache path to `.env` as `MODEL_CACHE_PATH`. |
| TRIBEv2 `model.predict()` | Calling `.predict()` with `events=df` from inside the async event loop (not in a ThreadPoolExecutor) — blocks the event loop for 60-120 seconds, making all API endpoints unresponsive | Always run the blocking `.predict()` call via `await loop.run_in_executor(gpu_executor, _inference_fn)` where `gpu_executor = ThreadPoolExecutor(max_workers=1)` |
| TRIBEv2 output serialization | Attempting to JSON-serialize the raw `preds` tensor directly from GPU — raises `TypeError: Object of type Tensor is not JSON serializable` | Always call `.cpu().numpy()` on predictions before any serialization. Convert numpy arrays to Python lists with `.tolist()` for JSON. |
| GPT-4o vision API | Sending original screenshot files without resizing — a 3840x2160 Retina screenshot will cost 765+ tokens just for the image tile count and may exceed the 50MB payload limit with 5 screens | Resize all uploaded screens to max 1920px on the longest side and JPEG-compress to < 500KB each before sending to GPT-4o. Use `detail: "high"` to maintain quality for UI detail. |
| GPT-4o structured outputs | Using `response_format={"type": "json_object"}` (old API) instead of `response_format={"type": "json_schema", "json_schema": {...}}` (structured outputs) — json_object mode does NOT enforce schema; the model can still produce non-conforming JSON | Use the `json_schema` mode with an explicit schema. The OpenAI Python client v1.40+ supports this natively. Structured outputs with explicit schema hit 100% conformance vs. < 40% for earlier methods. |
| nilearn atlas lookup | Using `fetch_atlas_destrieux()` without checking that the atlas parcellation resolution matches TRIBEv2's fsaverage5 output — can produce empty ROI matches or incorrect region assignments | Always specify the fsaverage5 resolution explicitly when loading the atlas: use `nilearn.surface.load_surf_data()` with fsaverage5 mesh to confirm vertex count matches TRIBEv2 output before doing atlas lookup. |
| fsaverage5 GLTF mesh in frontend | Attempting to load the mesh at runtime from a URL that requires CORS headers — the mesh GLTF fetch fails with a CORS error if served from FastAPI without explicit CORS configuration | Serve the GLTF files from `frontend/public/meshes/` — Vite serves these as static assets with no CORS issues. Do NOT serve them from the FastAPI backend unless you add `CORSMiddleware` with explicit origin settings. |
| OpenAI API rate limits | Not implementing exponential backoff on GPT-4o calls — a single busy period causes `RateLimitError` which crashes the job and leaves it in ERROR state permanently | Use `tenacity` library with `retry` on `RateLimitError` and `APIConnectionError`. Max 3 retries with exponential backoff (1s, 2s, 4s). Any unrecoverable error should set job status to ERROR with the error message stored for display. |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Loading TRIBEv2 per-request instead of once at startup | Server takes 30-60s to respond to every request; VRAM spikes to 100% on each load and may OOM | Load in FastAPI lifespan, store on `app.state.tribe_model`, never reload | First request after server start, guaranteed |
| Uploading all 5 screens at full resolution to GPT-4o vision in a single call | GPT-4o API call takes 20-40s, costs 5,000+ tokens per analysis, and may timeout | Resize images before sending; cap at 1920px, JPEG @ 85%. Consider sending a max of 3 screens per GPT-4o call for flows > 3 screens | Any flow with 4-5 large retina screenshots |
| React Query polling at 500ms intervals for the entire 60-120s inference duration | Client generates 120-240 polling requests per job; server logs fill with GET /jobs/{id}; SQLite contention on single-file DB | Use 2500-3000ms polling interval; implement exponential backoff once stage="inference" (slowest stage) is detected | Any deployment where analysis is used more than 2-3 times simultaneously |
| Storing raw 40,000-float activation arrays as JSON in DB (20k vertices x 2 hemispheres) | SQLite file grows 10-20MB per stored job; query latency increases on history view; React receives enormous JSON payloads | Store pre-aggregated ROI stats in DB; write raw vertex arrays to `.npy` files on disk and serve separately only for 3D visualization | After ~20-30 stored analyses |
| Rebuilding Three.js BufferGeometry from scratch on every React Query update | Choppy animation during polling; 3D brain flickers as geometry is destroyed and recreated | Memoize the geometry with `useMemo`; only update the vertex color attribute when new activation data arrives, not the full geometry | Any activation update in the Results view |
| Passing activation data through React state instead of directly to Three.js attribute | Every polling update triggers a full React re-render of the 3D canvas component; frame rate drops to < 30fps | Write activation colors directly to `geometry.attributes.color.array` in `useFrame` or a `useEffect`; call `geometry.attributes.color.needsUpdate = true` instead of triggering re-render | When activation data arrives from React Query and is put into useState |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing `OPENAI_API_KEY` in the codebase or committing `.env` | API key exposure; full OpenAI billing access for anyone who finds it | Add `.env` to `.gitignore` immediately; use `python-dotenv` with `load_dotenv()` only in server code; never log env vars |
| Accepting any uploaded file as a screen image without MIME type validation | Arbitrary file uploads; potential for SSRF if the uploaded "image" is a crafted file that exploits image parsing libraries | Validate MIME type server-side using `python-magic` (or at minimum check file header bytes); accept only `image/png`, `image/jpeg`, `image/webp`; enforce 10MB per file size limit |
| Saving uploaded files to a predictable path with the original filename | Path traversal if filename contains `../`; file overwrite attacks | Always save uploaded files to a UUID-based temp directory: `/tmp/brainx/{job_id}/{uuid}.jpg`. Never use the client-provided filename in the server-side path. |
| Writing the GPT-4o simulation narrative to disk with no cleanup | Temp files accumulate indefinitely on local disk; narrative files may contain sensitive persona data | Add cleanup step in GPU worker's `finally` block: `shutil.rmtree(f"/tmp/brainx/{job_id}")` after inference completes (or errors). |
| No rate limiting on `POST /analyze` | Trivially easy to fill the asyncio.Queue with thousands of jobs, exhausting disk space with uploaded images and crashing the server | Implement a max-queue-depth check on `POST /analyze`: if `gpu_queue.qsize() >= 5`, return 429 with "Queue full — try again later". For research preview, this is sufficient protection. |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No stage-level progress indicator during the 60-120s wait | Users see a spinning loader for 2 minutes with no feedback; they assume the app is broken and refresh, cancelling the job | Return a `stage` field in the job status response: `"simulation"` → `"inference"` → `"processing"` → `"recommendations"`. Frontend shows "Simulating persona..." then "Running brain analysis..." then "Generating recommendations..." |
| Showing raw vertex indices or atlas region codes in the UI (e.g., "Left Brodmann Area 44 activation: 0.723") | Users are designers and marketers, not neuroscientists; Brodmann area numbers are meaningless to them | Map all ROI outputs to consumer-friendly labels before the frontend ever sees them: `"broca_area"` → `"Language Processing"`, `"v1"` → `"Visual Cortex"`. The mapping lives in `roi_aggregation.py`. |
| Displaying activation scores as raw floats (0.723421) | Numbers without context are not actionable; users cannot tell if 0.72 is good or bad | Convert to 0–100 scale and add qualitative labels: `< 30: Low`, `30-60: Moderate`, `60-80: High`, `> 80: Very High`. Show the number AND the label. |
| Showing the 3D brain model as the first thing users see | 3D brain is visually impressive but creates "what am I looking at?" confusion before users understand what the colors mean | Lead with the attention heatmap overlaid on the original screen (familiar), then offer the 3D brain view as an expandable "see brain activation" section. Let familiar precede novel. |
| Treating analysis errors (TRIBEv2 OOM, GPT-4o timeout) as silent failures that leave the job in RUNNING state forever | User waits indefinitely; refreshing shows "running" forever; they can never trust the tool's reliability | Add a timeout watchdog: if a job stays in RUNNING for more than 300 seconds, automatically transition to ERROR with message "Analysis timed out — the GPU may be under heavy load. Please try again." Set the timeout in `.env` as `MAX_JOB_DURATION_SECONDS`. |
| Launching without a pre-built demo / case study | Users without their own content to upload cannot evaluate the tool; researchers and portfolio viewers who find BrainX online see an empty state | The demo must be a real pre-run job stored in the DB, not a static image. Users should click "View Demo Analysis" and see the full Results view with live 3D brain and recommendations. This is load-bearing for credibility. |

---

## "Looks Done But Isn't" Checklist

- [ ] **TRIBEv2 installation:** Running `import tribev2` succeeds and `TribeModel.from_pretrained(...)` loads without error — but verify the GPU is actually being used with `print(next(model.parameters()).device)` (should print `cuda:0`, not `cpu`).
- [ ] **GPT-4o simulation:** The simulation API call returns a narrative — but verify it actually references elements from the uploaded screens, not generic UI descriptions. Run the hallucination validation check on a known input.
- [ ] **Activation maps:** TRIBEv2 returns a non-zero `(n_timesteps, n_vertices)` array — but verify the output varies meaningfully across different inputs before claiming it produces signal. Run the differentiation test with two maximally different screens.
- [ ] **ROI labeling:** The 5 circuit labels appear in the response JSON — but verify each label maps to anatomically correct cortical regions, not to whatever vertices happen to have high activation. Check nilearn atlas lookup is running, not a hardcoded index.
- [ ] **3D brain visualization:** The brain mesh renders in the browser — but verify activation colors are correctly normalized (0–1 range before colormap application) and that both hemispheres render simultaneously with correct spatial orientation (left hemisphere on the user's right, per radiological convention vs. neurological convention — pick one and document it).
- [ ] **Recommendations engine:** Structured JSON is returned — but verify each recommendation contains an explicit reference to a specific ROI score value, not generic phrasing. Run the blind evaluation test.
- [ ] **Session persistence:** Jobs appear in the history view — but verify the full analysis result (vertex arrays + ROI stats + recommendations) can be re-loaded from the DB/disk without re-running inference.
- [ ] **Demo case study:** Demo is "working" — but verify it loads within 3 seconds (it should come from DB, not trigger a new inference), and that the demo persona and content are representative of the tool's actual use case, not a trivial toy example.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| numpy exact pin breaks install environment | LOW | Patch `pyproject.toml` in the tribev2 clone: change `numpy==2.2.6` to `numpy>=2.2.6,<3`. Rebuild the environment. ~30 minutes. |
| Multiple workers OOM server | LOW | Stop server. Set `--workers 1` in uvicorn launch command. Add `asyncio.Queue` guard. ~1 hour refactor. |
| Text pathway produces undifferentiated maps (discovered post-Phase 1) | HIGH | Build the video slideshow fallback (moviepy MP4 stitching) — this is a 1-2 day implementation. Must re-run all validation tests. |
| Recommendations engine producing generic output | MEDIUM | Rewrite the recommendations prompt with structured output schema and ROI-citation requirements. Re-run blind evaluation test. ~4-8 hours. |
| Subcortical ROI labels (striatum, hippocampus) shipped as cortical mappings | HIGH | Audit all ROI labels in `roi_aggregation.py`. Rename anatomically incorrect labels to cortical proxies. Rebuild demo case study with correct labels. ~1 day. |
| TRIBEv2 TemporalSmoothing bug causing noisy output | LOW | Apply the one-line patch (`conv.requires_grad_(False)`). For already-shipped activations, re-run inference. The patch affects future training only; inference output from pre-trained weights is already baked in. |
| GPU memory leak across multiple inference runs (CUDA fragmentation) | MEDIUM | Set `PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True`. Add `torch.cuda.empty_cache()` call after each inference job in the GPU worker's `finally` block. ~1 hour. |
| GPT-4o simulation hallucinating non-existent elements | MEDIUM | Add structured output schema with element reference validation and re-run affected analyses. ~4 hours for prompt redesign + testing. |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| numpy==2.2.6 exact pin breaks install | Phase 1: Environment Setup | `python -c "import tribev2, nilearn, scipy; print('all ok')"` without version conflicts |
| Multiple uvicorn workers OOM GPU | Phase 1: Backend Architecture | Integration test: send 3 concurrent POST /analyze requests; all should queue, not OOM |
| TRIBEv2 text pathway undifferentiated maps | Phase 1: TRIBEv2 Integration Validation | Run activation differentiation test on 2 maximally different inputs; maps must differ by > 20% in mean activation |
| GPT-4o simulation hallucination | Phase 2: GPT-4o Simulation Pipeline | Hallucination check: run simulation on a known screen and verify all referenced UI elements are present in the image |
| TemporalSmoothing layer bug | Phase 1: TRIBEv2 Clone & Patch | Confirm both patches applied; `grep -n "requires_grad_" tribev2/tribev2/model.py` returns the correct call |
| Recommendations engine generic output | Phase 3: Recommendations Engine | Blind evaluation: two opposite activation profiles produce demonstrably different recommendations, each citing specific ROI scores |
| TRIBEv2 missing subcortical structures | Phase 1: ROI Mapping Design | All 5 circuit labels (`attention`, `cognitive_load`, `emotional_response`, `memory_encoding`, `reward_circuits`) resolve to cortical regions in nilearn atlas lookup; no subcortical labels claimed |
| Activation serialization (GPU tensor not serializable) | Phase 1: TRIBEv2 Integration | Inference returns valid JSON without `TypeError` for any valid text input |
| GPT-4o image token cost overrun | Phase 2: GPT-4o Simulation Pipeline | Cost log per analysis < $0.15; confirm with 5-screen test run using production-size images |
| 3D vertex color update triggering re-render | Phase 4: Frontend 3D Visualization | Chrome DevTools Performance panel shows no re-renders triggered by activation data updates; only attribute buffer updates |
| Missing stage-level progress during wait | Phase 2: Job Status API | All 4 stage transitions (simulation / inference / processing / recommendations) appear in frontend polling while a job runs |
| Subcortical labels in production UI | Phase 3: ROI Labeling + UI | UI shows zero Brodmann area codes or anatomical jargon; all labels pass a "would a non-neuroscientist understand this?" review |

---

## Sources

- TRIBEv2 GitHub Issue #6 — numpy hard-pin bug: [https://github.com/facebookresearch/tribev2/issues/6](https://github.com/facebookresearch/tribev2/issues/6) — HIGH confidence (official repo, open issue)
- TRIBEv2 GitHub Issue #5 — TemporalSmoothing requires_grad_ bug: [https://github.com/facebookresearch/tribev2/issues/5](https://github.com/facebookresearch/tribev2/issues/5) — HIGH confidence (official repo, open issue)
- TRIBEv2 GitHub Issue #28 — OOM on T4 GPU (14.56GB): [https://github.com/facebookresearch/tribev2/issues/28](https://github.com/facebookresearch/tribev2/issues/28) — HIGH confidence (confirmed OOM data)
- TRIBEv2 GitHub Issue #23 — Subcortical checkpoint not yet released: [https://github.com/facebookresearch/tribev2/issues/23](https://github.com/facebookresearch/tribev2/issues/23) — HIGH confidence (official repo, open feature request)
- FastAPI GitHub Issue #2425 — Multiple workers linearly multiply GPU RAM: [https://github.com/fastapi/fastapi/issues/2425](https://github.com/fastapi/fastapi/issues/2425) — HIGH confidence (official FastAPI repo)
- PyTorch Forums — GPU memory leak during inference: [https://discuss.pytorch.org/t/memory-leak-during-gpu-inference/149184](https://discuss.pytorch.org/t/memory-leak-during-gpu-inference/149184) — MEDIUM confidence
- React Three Fiber scaling performance docs: [https://r3f.docs.pmnd.rs/advanced/scaling-performance](https://r3f.docs.pmnd.rs/advanced/scaling-performance) — HIGH confidence (official R3F docs)
- OpenAI structured outputs announcement — 100% schema conformance: [https://openai.com/index/introducing-structured-outputs-in-the-api/](https://openai.com/index/introducing-structured-outputs-in-the-api/) — HIGH confidence (official OpenAI)
- OpenAI API pricing for GPT-4o vision: [https://platform.openai.com/docs/pricing](https://platform.openai.com/docs/pricing) — HIGH confidence (official)
- Frontiers in AI — GPT-4o structured data generation accuracy: [https://www.frontiersin.org/journals/artificial-intelligence/articles/10.3389/frai.2025.1558938/full](https://www.frontiersin.org/journals/artificial-intelligence/articles/10.3389/frai.2025.1558938/full) — MEDIUM confidence (peer-reviewed 2025)
- Lakera — LLM hallucination rates and mitigation (2026): [https://www.lakera.ai/blog/guide-to-hallucinations-in-large-language-models](https://www.lakera.ai/blog/guide-to-hallucinations-in-large-language-models) — MEDIUM confidence
- Three.js performance optimization guide (2025): [https://tympanus.net/codrops/2025/02/11/building-efficient-three-js-scenes-optimize-performance-while-maintaining-quality/](https://tympanus.net/codrops/2025/02/11/building-efficient-three-js-scenes-optimize-performance-while-maintaining-quality/) — MEDIUM confidence
- Frontiers in Neuroergonomics — neuromarketing fMRI validity review (2025): [https://www.frontiersin.org/journals/neuroergonomics/articles/10.3389/fnrgo.2025.1542847/full](https://www.frontiersin.org/journals/neuroergonomics/articles/10.3389/fnrgo.2025.1542847/full) — MEDIUM confidence

---
*Pitfalls research for: BrainX — neuro-design / brain response analysis tool*
*Researched: 2026-04-06*
