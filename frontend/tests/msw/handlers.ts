import { http, HttpResponse } from "msw";

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
  http.post("http://localhost:8000/analyze", () =>
    HttpResponse.json({ job_id: "job-1", status: "PENDING" }, { status: 201 }),
  ),
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
