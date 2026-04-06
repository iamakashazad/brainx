# Feature Research

**Domain:** Brain response analysis / neuro-design / content testing tool
**Researched:** 2026-04-06
**Confidence:** MEDIUM-HIGH (core competitor features verified via official sources; some nuanced claims from secondary sources)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that users assume exist. Missing these = product feels broken or untrustworthy compared to direct competitors.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Attention heatmap overlay | Every competitor (Neurons, EyeQuant, Brainsight, Attention Insight) provides this. It is the visual language of the domain. | LOW | Standard warm-to-cold color mapping over the uploaded content. Without it, the output feels abstract and unvalidatable. |
| Per-screen brain metric scores | Neurons AI delivers 4 distinct scores (Focus, Cognitive Demand, Engagement, Memory). Brainsight delivers Clarity and Attention scores. Users expect named, bounded numbers they can compare and share. | LOW | 0–100 range with named dimensions. Anchors interpretation so users don't have to read raw activation maps. |
| Side-by-side variant comparison | EyeQuant specifically markets this as a top feature (9.6 score on G2). Users expect to test version A vs version B before shipping. | MEDIUM | Requires storing at least 2 runs against the same persona and enabling diff views. |
| Actionable copy/design recommendations | Neurons AI, Brainsight, and alpha.one all produce text recommendations automatically. Users expect specific suggestions, not just heatmap stares. | MEDIUM | The recommendations engine is already a planned BrainX component — it must be present at launch. Generic "improve this area" output is not acceptable; recommendations must be element-level. |
| Content upload (image/screenshot) | Every competitor accepts static image upload. It is the minimum viable input path. | LOW | JPEG/PNG drag-and-drop. File size limits acceptable. |
| Session persistence / history | Users expect to return to past analyses. All SaaS tools in this space maintain a project/session history. | LOW-MEDIUM | Sessions list with persona + content thumbnails + date. Stateless tool feels like a toy. |
| Results that load in under 60 seconds | Brainsight advertises under 60 seconds. EyeQuant is near-instant. Neurons AI is fast. If BrainX takes 5+ minutes, users will not trust the pipeline even if output quality is higher. | N/A — infrastructure concern | Local GPU inference makes this achievable; GPT-4o simulation adds latency. Expectation-setting UI is critical. |
| Demo / example output | Every competitor has case studies or sample analyses. New users who don't upload content need a reference frame to understand what the tool produces. | LOW | Pre-built case study demo is already planned. This is correctness confirmation. |

---

### Differentiators (Competitive Advantage)

Features that no competitor offers, or that competitors do significantly worse. These are where BrainX wins.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Real-world persona + context simulation before brain analysis | No competitor simulates context. They run static images through AI models. BrainX runs GPT-4o to simulate how a specific person (distracted, commuting, low attention) actually navigates the content before running TRIBEv2 — meaning the brain model sees a realistic usage session, not an idealized screenshot. This is a genuine capability gap. | HIGH | Core pipeline differentiator. GPT-4o simulation must produce a structured session log (scroll behavior, fixation targets, hesitation points) that TRIBEv2 can consume. |
| Cognitive state as a persona variable | Competitors allow demographic inputs but none expose cognitive state parameters (stress level, attention span, time pressure, tech literacy, ambient noise). This collapses the difference between "did this ad work?" and "did this ad work on a tired parent in a grocery store?" | MEDIUM | Persona builder must expose: stress level (low/medium/high), attention span (focused/scattered), time pressure (none/moderate/urgent), environment (desk/commuting/in-store), device type. |
| Full neurological dimension coverage | Neurons AI covers Focus, Cognitive Demand, Engagement, Memory. EyeQuant covers attention and clarity. No tool outside of lab-grade fMRI research tools maps all five circuits: attention, cognitive load, emotional response, memory encoding, AND reward circuits. The reward circuit output (will this CTA hit dopamine-relevant circuits, or will it be ignored?) is novel in a design tool context. | HIGH | Requires TRIBEv2 ROI selection across attention networks, working memory, limbic, hippocampal, and striatum/reward. Output must be labeled in human language, not Brodmann area numbers. |
| Flow-level brain response (multi-screen) | Every competitor analyzes a single image. BrainX analyzes a 1–5 screen flow as a continuous experience. This enables tracking where emotional engagement drops across a funnel, which screens are creating cognitive load carryover, and whether a CTA lands better after a low-load or high-load screen. No competitor does this at all. | HIGH | Multi-screen session stitching with temporal continuity in the simulation is required. This is the hardest feature and also the strongest differentiator. |
| 3D brain visualization of activation maps | Standard competitors show heatmaps on top of the content. BrainX shows activation on a 3D brain model overlaid alongside the content view. This is a credibility signal and a comprehension aid — it makes the neuroscience legible. It is also visually distinctive for demos and portfolio use. | MEDIUM | Three.js or WebGL-based brain model with color-mapped activation zones per circuit. Must be navigable but not overwhelming. |
| Specific rewrite suggestions for copy elements | Neurons AI gives optimization direction. BrainX must produce actual replacement copy: "Change 'Buy Now' to 'Claim Your Offer'" with neuroscience rationale. This requires the recommendations engine to chain TRIBEv2 output through GPT-4o for copy generation — a two-stage pipeline no competitor has publicly productized. | HIGH | Must be grounded in the specific activation map output. Recommendations that read as generic GPT hallucinations will destroy trust. Requires tight coupling between TRIBEv2 circuit outputs and the prompt engineering for copy rewriting. |
| Memory encoding prediction per screen | Neurons AI has a Memory Score but it is image-level only. BrainX can produce screen-level memory encoding predictions based on hippocampal activation patterns from TRIBEv2. This answers: "Will users remember this onboarding screen tomorrow?" No competitor surfaces this at flow level. | MEDIUM | Depends on correct ROI labeling of hippocampal circuits in TRIBEv2 output. |
| Non-commercial research framing / free access | Every competitor is paywalled. Neurons AI, EyeQuant, Attention Insight, and Brainsight all require subscriptions. BrainX launches free (non-commercial license constraint, but also a positioning advantage). Free access + scientific framing (TRIBEv2, fMRI grounding) creates a credibility moat in the research and design community before commercial launch. | LOW — policy decision, not technical | This is a distribution differentiator, not a feature. But it shapes what the tool must be: polished enough to be demo-able, not so production-complete that a paid tier is immediately expected. |

---

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem appealing but should be deliberately excluded from v1 — and in some cases, avoided permanently.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real user panel testing | "Validate the AI with real humans" — sounds rigorous. Competitors like Lumen Research use actual eye-tracking panels at scale. | Panel recruitment, consent, compensation, data privacy, and scheduling turns this into a research ops problem. BrainX is a simulation tool, not a panel tool. Mixing the two blurs the value proposition. | Position BrainX output as a pre-research filter: use it to narrow 10 variants to 2, then validate those 2 with real users through a separate tool. Frame simulation and validation as sequential, not competing. |
| Video content analysis | Video is a natural extension — "analyze my ad video" — and competitors like Neurons AI and Realeyes support it. | Video input multiplies pipeline complexity by at least 5x: frame extraction, temporal continuity modeling, audio track handling, session simulation across a moving sequence. TRIBEv2 supports video but the simulation layer is not designed for it in v1. | Defer to v2 explicitly. This is already in the PROJECT.md out-of-scope list. Make it a visible roadmap item to manage expectations. |
| Multiple simultaneous personas | "Show me how three different personas experience this design" — highly desirable for enterprise users. | N-persona runs require N simulation calls + N inference jobs. With local GPU inference, this is a sequential queue, not parallel. The UI complexity of displaying 3 activation maps and 3 recommendation sets simultaneously is also high. | Run personas sequentially and allow comparison after each completes. Make "add persona" an explicit v1.x feature trigger, not a v1 capability. |
| Integration with Figma / Adobe XD as live plugin | Designers want analysis in-context inside their design tool. Neurons AI already has a Figma plugin. | Figma plugin development adds an entirely separate engineering surface: OAuth, Figma API versioning, plugin store review cycles, iframe constraints. It splits focus from core pipeline work. | Launch as a standalone web tool. Provide Figma-friendly exports (PNG of heatmap overlays, PDF report). Plugin is a v2 distribution play once the core is validated. |
| Real-time analysis as you design | "Analyze the design as I edit" — continuous feedback loop. | Real-time requires either a persistent connection and incremental processing, or aggressive debounce logic. TRIBEv2 inference is not sub-second. GPT-4o simulation adds further latency. Continuous analysis of intermediate states will produce noise, not signal. | Batch analysis model: explicit "Run Analysis" invocation. This is how all current competitors work. |
| Team collaboration / sharing | Multiple stakeholders reviewing the same analysis together. Every SaaS tool eventually adds this. | Real-time collaboration requires auth, user management, role permissions, shared session state, notifications. This is infrastructure work that delays shipping core ML value. | Single-user tool for v1. Add shareable read-only report URLs in v1.x as the first collaboration primitive — it is high-value, low-complexity. |
| Custom brain model fine-tuning | "Let me fine-tune TRIBEv2 on my brand's specific user data" — plausible enterprise feature. | This is MLOps at a level of complexity that requires GPU infrastructure, training pipelines, versioning, and validation. TRIBEv2 fine-tuning for commercial use also bumps into the non-commercial license ceiling. | The interpretation/recommendation layer is the customization surface in v1. Let users configure persona depth, not model weights. |
| Score benchmarking vs. industry averages | "How does my design compare to the average landing page?" — Brainsight and Neurons AI both offer benchmarks. | Meaningful benchmarking requires a corpus of analyzed content and statistical normalization. Without this corpus, benchmarks are fabricated. Building the corpus requires usage at scale before the benchmark means anything. | Ship raw scores in v1. Build benchmark corpus post-launch as real analyses accumulate. Add comparative percentiles in v1.x when the data exists. |

---

## Feature Dependencies

```
[Persona Builder]
    └──required by──> [AI Simulation (GPT-4o)]
                          └──required by──> [TRIBEv2 Inference]
                                                └──required by──> [Brain Activation Maps]
                                                                      └──required by──> [Recommendations Engine]
                                                                      └──required by──> [3D Brain Visualization]
                                                                      └──required by──> [Per-Screen Metric Scores]

[Content Upload]
    └──required by──> [AI Simulation (GPT-4o)]

[Session Persistence]
    └──enhances──> [Variant Comparison]

[Variant Comparison]
    └──requires──> [Session Persistence] (need at least 2 stored runs)

[Multi-Screen Flow]
    └──requires──> [AI Simulation] (simulation must span N screens, not analyze independently)
    └──enhances──> [Recommendations Engine] (flow-level context improves recommendation relevance)

[Specific Copy Rewrites]
    └──requires──> [Recommendations Engine]
    └──requires──> [Brain Activation Maps]
    └──enhances by──> [GPT-4o second pass] (rewrites are generated from activation map + original copy)

[Demo / Case Study]
    └──requires──> [All core pipeline components] (demo is a pre-run session, not a mock)

[Shareable Report URL]
    └──requires──> [Session Persistence]
    └──conflicts with──> [Local GPU only] (reports must be served from somewhere accessible)
```

### Dependency Notes

- **Persona Builder requires before AI Simulation:** The simulation is conditioned entirely on the persona definition. A persona-less simulation is just GPT-4o describing generic user behavior — it loses the core differentiator.
- **Content Upload requires before AI Simulation:** GPT-4o needs the actual content to simulate realistic interaction. Upload must complete and be associated with the persona before simulation starts.
- **AI Simulation requires before TRIBEv2:** TRIBEv2 must receive the simulated session output, not the raw uploaded image. This is the non-negotiable architectural constraint that separates BrainX from all competitors.
- **Multi-Screen Flow requires complete simulation span:** Each screen in the flow must be part of the same GPT-4o simulation run — not 5 independent runs. Otherwise temporal continuity (cognitive load carryover, attention fatigue) is lost.
- **Specific Copy Rewrites require grounded activation data:** Copy rewrite generation must be a second GPT-4o call that receives the TRIBEv2 output as context alongside the original copy. Generic GPT rewrites without the activation data are an anti-feature.
- **Shareable Report URL conflicts with local-GPU-only v1:** If results are stored only on the local machine, they cannot be shared. This forces a decision point in v1.x: cloud result storage for sharing vs. export-to-PDF as the share mechanism.

---

## MVP Definition

### Launch With (v1)

Minimum viable product — validates the unique pipeline and produces credible, sharable output.

- [ ] **Persona Builder** — The differentiating variable. Without cognitive state parameters, BrainX is just another heatmap tool.
- [ ] **Content Upload (image/screenshot)** — Required input path. 1–5 screens in a flow.
- [ ] **AI Simulation (GPT-4o)** — Core architectural differentiator. Must produce a structured session log, not a narrative.
- [ ] **TRIBEv2 Inference on local GPU** — The brain model. Without it, there is no product.
- [ ] **Brain Activation Maps (5 circuits)** — Attention, cognitive load, emotional response, memory encoding, reward circuits. All five must be present for the neuroscience framing to hold.
- [ ] **Per-Screen Metric Scores** — Named, 0–100 scores per circuit per screen. Makes activation maps legible.
- [ ] **Attention Heatmap Overlay** — Table stakes. Users need to see the familiar heatmap alongside the novel brain view.
- [ ] **3D Brain Visualization** — The visual credential. Makes the tool distinctive and demo-able.
- [ ] **Recommendations Engine** — Element-level copy and design suggestions grounded in activation output. Must be specific.
- [ ] **Specific Rewrite Suggestions** — Button labels, headlines, microcopy. The closest thing to immediate value delivery.
- [ ] **Session Persistence** — Users must be able to return to past analyses. Stateless tool will not be taken seriously.
- [ ] **Demo / Case Study** — Pre-run analysis for portfolio/research preview. Zero-friction way to show the tool without requiring a user upload.

### Add After Validation (v1.x)

Features to add once the core pipeline is working and users are engaging.

- [ ] **Variant Comparison (A/B view)** — Add once session persistence is stable. Trigger: users are manually screenshotting results to compare, or asking for it in feedback.
- [ ] **Shareable Read-Only Report URL** — High value, low complexity relative to full collaboration. Trigger: users are trying to share results with stakeholders by exporting PDFs.
- [ ] **Score Benchmarking vs. accumulated corpus** — Add once enough analyses have been run to make benchmarks statistically meaningful. Trigger: 500+ analyses stored.
- [ ] **Multiple Personas (sequential runs)** — Add UI to queue multiple persona runs on the same content. Trigger: users running the same content multiple times manually with different personas.

### Future Consideration (v2+)

Features to defer until product-market fit is established and the non-commercial TRIBEv2 license constraint is resolved.

- [ ] **Video Content Analysis** — Deferred due to pipeline complexity (frame extraction, temporal simulation across motion). Requires commercial brain model.
- [ ] **Figma Plugin** — Distribution channel, not core value. Build after web tool is validated.
- [ ] **Team Collaboration** — Auth, permissions, shared state. Full SaaS feature set for post-commercial launch.
- [ ] **Custom Persona Templates Library** — Predefined personas (e.g., "Millennial Mom, in-store shopping") for faster setup. Low complexity but low priority vs. pipeline stability.
- [ ] **API Access** — Brainsight offers a predictive attention API. BrainX could offer a creative scoring API post-commercial launch. Requires cloud inference infrastructure.
- [ ] **Commercial Brain Model Swap** — When TRIBEv2 is replaced with a commercially licensable model, all paywalled features (billing, team tier, API) become viable.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Persona Builder (demographics + cognitive state) | HIGH | MEDIUM | P1 |
| Content Upload (1–5 screens) | HIGH | LOW | P1 |
| AI Simulation via GPT-4o | HIGH | HIGH | P1 |
| TRIBEv2 Inference (local GPU) | HIGH | HIGH | P1 |
| Brain Activation Maps (5 circuits) | HIGH | HIGH | P1 |
| Attention Heatmap Overlay | HIGH | LOW | P1 |
| Per-Screen Metric Scores | HIGH | LOW | P1 |
| 3D Brain Visualization | MEDIUM | MEDIUM | P1 (demo credential) |
| Recommendations Engine | HIGH | MEDIUM | P1 |
| Specific Copy Rewrite Suggestions | HIGH | MEDIUM | P1 |
| Session Persistence | MEDIUM | MEDIUM | P1 |
| Demo / Case Study | HIGH | LOW | P1 |
| Variant Comparison (A/B) | MEDIUM | MEDIUM | P2 |
| Shareable Report URL | MEDIUM | LOW-MEDIUM | P2 |
| Score Benchmarking | LOW | HIGH | P3 |
| Multiple Personas (sequential) | MEDIUM | LOW | P2 |
| Video Analysis | HIGH (future) | HIGH | P3 |
| Figma Plugin | MEDIUM | HIGH | P3 |
| Team Collaboration | MEDIUM | HIGH | P3 |
| Real User Panel Integration | LOW | VERY HIGH | Never (v1) |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | Neurons AI | EyeQuant | Attention Insight | Brainsight | BrainX Approach |
|---------|------------|----------|-------------------|------------|-----------------|
| Attention heatmap | Yes (AI-predicted) | Yes (AI-predicted) | Yes (AI-predicted, 90–94% accuracy) | Yes (94% accurate) | Yes — heatmap PLUS 3D brain activation view |
| Cognitive demand / load | Yes (score + heatmap) | Partial (clarity score) | No | Yes (clarity score) | Yes — dedicated cognitive load circuit from TRIBEv2 |
| Emotional response | Yes (Engagement score) | No | No | No | Yes — limbic activation from TRIBEv2 |
| Memory encoding | Yes (Memory score) | No | No | No | Yes — hippocampal activation from TRIBEv2 |
| Reward / CTA prediction | No | No | No | No | Yes — striatum/reward circuit unique to BrainX |
| Persona / context simulation | No | No | No | No | Yes — core differentiator |
| Cognitive state variables | No | No | No | No | Yes — stress, attention span, environment |
| Multi-screen flow analysis | No (single image) | No (single image) | No (single image) | No (single image) | Yes — 1–5 screen flow with temporal continuity |
| Copy rewrite suggestions | Yes (generic) | No | No | Yes (generic) | Yes — grounded in activation map data |
| 3D brain visualization | No | No | No | No | Yes — Three.js brain model |
| Figma plugin | Yes | No | Yes (Adobe Express) | No | No (v2) |
| Benchmarking | No | No | No | Yes | No (v1.x after corpus) |
| Video analysis | Yes | Yes | No | Yes | No (v2) |
| Free access | No (subscription) | No (subscription) | No (subscription) | No (subscription) | Yes (non-commercial research preview) |
| A/B variant comparison | Yes | Yes (core feature) | Yes | Yes | v1.x |
| API access | Yes | Yes | Yes | Yes | No (v2+) |

---

## Sources

- Neurons AI metrics and explanations: [https://knowledge.neuronsinc.com/neurons-ai-metrics-and-explanations](https://knowledge.neuronsinc.com/neurons-ai-metrics-and-explanations) — HIGH confidence (official docs)
- Neurons AI heatmaps and interpretation: [https://knowledge.neuronsinc.com/neurons-ai-heatmaps-and-interpretation](https://knowledge.neuronsinc.com/neurons-ai-heatmaps-and-interpretation) — HIGH confidence
- Neurons neuromarketing software overview: [https://www.neuronsinc.com/neuromarketing/software](https://www.neuronsinc.com/neuromarketing/software) — HIGH confidence
- EyeQuant Experience features: [https://www.eyequant.com/what/eyequant-experience/](https://www.eyequant.com/what/eyequant-experience/) — HIGH confidence (official docs)
- Attention Insight vs EyeQuant comparison: [https://attentioninsight.com/eyequant-alternative/](https://attentioninsight.com/eyequant-alternative/) — MEDIUM confidence (vendor comparison page)
- G2 comparison Attention Insight vs EyeQuant: [https://www.g2.com/compare/attention-insight-vs-eyequant](https://www.g2.com/compare/attention-insight-vs-eyequant) — MEDIUM confidence
- Brainsight features and accuracy claims: [https://www.brainsight.app/features/ai-heatmaps](https://www.brainsight.app/features/ai-heatmaps) — HIGH confidence (official docs)
- Brainsight API and advertising features: [https://www.brainsight.app/features/api](https://www.brainsight.app/features/api) — HIGH confidence
- TRIBEv2 model announcement: [https://ai.meta.com/blog/tribe-v2-brain-predictive-foundation-model/](https://ai.meta.com/blog/tribe-v2-brain-predictive-foundation-model/) — HIGH confidence (Meta official blog)
- Synthetic user testing and AI personas: [https://www.uxia.app/blog/synthetic-users-tools](https://www.uxia.app/blog/synthetic-users-tools) — MEDIUM confidence
- SimAB persona-conditioned agent A/B testing: [https://arxiv.org/html/2603.01024](https://arxiv.org/html/2603.01024) — MEDIUM confidence (academic preprint)
- Predictive eye tracking pitfalls: [https://attentioninsight.com/technology/](https://attentioninsight.com/technology/) — MEDIUM confidence
- EyeQuant 2026 webinar on attention prediction direction: [https://www.eyequant.com/resources/webinar-where-attention-prediction-is-heading-in-2026/](https://www.eyequant.com/resources/webinar-where-attention-prediction-is-heading-in-2026/) — MEDIUM confidence
- Lumen Research attention measurement: [https://lumen-research.com/](https://lumen-research.com/) — HIGH confidence (official site)

---
*Feature research for: brain response analysis / neuro-design / content testing tool*
*Researched: 2026-04-06*
