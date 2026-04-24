import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JobStatusResponse } from "@/lib/api-types";
import { setJobResponse } from "../../../../tests/msw/handlers";
import { useJobStatus } from "../useJobStatus";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

  function Wrapper({ children }: React.PropsWithChildren) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children,
    );
  }

  return { queryClient, Wrapper };
}

function buildJobResponse(overrides: Partial<JobStatusResponse> = {}): JobStatusResponse {
  return {
    job_id: "job-1",
    status: "PENDING",
    queue_position: 2,
    stage: null,
    result: null,
    error: null,
    created_at: "2026-04-24T12:00:00.000Z",
    ...overrides,
  };
}

function buildAnalysisResult() {
  return {
    schema_version: 1 as const,
    simulation: {},
    overlays: [],
    activations: [],
    roi: [
      {
        screen_index: 0,
        circuits: {
          Attention: { score: 0, peak: 0 },
          "Cognitive Load": { score: 0, peak: 0 },
          "Emotional Response": { score: 0, peak: 0 },
          "Memory Encoding": { score: 0, peak: 0 },
          Reward: { score: 0, peak: 0 },
        },
        regions: [],
      },
    ],
    flow_continuity: {
      circuits: {
        Attention: { per_screen: [], trend: "flat" as const },
        "Cognitive Load": { per_screen: [], trend: "flat" as const },
        "Emotional Response": { per_screen: [], trend: "flat" as const },
        "Memory Encoding": { per_screen: [], trend: "flat" as const },
        Reward: { per_screen: [], trend: "flat" as const },
      },
    },
    recommendations: [],
    pathway: {
      selected_pathway: "text" as const,
      slideshow_path: null,
      durations: [],
    },
  };
}

describe("useJobStatus", () => {
  beforeEach(() => {
    setJobResponse("job-1", buildJobResponse());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns pending job data and polls every 2000ms", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useJobStatus("job-1"), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.data).toMatchObject({
        status: "PENDING",
        queue_position: 2,
        stage: null,
      });
    });

    await new Promise((resolve) => setTimeout(resolve, 2100));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });

  it("stops polling after the backend reports DONE", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useJobStatus("job-1"), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.data?.status).toBe("PENDING");
    });

    setJobResponse(
      "job-1",
      buildJobResponse({
        status: "DONE",
        queue_position: null,
        result: buildAnalysisResult(),
      }),
    );

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    }, { timeout: 3000 });

    await waitFor(() => {
      expect(result.current.data?.status).toBe("DONE");
    });

    const doneCallCount = fetchSpy.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 2100));

    expect(fetchSpy).toHaveBeenCalledTimes(doneCallCount);
  }, 10000);

  it("stops polling after the backend reports ERROR", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useJobStatus("job-1"), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.data?.status).toBe("PENDING");
    });

    setJobResponse(
      "job-1",
      buildJobResponse({
        status: "ERROR",
        queue_position: null,
        error: "some backend trace",
      }),
    );

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    }, { timeout: 3000 });

    await waitFor(() => {
      expect(result.current.data?.status).toBe("ERROR");
      expect(result.current.data?.error).toBe("some backend trace");
    });

    const errorCallCount = fetchSpy.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 2100));

    expect(fetchSpy).toHaveBeenCalledTimes(errorCallCount);
  }, 10000);

  it("stops dispatching fetches after unmount", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { Wrapper } = createWrapper();
    const { result, unmount } = renderHook(() => useJobStatus("job-1"), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.data?.status).toBe("PENDING");
    });

    unmount();
    const callCountAtUnmount = fetchSpy.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 4100));

    expect(fetchSpy).toHaveBeenCalledTimes(callCountAtUnmount);
  });
});
