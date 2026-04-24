import { z } from "zod";

export const personaCreateSchema = z.object({
  name: z.string().min(1).max(120),
  demographics: z.object({
    age: z.number().int().min(0).max(120),
    role: z.string().min(1).max(80),
    background: z.string().max(500).nullable(),
  }),
  psychographics: z.object({
    goals: z.array(z.string()),
    values: z.array(z.string()),
    motivations: z.array(z.string()),
  }),
  cognitive_state: z.object({
    attention_span: z.enum(["short", "medium", "long"]),
    stress_level: z.enum(["low", "moderate", "high"]),
    tech_literacy: z.enum(["novice", "intermediate", "expert"]),
  }),
  environment: z.object({
    device: z.enum(["mobile", "tablet", "desktop"]),
    location: z.enum(["commute", "home", "office", "store", "other"]),
    ambient: z.string().max(500).nullable(),
  }),
});

export type PersonaFormValues = z.infer<typeof personaCreateSchema>;

export const demographicsSectionSchema = z.object({
  name: z.string().min(1).max(120),
  demographics: z.object({
    age: z.number().int().min(0).max(120),
    role: z.string().min(1).max(80),
    background: z.string().max(500).nullable(),
  }),
});

export const psychographicsSectionSchema = z.object({
  psychographics: z.object({
    goals: z.array(z.string()),
    values: z.array(z.string()),
    motivations: z.array(z.string()),
  }),
});

export const cognitiveStateSectionSchema = z.object({
  cognitive_state: z.object({
    attention_span: z.enum(["short", "medium", "long"]),
    stress_level: z.enum(["low", "moderate", "high"]),
    tech_literacy: z.enum(["novice", "intermediate", "expert"]),
  }),
});

export const environmentSectionSchema = z.object({
  environment: z.object({
    device: z.enum(["mobile", "tablet", "desktop"]),
    location: z.enum(["commute", "home", "office", "store", "other"]),
    ambient: z.string().max(500).nullable(),
  }),
});
