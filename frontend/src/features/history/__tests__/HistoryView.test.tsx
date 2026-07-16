import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { useWizardStore } from "@/stores/wizardStore";
import { resetJobsList, setJobsList } from "../../../../tests/msw/handlers";
import { HistoryView } from "../HistoryView";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  function Wrapper({ children }: React.PropsWithChildren) {
    return (
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </MemoryRouter>
    );
  }

  return Wrapper;
}

describe("HistoryView", () => {
  beforeEach(() => {
    useWizardStore.getState().reset();
    resetJobsList();
  });

  afterEach(() => {
    resetJobsList();
  });

  it("renders the history heading and new analysis action", async () => {
    render(<HistoryView />, { wrapper: createWrapper() });

    expect(screen.getByRole("heading", { name: "Analysis Sessions" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /New Analysis/i })).toBeInTheDocument();
  });

  it("renders a card for each returned job summary", async () => {
    setJobsList([
      { job_id: "job-1", status: "DONE", persona_id: "p-1", created_at: "2026-04-24T12:00:00.000Z" },
      { job_id: "job-2", status: "DONE", persona_id: "p-2", created_at: "2026-04-23T10:00:00.000Z" },
    ]);

    render(<HistoryView />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getAllByTestId("session-card")).toHaveLength(2);
    });
  });

  it("renders the empty state while keeping new analysis available", async () => {
    setJobsList([]);

    render(<HistoryView />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "No analyses yet" })).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /New Analysis/i })).toBeInTheDocument();
  });

  it("opens the wizard overlay from new analysis and resets wizard state", async () => {
    const user = userEvent.setup();
    useWizardStore.setState({ currentStep: 4, jobId: "stale-job" });

    render(<HistoryView />, { wrapper: createWrapper() });

    await user.click(screen.getByRole("button", { name: /New Analysis/i }));

    expect(screen.getByRole("dialog", { name: "Analysis wizard" })).toBeInTheDocument();
    expect(useWizardStore.getState().currentStep).toBe(1);
    expect(useWizardStore.getState().jobId).toBeNull();
  });
});
