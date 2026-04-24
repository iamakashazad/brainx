import { z } from "zod";

export const circuitNameSchema = z.enum([
  "Attention",
  "Cognitive Load",
  "Emotional Response",
  "Memory Encoding",
  "Reward",
]);

export const jobStatusSchema = z.enum(["PENDING", "RUNNING", "DONE", "ERROR"]);

export const stageValueSchema = z.enum([
  "simulation",
  "grounding_check",
  "inference",
  "roi_aggregation",
  "processing",
  "recommendations",
]);

export const demographicsSchema = z.object({
  age: z.number().int().min(0).max(120),
  role: z.string().min(1).max(80),
  background: z.string().max(500).nullable(),
});

export const psychographicsSchema = z.object({
  goals: z.array(z.string()),
  values: z.array(z.string()),
  motivations: z.array(z.string()),
});

export const cognitiveStateSchema = z.object({
  attention_span: z.enum(["short", "medium", "long"]),
  stress_level: z.enum(["low", "moderate", "high"]),
  tech_literacy: z.enum(["novice", "intermediate", "expert"]),
});

export const environmentSchema = z.object({
  device: z.enum(["mobile", "tablet", "desktop"]),
  location: z.enum(["commute", "home", "office", "store", "other"]),
  ambient: z.string().nullable(),
});

export const personaReadSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(120),
  demographics: demographicsSchema,
  psychographics: psychographicsSchema,
  cognitive_state: cognitiveStateSchema,
  environment: environmentSchema,
  created_at: z.string(),
  updated_at: z.string(),
});

export const personaCreateSchema = z.object({
  name: z.string().min(1).max(120),
  demographics: demographicsSchema,
  psychographics: psychographicsSchema,
  cognitive_state: cognitiveStateSchema,
  environment: environmentSchema,
});

export const personaListSchema = z.array(personaReadSchema);

export const contentCreatedSchema = z.object({
  content_id: z.string(),
  content_type: z.enum(["text", "ui_screens", "static"]),
});

export const analyzeResponseSchema = z.object({
  job_id: z.string(),
  status: z.literal("PENDING"),
});

export const activationManifestEntrySchema = z.object({
  screen_index: z.number().int().min(0),
  path: z.string(),
  shape: z.array(z.number().int()),
  timesteps: z.number().int().min(1),
});

export const circuitScoreSchema = z.object({
  score: z.number().min(0).max(100),
  peak: z.number().min(0).max(100),
});

export const regionScoreSchema = z.object({
  atlas_label: z.string(),
  circuit: circuitNameSchema,
  score: z.number().min(0).max(100),
  peak: z.number().min(0).max(100),
});

export const screenRoiSchema = z.object({
  screen_index: z.number().int().min(0),
  circuits: z.record(circuitNameSchema, circuitScoreSchema),
  regions: z.array(regionScoreSchema),
});

export const flowContinuitySchema = z.object({
  circuits: z.record(
    circuitNameSchema,
    z.object({
      per_screen: z.array(
        z.object({
          screen_index: z.number().int().min(0),
          score_0_100: z.number(),
          delta_from_prev: z.number(),
        }),
      ),
      trend: z.enum(["rising", "dropping", "flat", "volatile"]),
    }),
  ),
});

export const recommendationSchema = z.object({
  rec_type: z.enum(["copy_rewrite", "layout_flag", "memorability", "emotional_dropoff"]),
  screen_index: z.number().int().min(0),
  evidence: z.object({
    circuit: circuitNameSchema,
    region: z.string(),
    activation_score: z.number(),
    score_rank: z.enum(["Low", "Moderate", "High", "Very High"]),
  }),
  target_region: z
    .object({
      x_ratio: z.number(),
      y_ratio: z.number(),
      width_ratio: z.number(),
      height_ratio: z.number(),
    })
    .optional(),
  element_description: z.string().optional(),
  before: z.string().optional(),
  after: z.string().optional(),
  rationale: z.string(),
});

export const pathwayMetadataSchema = z.object({
  selected_pathway: z.enum(["text", "video"]),
  slideshow_path: z.string().nullable(),
  durations: z.array(z.number()),
});

export const screenOverlaySchema = z.object({
  screen_index: z.number().int().min(0),
  hesitation_points: z.array(
    z.object({
      x_ratio: z.number(),
      y_ratio: z.number(),
      duration_ms: z.number(),
      intensity: z.number(),
    }),
  ),
  scroll_path: z
    .array(
      z.object({
        t_ms: z.number(),
        y_ratio: z.number(),
      }),
    )
    .nullable(),
});

export const analysisResultSchema = z.object({
  schema_version: z.literal(1),
  simulation: z.record(z.string(), z.unknown()),
  overlays: z.array(screenOverlaySchema),
  activations: z.array(activationManifestEntrySchema),
  roi: z.array(screenRoiSchema),
  flow_continuity: flowContinuitySchema,
  recommendations: z.array(recommendationSchema),
  pathway: pathwayMetadataSchema,
});

export const jobStatusResponseSchema = z.object({
  job_id: z.string(),
  status: jobStatusSchema,
  queue_position: z.number().int().nullable(),
  stage: stageValueSchema.nullable(),
  result: analysisResultSchema.nullable(),
  error: z.string().nullable(),
  created_at: z.string().nullable(),
});
