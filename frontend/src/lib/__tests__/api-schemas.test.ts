import {
  jobStatusSchema,
  personaReadSchema,
  stageValueSchema,
} from "../api-schemas";

describe("api schemas", () => {
  it("accepts a valid persona", () => {
    expect(() =>
      personaReadSchema.parse({
        id: "p-1",
        name: "Focused Designer",
        demographics: {
          age: 29,
          role: "Designer",
          background: "Builds interface reviews.",
        },
        psychographics: {
          goals: ["ship"],
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
        created_at: "2026-04-24T12:00:00.000Z",
        updated_at: "2026-04-24T12:00:00.000Z",
      }),
    ).not.toThrow();
  });

  it("rejects an out-of-range age", () => {
    expect(() =>
      personaReadSchema.parse({
        id: "p-1",
        name: "Focused Designer",
        demographics: {
          age: 999,
          role: "Designer",
          background: "Builds interface reviews.",
        },
        psychographics: {
          goals: ["ship"],
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
        created_at: "2026-04-24T12:00:00.000Z",
        updated_at: "2026-04-24T12:00:00.000Z",
      }),
    ).toThrow();
  });

  it("rejects drifted backend status and stage values", () => {
    expect(() => jobStatusSchema.parse("FAILED")).toThrow();
    expect(() => jobStatusSchema.parse("COMPLETE")).toThrow();
    expect(() => stageValueSchema.parse("simulating")).toThrow();
  });
});
