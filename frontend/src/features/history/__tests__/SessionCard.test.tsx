import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import type { JobStatus, JobSummary, PersonaRead } from "@/lib/api-types";
import { useWizardStore } from "@/stores/wizardStore";
import { SessionCard } from "../SessionCard";

const persona: PersonaRead = {
  id: "p-1",
  name: "Focused Designer",
  demographics: { age: 29, role: "Product Designer", background: null },
  psychographics: { goals: ["ship faster"], values: ["clarity"], motivations: ["reduce friction"] },
  cognitive_state: { attention_span: "medium", stress_level: "moderate", tech_literacy: "expert" },
  environment: { device: "desktop", location: "office", ambient: "quiet" },
  created_at: "2026-04-24T12:00:00.000Z",
  updated_at: "2026-04-24T12:00:00.000Z",
};

function buildJob(overrides: Partial<JobSummary> = {}): JobSummary {
  return {
    job_id: "job-1",
    status: "DONE",
    persona_id: "p-1",
    created_at: "2026-04-24T12:00:00.000Z",
    ...overrides,
  };
}

function createClient() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  queryClient.setQueryData(["personas"], [persona]);
  return queryClient;
}

function renderCard(job: JobSummary, onOpen = () => {}) {
  const queryClient = createClient();
  const personas = queryClient.getQueryData<PersonaRead[]>(["personas"]) ?? [];
  const personaName = personas.find((item) => item.id === job.persona_id)?.name ?? "Deleted Persona";

  render(
    <QueryClientProvider client={queryClient}>
      <SessionCard job={job} personaName={personaName} onOpen={onOpen} />
    </QueryClientProvider>,
  );
}

describe("SessionCard", () => {
  beforeEach(() => {
    useWizardStore.getState().reset();
  });

  it("renders persona name, short date, and complete status", () => {
    renderCard(buildJob());

    expect(screen.getByText("Focused Designer")).toBeInTheDocument();
    expect(screen.getByText("Apr 24, 2026")).toBeInTheDocument();
    expect(screen.getByText("Complete")).toBeInTheDocument();
  });

  it("renders deleted persona fallback when the persona is absent", () => {
    renderCard(buildJob({ persona_id: "missing-persona" }));

    expect(screen.getByText("Deleted Persona")).toBeInTheDocument();
  });

  it("maps every job status to the expected label", () => {
    const cases: [JobStatus, string][] = [
      ["DONE", "Complete"],
      ["RUNNING", "Running"],
      ["PENDING", "Queued"],
      ["ERROR", "Failed"],
    ];

    for (const [status, label] of cases) {
      const { unmount } = render(
        <SessionCard job={buildJob({ status })} personaName="Focused Designer" onOpen={() => {}} />,
      );
      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    }
  });

  it("opens the overlay flow at step four when clicked", async () => {
    const user = userEvent.setup();

    function Harness() {
      const [open, setOpen] = useState(false);
      const onOpen = (jobId: string) => {
        useWizardStore.getState().setJob(jobId);
        useWizardStore.getState().setStep(4);
        setOpen(true);
      };

      return (
        <>
          <SessionCard job={buildJob({ job_id: "job-clicked" })} personaName="Focused Designer" onOpen={onOpen} />
          {open ? <div role="dialog" aria-label="Analysis wizard" /> : null}
        </>
      );
    }

    render(<Harness />);

    await user.click(screen.getByTestId("session-card"));

    expect(useWizardStore.getState().jobId).toBe("job-clicked");
    expect(useWizardStore.getState().currentStep).toBe(4);
    expect(screen.getByRole("dialog", { name: "Analysis wizard" })).toBeInTheDocument();
  });
});
