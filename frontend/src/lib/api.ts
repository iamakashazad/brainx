import {
  analyzeResponseSchema,
  contentCreatedSchema,
  jobSummaryListSchema,
  jobStatusResponseSchema,
  personaCreateSchema,
  personaListSchema,
  personaReadSchema,
} from "./api-schemas";
import type {
  AnalyzeResponse,
  ContentCreated,
  JobSummary,
  JobStatusResponse,
  PersonaCreate,
  PersonaRead,
} from "./api-types";
import { ApiError } from "./errors";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

/** Pull the server's error text out of a failed response.
 *
 * FastAPI sends `detail` as a string for HTTPException, but as an array of
 * `{loc, msg, type}` objects for 422 validation errors — handle both, or those
 * become invisible to the user. Every non-ok path must go through here: a
 * hardcoded or empty message throws away a diagnostic the backend took care to
 * write (e.g. "DEEPSEEK_API_KEY is not configured…", "image > 5MB…").
 */
async function detailFrom(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === "string") {
      return body.detail;
    }
    if (Array.isArray(body.detail)) {
      const messages = body.detail
        .map((entry) =>
          entry && typeof entry === "object" && "msg" in entry
            ? String((entry as { msg: unknown }).msg)
            : "",
        )
        .filter(Boolean);
      if (messages.length > 0) {
        return messages.join("; ");
      }
    }
    return "";
  } catch {
    return "";
  }
}

async function apiErrorFrom(response: Response): Promise<ApiError> {
  return new ApiError(response.status, await detailFrom(response));
}

async function parseResponse<T>(response: Response, parser: { parse: (data: unknown) => T }) {
  if (!response.ok) {
    throw await apiErrorFrom(response);
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
    throw await apiErrorFrom(response);
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

export async function deleteJob(jobId: string, signal?: AbortSignal): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/jobs/${jobId}`, {
    method: "DELETE",
    signal,
  });

  if (!response.ok && response.status !== 204) {
    throw await apiErrorFrom(response);
  }
}

export async function listJobs(signal?: AbortSignal): Promise<JobSummary[]> {
  const response = await fetch(`${API_BASE_URL}/jobs`, { signal });
  return parseResponse(response, jobSummaryListSchema);
}

export type AISuggestRequest = {
  name: string;
  age: number;
  role: string;
  background?: string | null;
  field: string;
};

export type AISuggestResponse = {
  value: string | string[];
};

export async function suggestPersonaField(
  body: AISuggestRequest,
  signal?: AbortSignal,
): Promise<AISuggestResponse> {
  const response = await fetch(`${API_BASE_URL}/personas/ai-suggest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) throw await apiErrorFrom(response);
  return (await response.json()) as AISuggestResponse;
}
