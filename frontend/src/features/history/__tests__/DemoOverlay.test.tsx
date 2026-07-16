import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitForElementToBeRemoved } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "../../../../tests/msw/server";
import { buildFixtureResult, setJobsList } from "../../../../tests/msw/handlers";
import { HistoryView } from "../HistoryView";

vi.mock("@/features/results/ResultsLayout", () => ({
  ResultsLayout: () => <h1>Brain Analysis Results</h1>,
}));

function renderHistory() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/"]}>
        <HistoryView />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("DemoOverlay integration", () => {
  beforeEach(() => {
    setJobsList([]);
    server.use(http.get("/demo/result.json", () => HttpResponse.json(buildFixtureResult())));
  });

  it("opens the demo result from the pinned card", async () => {
    const user = userEvent.setup();
    renderHistory();
    await user.click(await screen.findByRole("button", { name: /sample analysis/i }));
    expect(await screen.findByRole("heading", { name: /Brain Analysis Results/i })).toBeInTheDocument();
  });

  it("does not fire analyze when opening the demo", async () => {
    const analyzeSpy = vi.fn();
    server.use(
      http.post("http://localhost:8000/analyze", () => {
        analyzeSpy();
        return HttpResponse.json({ job_id: "job-1", status: "PENDING" }, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderHistory();
    await user.click(await screen.findByRole("button", { name: /sample analysis/i }));
    expect(await screen.findByRole("heading", { name: /Brain Analysis Results/i })).toBeInTheDocument();
    expect(analyzeSpy).not.toHaveBeenCalled();
  });

  it("returns to history from the demo overlay", async () => {
    const user = userEvent.setup();
    renderHistory();
    await user.click(await screen.findByRole("button", { name: /sample analysis/i }));
    const heading = await screen.findByRole("heading", { name: /Brain Analysis Results/i });
    await user.click(screen.getByRole("button", { name: /Back to History/i }));
    await waitForElementToBeRemoved(heading);
    expect(screen.getByRole("heading", { name: "Analysis Sessions" })).toBeInTheDocument();
  });

  it("shows a clear fallback when the fixture cannot load", async () => {
    server.use(http.get("/demo/result.json", () => new HttpResponse(null, { status: 500 })));
    const user = userEvent.setup();
    renderHistory();
    await user.click(await screen.findByRole("button", { name: /sample analysis/i }));
    expect(
      await screen.findByText("Could not load demo. Check that frontend/public/demo/result.json exists."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Brain Analysis Results/i })).not.toBeInTheDocument();
  });
});
