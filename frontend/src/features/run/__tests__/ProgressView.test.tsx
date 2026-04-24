import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JobStatusResponse } from "@/lib/api-types";
import { useWizardStore } from "@/stores/wizardStore";
import { setJobResponse } from "../../../../tests/msw/handlers";
import { ProgressView } from "../ProgressView";

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
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return Wrapper;
}

function buildJobResponse(overrides: Partial<JobStatusResponse> = {}): JobStatusResponse {
  return {
    job_id: "job-1",
    status: "PENDING",
    queue_position: 1,
    stage: null,
    result: null,
    error: null,
    created_at: "2026-04-24T12:00:00.000Z",
    ...overrides,
  };
}

describe("ProgressView", () => {
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
    setJobResponse("job-1", buildJobResponse());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the mapped active stage copy from the backend stage", async () => {
    const Wrapper = createWrapper();
    setJobResponse("job-1", buildJobResponse({ status: "RUNNING", stage: "simulation" }));

    render(<ProgressView />, { wrapper: Wrapper });

    expect(await screen.findByText("Simulating how your persona experiences this content…")).toBeInTheDocument();
  });

  it("shows the queue badge when queue_position is positive and hides it otherwise", async () => {
    const Wrapper = createWrapper();
    const { rerender } = render(<ProgressView />, { wrapper: Wrapper });

    expect(await screen.findByText("Position 1 in queue")).toBeInTheDocument();

    setJobResponse("job-1", buildJobResponse({ queue_position: 0 }));
    await vi.advanceTimersByTimeAsync(2000);
    rerender(<ProgressView />);

    await waitFor(() => {
      expect(screen.queryByText(/Position \d+ in queue/)).not.toBeInTheDocument();
    });
  });

  it("auto-advances to step four exactly once when the job reaches DONE", async () => {
    const Wrapper = createWrapper();
    const setStep = vi.fn();
    useWizardStore.setState({ setStep });

    render(<ProgressView />, { wrapper: Wrapper });

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

    await vi.advanceTimersByTimeAsync(2000);

    await waitFor(() => {
      expect(setStep).toHaveBeenCalledTimes(1);
      expect(setStep).toHaveBeenCalledWith(4);
    });
  });

  it("renders the static failure copy and never leaks the backend error", async () => {
    const Wrapper = createWrapper();
    setJobResponse(
      "job-1",
      buildJobResponse({
        status: "ERROR",
        queue_position: null,
        error: "stack trace: backend/internal.py:12",
      }),
    );

    render(<ProgressView />, { wrapper: Wrapper });

    expect(await screen.findByText("Analysis failed")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Something went wrong during brain inference. Check that your content uploaded correctly, then try again.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/stack trace: backend\/internal\.py:12/)).not.toBeInTheDocument();
  });

  it("calls the retry handler and go-back action from the failure state", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const Wrapper = createWrapper();
    const setStep = vi.fn();
    useWizardStore.setState({ setStep });
    setJobResponse(
      "job-1",
      buildJobResponse({
        status: "ERROR",
        queue_position: null,
        error: "some backend trace",
      }),
    );

    render(<ProgressView />, { wrapper: Wrapper });

    const retryButton = await screen.findByRole("button", { name: "Try Again" });
    const goBackButton = screen.getByRole("button", { name: "Go Back" });

    await user.click(retryButton);
    await user.click(goBackButton);

    expect(setStep).toHaveBeenCalledWith(3);
    expect(setStep).toHaveBeenCalledWith(2);
  });
});
