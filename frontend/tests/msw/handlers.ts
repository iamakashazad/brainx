import { http, HttpResponse } from "msw";
import type { AnalysisResult, JobStatusResponse } from "@/lib/api-types";

const now = "2026-04-24T12:00:00.000Z";

type MockJobResponse = {
  job_id: string;
  status: "PENDING" | "RUNNING" | "DONE" | "ERROR";
  queue_position: number | null;
  stage:
    | "simulation"
    | "grounding_check"
    | "inference"
    | "roi_aggregation"
    | "processing"
    | "recommendations"
    | null;
  result: unknown;
  error: string | null;
  created_at: string | null;
};

function createDefaultJobResponse(jobId: string): MockJobResponse {
  return {
    job_id: jobId,
    status: "PENDING",
    queue_position: 1,
    stage: null,
    result: null,
    error: null,
    created_at: now,
  };
}

function buildFixtureResult(): AnalysisResult {
  return {
    schema_version: 1,
    simulation: {},
    overlays: [],
    activations: [
      {
        screen_index: 0,
        path: "activations/job-1/screen_1.npy",
        shape: [4, 20484],
        timesteps: 4,
      },
    ],
    roi: [
      {
        screen_index: 0,
        circuits: {
          Attention: { score: 82.4, peak: 90.1 },
          "Cognitive Load": { score: 41.2, peak: 55.4 },
          "Emotional Response": { score: 33.6, peak: 45.7 },
          "Memory Encoding": { score: 58.3, peak: 65.2 },
          Reward: { score: 47.9, peak: 60.3 },
        },
        regions: [
          { atlas_label: "S_front_inf", circuit: "Attention", score: 82.4, peak: 90.1 },
          { atlas_label: "G_rectus", circuit: "Reward", score: 47.9, peak: 60.3 },
          {
            atlas_label: "G_oc-temp_med-Parahip",
            circuit: "Memory Encoding",
            score: 58.3,
            peak: 65.2,
          },
        ],
      },
    ],
    flow_continuity: {
      circuits: {
        Attention: {
          per_screen: [{ screen_index: 0, score_0_100: 82.4, delta_from_prev: 0 }],
          trend: "flat",
        },
        "Cognitive Load": {
          per_screen: [{ screen_index: 0, score_0_100: 41.2, delta_from_prev: 0 }],
          trend: "flat",
        },
        "Emotional Response": {
          per_screen: [{ screen_index: 0, score_0_100: 33.6, delta_from_prev: 0 }],
          trend: "flat",
        },
        "Memory Encoding": {
          per_screen: [{ screen_index: 0, score_0_100: 58.3, delta_from_prev: 0 }],
          trend: "flat",
        },
        Reward: {
          per_screen: [{ screen_index: 0, score_0_100: 47.9, delta_from_prev: 0 }],
          trend: "flat",
        },
      },
    },
    recommendations: [
      {
        rec_type: "copy_rewrite",
        screen_index: 0,
        evidence: {
          circuit: "Attention",
          region: "S_front_inf",
          activation_score: 74.3,
          score_rank: "High",
        },
        before: "Buy now",
        after: "Start your free trial",
        rationale: "The CTA needs a more concrete reward.",
      },
      {
        rec_type: "layout_flag",
        screen_index: 0,
        evidence: {
          circuit: "Memory Encoding",
          region: "G_oc-temp_med-Parahip",
          activation_score: 63.1,
          score_rank: "Moderate",
        },
        element_description: "Hero CTA block",
        rationale: "The CTA competes with the hero art.",
      },
    ],
    pathway: {
      selected_pathway: "text",
      slideshow_path: null,
      durations: [],
    },
  };
}

const jobResponses = new Map<string, MockJobResponse>();

export function resetJobResponses() {
  jobResponses.clear();
  jobResponses.set("job-1", createDefaultJobResponse("job-1"));
}

export function setJobResponse(
  jobId: string,
  response: Partial<MockJobResponse>,
) {
  const previous = jobResponses.get(jobId) ?? createDefaultJobResponse(jobId);
  jobResponses.set(jobId, {
    ...previous,
    ...response,
    job_id: jobId,
  });
}

export function setFixtureDoneJob(jobId: string) {
  setJobResponse(jobId, {
    status: "DONE",
    queue_position: null,
    stage: "recommendations",
    result: buildFixtureResult(),
    error: null,
  } satisfies Partial<JobStatusResponse>);
}

resetJobResponses();

const seededPersonas = [
  {
    id: "p-1",
    name: "Focused Designer",
    demographics: {
      age: 29,
      role: "Product Designer",
      background: "Works through high-volume interface reviews.",
    },
    psychographics: {
      goals: ["ship faster"],
      values: ["clarity"],
      motivations: ["reduce friction"],
    },
    cognitive_state: {
      attention_span: "medium",
      stress_level: "moderate",
      tech_literacy: "expert",
    },
    environment: {
      device: "desktop",
      location: "office",
      ambient: "quiet",
    },
    created_at: now,
    updated_at: now,
  },
  {
    id: "p-2",
    name: "Commuter Shopper",
    demographics: {
      age: 35,
      role: "Retail Buyer",
      background: "Skims offers during train rides.",
    },
    psychographics: {
      goals: ["save time"],
      values: ["simplicity"],
      motivations: ["find useful deals"],
    },
    cognitive_state: {
      attention_span: "short",
      stress_level: "high",
      tech_literacy: "intermediate",
    },
    environment: {
      device: "mobile",
      location: "commute",
      ambient: "crowded",
    },
    created_at: now,
    updated_at: now,
  },
];

export const handlers = [
  http.get("http://localhost:8000/personas", () => HttpResponse.json(seededPersonas)),
  http.post("http://localhost:8000/personas", async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      {
        ...body,
        id: "p-created",
        created_at: now,
        updated_at: now,
      },
      { status: 201 },
    );
  }),
  http.delete("http://localhost:8000/personas/:id", () => new HttpResponse(null, { status: 204 })),
  http.post("http://localhost:8000/content/text", () =>
    HttpResponse.json({ content_id: "c-text-1", content_type: "text" }, { status: 201 }),
  ),
  http.post("http://localhost:8000/content/screens", () =>
    HttpResponse.json({ content_id: "c-screens-1", content_type: "ui_screens" }, { status: 201 }),
  ),
  http.post("http://localhost:8000/content/static", () =>
    HttpResponse.json({ content_id: "c-static-1", content_type: "static" }, { status: 201 }),
  ),
  http.post("http://localhost:8000/analyze", () => {
    setFixtureDoneJob("job-1");
    return HttpResponse.json({ job_id: "job-1", status: "PENDING" }, { status: 201 });
  }),
  http.get("http://localhost:8000/jobs/:id", ({ params }) => {
    const jobId = String(params.id);
    const response = jobResponses.get(jobId) ?? createDefaultJobResponse(jobId);
    return HttpResponse.json(response);
  }),
  http.get("http://localhost:8000/jobs/:id/activations/:screen", () => {
    const values = new Float32Array(20484);
    for (let index = 0; index < values.length; index += 1) {
      values[index] = index * 0.0001;
    }
    return new HttpResponse(values, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "X-Vertex-Count": "20484",
      },
    });
  }),
];
