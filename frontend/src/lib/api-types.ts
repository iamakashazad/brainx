export type JobStatus = "PENDING" | "RUNNING" | "DONE" | "ERROR";

export type StageValue =
  | "simulation"
  | "grounding_check"
  | "inference"
  | "roi_aggregation"
  | "processing"
  | "recommendations";

export type CircuitName =
  | "Attention"
  | "Cognitive Load"
  | "Emotional Response"
  | "Memory Encoding"
  | "Reward";

export type Demographics = {
  age: number;
  role: string;
  background: string | null;
};

export type Psychographics = {
  goals: string[];
  values: string[];
  motivations: string[];
};

export type CognitiveState = {
  attention_span: "short" | "medium" | "long";
  stress_level: "low" | "moderate" | "high";
  tech_literacy: "novice" | "intermediate" | "expert";
};

export type Environment = {
  device: "mobile" | "tablet" | "desktop";
  location: "commute" | "home" | "office" | "store" | "other";
  ambient: string | null;
};

export type PersonaRead = {
  id: string;
  name: string;
  demographics: Demographics;
  psychographics: Psychographics;
  cognitive_state: CognitiveState;
  environment: Environment;
  created_at: string;
  updated_at: string;
};

export type PersonaCreate = Omit<PersonaRead, "id" | "created_at" | "updated_at">;

export type ContentCreated = {
  content_id: string;
  content_type: "text" | "ui_screens" | "static";
};

export type AnalyzeResponse = {
  job_id: string;
  status: "PENDING";
};

export type ActivationManifestEntry = {
  screen_index: number;
  path: string;
  shape: number[];
  timesteps: number;
};

export type CircuitScore = {
  score: number;
  peak: number;
};

export type RegionScore = {
  atlas_label: string;
  circuit: CircuitName;
  score: number;
  peak: number;
};

export type ScreenROI = {
  screen_index: number;
  circuits: Record<CircuitName, CircuitScore>;
  regions: RegionScore[];
};

export type FlowContinuity = {
  circuits: Record<
    CircuitName,
    {
      per_screen: {
        screen_index: number;
        score_0_100: number;
        delta_from_prev: number;
      }[];
      trend: "rising" | "dropping" | "flat" | "volatile";
    }
  >;
};

export type RecType = "copy_rewrite" | "layout_flag" | "memorability" | "emotional_dropoff";

export type Recommendation = {
  rec_type: RecType;
  screen_index: number;
  evidence: {
    circuit: CircuitName;
    region: string;
    activation_score: number;
    score_rank: "Low" | "Moderate" | "High" | "Very High";
  };
  target_region?: {
    x_ratio: number;
    y_ratio: number;
    width_ratio: number;
    height_ratio: number;
  } | null;
  element_description?: string | null;
  before?: string | null;
  after?: string | null;
  rationale: string;
};

export type PathwayMetadata = {
  selected_pathway: "text" | "video";
  slideshow_path: string | null;
  durations: number[];
};

export type ScreenOverlay = {
  screen_index: number;
  hesitation_points: {
    x_ratio: number;
    y_ratio: number;
    duration_ms: number;
    intensity: number;
  }[];
  scroll_path: {
    t_ms: number;
    y_ratio: number;
  }[] | null;
};

export type AnalysisResult = {
  schema_version: 1;
  simulation: Record<string, unknown>;
  overlays: ScreenOverlay[];
  activations: ActivationManifestEntry[];
  roi: ScreenROI[];
  flow_continuity: FlowContinuity;
  recommendations: Recommendation[];
  pathway: PathwayMetadata;
};

export type JobStatusResponse = {
  job_id: string;
  status: JobStatus;
  persona_id: string | null;
  queue_position: number | null;
  stage: StageValue | null;
  result: AnalysisResult | null;
  error: string | null;
  created_at: string | null;
  updated_at: string | null;
  runtime_seconds: number | null;
  inference_processes: number;
  stale_inference_processes: number;
  status_message: string | null;
};

export type JobSummary = {
  job_id: string;
  status: JobStatus;
  persona_id: string | null;
  created_at: string | null;
};
