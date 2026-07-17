/**
 * Terminal-state coverage for the live routed pages:
 *  - ResultsPage renders a failure card (not the "Waiting…" dead end) for
 *    ERROR jobs and unreachable jobs.
 *  - RunningPage labels RUNNING-with-null-stage as "Starting analysis…".
 *  - "New Analysis" resets the persisted wizard store.
 */

import type { ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../../../tests/msw/server";
import { setJobResponse } from "../../../tests/msw/handlers";
import { jobStatusRefetchInterval } from "@/features/run/useJobStatus";
import { useWizardStore } from "@/stores/wizardStore";
import { ResultsPage } from "../ResultsPage";
import { RunningPage } from "../RunningPage";

function renderAt(path: string, routePath: string, element: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={routePath} element={element} />
          <Route path="/analysis/:jobId/running" element={<h1>running route</h1>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ResultsPage terminal states", () => {
  it("renders a failure card with retry actions for an ERROR job", async () => {
    setJobResponse("job-err", {
      job_id: "job-err",
      status: "ERROR",
      persona_id: "p-1",
      queue_position: null,
      stage: null,
      result: null,
      error: "DeepSeek request failed (HTTP 401). Please retry.",
      created_at: "2026-04-24T12:00:00.000Z",
    });

    renderAt("/analysis/job-err/results", "/analysis/:jobId/results", <ResultsPage />);

    expect(await screen.findByText("Analysis failed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Try Again/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Back to Dashboard/i })).toBeInTheDocument();
    expect(
      screen.queryByText("Waiting for completed analysis results…"),
    ).not.toBeInTheDocument();
  });

  it("renders a failure card when the job cannot be fetched (404)", async () => {
    server.use(
      http.get("http://localhost:8000/jobs/job-gone", () => new HttpResponse(null, { status: 404 })),
    );

    renderAt("/analysis/job-gone/results", "/analysis/:jobId/results", <ResultsPage />);

    expect(await screen.findByText("Analysis failed")).toBeInTheDocument();
    expect(
      screen.queryByText("Waiting for completed analysis results…"),
    ).not.toBeInTheDocument();
  });
});

describe("RunningPage stage labels", () => {
  it("shows 'Starting analysis…' for RUNNING with null stage", async () => {
    setJobResponse("job-run", {
      job_id: "job-run",
      status: "RUNNING",
      persona_id: "p-1",
      queue_position: null,
      stage: null,
      result: null,
      error: null,
      created_at: "2026-04-24T12:00:00.000Z",
    });

    renderAt("/analysis/job-run/running", "/analysis/:jobId/running", <RunningPage />);

    expect(await screen.findByText("Starting analysis…")).toBeInTheDocument();
    expect(screen.queryByText("Queued — waiting to start…")).not.toBeInTheDocument();
  });
});

describe("polling watchdog", () => {
  it("keeps polling active jobs and stops on terminal or unreachable states", () => {
    expect(jobStatusRefetchInterval("PENDING", 0)).toBe(2000);
    expect(jobStatusRefetchInterval("RUNNING", 0)).toBe(2000);
    expect(jobStatusRefetchInterval(undefined, 0)).toBe(2000);
    expect(jobStatusRefetchInterval("DONE", 0)).toBe(false);
    expect(jobStatusRefetchInterval("ERROR", 0)).toBe(false);
    expect(jobStatusRefetchInterval(undefined, 3)).toBe(false);
    expect(jobStatusRefetchInterval("RUNNING", 3)).toBe(false);
  });
});

describe("wizard store reset", () => {
  it("clears persisted job/content ids", () => {
    const store = useWizardStore.getState();
    store.setPersona("p-stale");
    store.setContent("c-stale", "text");
    store.setJob("job-stale");

    useWizardStore.getState().reset();

    const state = useWizardStore.getState();
    expect(state.selectedPersonaId).toBeNull();
    expect(state.contentId).toBeNull();
    expect(state.jobId).toBeNull();
    expect(state.currentStep).toBe(1);
  });
});
