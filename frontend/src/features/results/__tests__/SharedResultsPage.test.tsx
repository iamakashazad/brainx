import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { server } from "../../../../tests/msw/server";
import { SharedResultsPage } from "../SharedResultsPage";

vi.mock("../ResultsLayout", () => ({
  ResultsLayout: () => <h1>Brain Analysis Results</h1>,
}));

function renderShared(path = "/results/job-1") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/results/:jobId" element={<SharedResultsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("SharedResultsPage", () => {
  it("renders a completed shared result", async () => {
    renderShared();
    expect(await screen.findByRole("heading", { name: "Brain Analysis Results" })).toBeInTheDocument();
  });

  it("renders not found copy and history link for missing sessions", async () => {
    server.use(http.get("http://localhost:8000/jobs/missing", () => new HttpResponse(null, { status: 404 })));
    renderShared("/results/missing");
    expect(await screen.findByRole("heading", { name: "Session not found" })).toBeInTheDocument();
    expect(
      screen.getByText("This analysis may have been deleted or the link is incorrect."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to History" })).toHaveAttribute("href", "/");
  });

  it("says a running job is still running rather than deleted", async () => {
    server.use(
      http.get("http://localhost:8000/jobs/live", () =>
        HttpResponse.json({ job_id: "live", status: "RUNNING", stage: "inference", error: null, persona_id: null, queue_position: null, result: null, created_at: null }),
      ),
    );
    renderShared("/results/live");
    expect(await screen.findByRole("heading", { name: "Analysis still running" })).toBeInTheDocument();
  });

  it("shows the real error for a failed job", async () => {
    server.use(
      http.get("http://localhost:8000/jobs/failed", () =>
        HttpResponse.json({
          job_id: "failed", status: "ERROR", stage: "inference", error: "whisperx died", persona_id: null, queue_position: null, result: null, created_at: null,
        }),
      ),
    );
    renderShared("/results/failed");
    expect(await screen.findByRole("heading", { name: "Analysis failed" })).toBeInTheDocument();
    expect(screen.getByText("whisperx died")).toBeInTheDocument();
  });

  it("does not render wizard chrome", async () => {
    renderShared();
    expect(await screen.findByRole("heading", { name: "Brain Analysis Results" })).toBeInTheDocument();
    expect(screen.queryByText("Step 1")).not.toBeInTheDocument();
    expect(screen.queryByText("Step 2")).not.toBeInTheDocument();
    expect(screen.queryByText("Step 3")).not.toBeInTheDocument();
    expect(screen.queryByText("Step 4")).not.toBeInTheDocument();
  });
});

