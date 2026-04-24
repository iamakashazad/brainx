import {
  analyzeResponseSchema,
  contentCreatedSchema,
  jobStatusResponseSchema,
  personaCreateSchema,
  personaListSchema,
  personaReadSchema,
} from "./api-schemas";
import type {
  AnalyzeResponse,
  ContentCreated,
  JobStatusResponse,
  PersonaCreate,
  PersonaRead,
} from "./api-types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

async function parseResponse<T>(response: Response, parser: { parse: (data: unknown) => T }) {
  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`);
  }

  const json = (await response.json()) as unknown;
  return parser.parse(json);
}

export async function listPersonas(signal?: AbortSignal): Promise<PersonaRead[]> {
  const response = await fetch(`${API_BASE_URL}/personas`, { signal });
  return parseResponse(response, personaListSchema);
}

export async function createPersona(
  body: PersonaCreate,
  signal?: AbortSignal,
): Promise<PersonaRead> {
  const payload = personaCreateSchema.parse(body);
  const response = await fetch(`${API_BASE_URL}/personas`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal,
  });
  return parseResponse(response, personaReadSchema);
}

export async function deletePersona(id: string, signal?: AbortSignal): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/personas/${id}`, {
    method: "DELETE",
    signal,
  });

  if (!response.ok && response.status !== 204) {
    throw new Error(`API request failed with status ${response.status}`);
  }
}

export async function createTextContent(
  text: string,
  signal?: AbortSignal,
): Promise<ContentCreated> {
  const response = await fetch(`${API_BASE_URL}/content/text`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content_text: text }),
    signal,
  });
  return parseResponse(response, contentCreatedSchema);
}

export async function uploadScreens(
  files: File[],
  signal?: AbortSignal,
): Promise<ContentCreated> {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }

  const response = await fetch(`${API_BASE_URL}/content/screens`, {
    method: "POST",
    body: formData,
    signal,
  });
  return parseResponse(response, contentCreatedSchema);
}

export async function uploadStatic(file: File, signal?: AbortSignal): Promise<ContentCreated> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/content/static`, {
    method: "POST",
    body: formData,
    signal,
  });
  return parseResponse(response, contentCreatedSchema);
}

export async function submitAnalyze(
  body: {
    persona_id: string;
    content_id: string;
  },
  signal?: AbortSignal,
): Promise<AnalyzeResponse> {
  const response = await fetch(`${API_BASE_URL}/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });
  return parseResponse(response, analyzeResponseSchema);
}

export async function getJobStatus(
  jobId: string,
  signal?: AbortSignal,
): Promise<JobStatusResponse> {
  const response = await fetch(`${API_BASE_URL}/jobs/${jobId}`, {
    signal,
  });
  return parseResponse(response, jobStatusResponseSchema);
}
