import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { useWizardStore } from "@/stores/wizardStore";
import { server } from "../../../../tests/msw/server";
import { useSubmitAnalyze } from "../useSubmitAnalyze";

function AnalyzeHarness() {
  const mutation = useSubmitAnalyze();
  return React.createElement(
    "button",
    {
      type: "button",
      onClick: () => mutation.mutate(),
    },
    "Analyze Content",
  );
}

function renderAnalyzeHarness() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  render(
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(MemoryRouter, null, React.createElement(AnalyzeHarness)),
    ),
  );
}

describe("analyze submission", () => {
  beforeEach(() => {
    localStorage.clear();
    useWizardStore.setState({
      currentStep: 2,
      selectedPersonaId: "p-1",
      contentId: "c-1",
      contentType: "text",
      jobId: null,
      activeScreenIndex: 0,
      activeCircuit: null,
      activeRecId: null,
      secondaryRecLocationCursor: 0,
    });
  });

  it("submits analyze with the selected persona id and content id", async () => {
    const user = userEvent.setup();
    let requestBody: Record<string, string> | null = null;

    server.use(
      http.post("http://localhost:8000/analyze", async ({ request }) => {
        requestBody = (await request.json()) as Record<string, string>;
        return HttpResponse.json({ job_id: "job-1", status: "PENDING" }, { status: 201 });
      }),
    );

    renderAnalyzeHarness();

    await user.click(screen.getByRole("button", { name: "Analyze Content" }));

    await waitFor(() => {
      expect(requestBody).toEqual({ persona_id: "p-1", content_id: "c-1" });
    });
  });

  it("stores the returned job id and advances to step three", async () => {
    const user = userEvent.setup();
    renderAnalyzeHarness();

    await user.click(screen.getByRole("button", { name: "Analyze Content" }));

    await waitFor(() => {
      expect(useWizardStore.getState().jobId).toBe("job-1");
      expect(useWizardStore.getState().currentStep).toBe(3);
    });
  });

  it("throws before dispatch when persona or content is missing", async () => {
    const user = userEvent.setup();
    let analyzeRequestCount = 0;

    server.use(
      http.post("http://localhost:8000/analyze", () => {
        analyzeRequestCount += 1;
        return HttpResponse.json({ job_id: "job-1", status: "PENDING" }, { status: 201 });
      }),
    );

    useWizardStore.setState({
      currentStep: 2,
      selectedPersonaId: null,
      contentId: null,
      contentType: null,
      jobId: null,
      activeScreenIndex: 0,
      activeCircuit: null,
      activeRecId: null,
      secondaryRecLocationCursor: 0,
    });

    renderAnalyzeHarness();

    await user.click(screen.getByRole("button", { name: "Analyze Content" }));

    expect(analyzeRequestCount).toBe(0);
  });
});
