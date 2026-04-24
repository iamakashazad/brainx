import { http, HttpResponse } from "msw";

const now = "2026-04-24T12:00:00.000Z";

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
  http.get("http://localhost:8000/jobs/:id", ({ params }) =>
    HttpResponse.json({
      job_id: String(params.id),
      status: "PENDING",
      queue_position: 1,
      stage: null,
      result: null,
      error: null,
      created_at: now,
    }),
  ),
  http.get("http://localhost:8000/jobs/:id/activations/:screen", () => {
    const bytes = new Uint8Array(20484 * 4);
    return new HttpResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "X-Vertex-Count": "20484",
      },
    });
  }),
];
