import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JobStatusResponse } from "@/lib/api-types";
import { useWizardStore } from "@/stores/wizardStore";
import { setJobResponse } from "../../../../tests/msw/handlers";
import { useJobRehydrate } from "../useJobRehydrate";

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

  return Wrapper;
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

describe("useJobRehydrate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    const setStep = vi.fn();
    useWizardStore.setState({
      currentStep: 3,
      selectedPersonaId: "p-1",
      contentId: "c-1",
      contentType: "text",
      jobId: "job-1",
      activeScreenIndex: 0,
      activeCircuit: null,
      activeRecId: null,
      secondaryRecLocationCursor: 0,
      setStep,
      setPersona: useWizardStore.getState().setPersona,
      setContent: useWizardStore.getState().setContent,
      setJob: useWizardStore.getState().setJob,
      setActiveScreenIndex: useWizardStore.getState().setActiveScreenIndex,
      setActiveCircuit: useWizardStore.getState().setActiveCircuit,
      setActiveRecId: useWizardStore.getState().setActiveRecId,
      bumpSecondaryCursor: useWizardStore.getState().bumpSecondaryCursor,
      reset: useWizardStore.getState().reset,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rehydrates once and jumps directly to results when the persisted job is already DONE", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const Wrapper = createWrapper();
    const setStep = vi.fn();
    useWizardStore.setState({ setStep });
    setJobResponse(
      "job-1",
      buildJobResponse({
        status: "DONE",
        queue_position: null,
        result: {
          schema_version: 1,
          simulation: {},
          overlays: [],
          activations: [],
          roi: [],
          flow_continuity: { circuits: {} as never },
          recommendations: [],
          pathway: {
            selected_pathway: "text",
            slideshow_path: null,
            durations: [],
          },
        },
      }),
    );

    const { result } = renderHook(() => useJobRehydrate(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isRehydrating).toBe(false);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy.mock.calls[0]?.[0]).toContain("/jobs/job-1");
      expect(setStep).toHaveBeenCalledWith(4);
    });
  });

  it("rehydrates once and leaves the run step active when the job is still RUNNING", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const Wrapper = createWrapper();
    const setStep = vi.fn();
    useWizardStore.setState({ setStep });
    setJobResponse(
      "job-1",
      buildJobResponse({
        status: "RUNNING",
        queue_position: null,
        stage: "inference",
      }),
    );

    const { result } = renderHook(() => useJobRehydrate(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isRehydrating).toBe(false);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    expect(setStep).not.toHaveBeenCalled();
  });
});
