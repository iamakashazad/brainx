import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { useWizardStore } from "@/stores/wizardStore";
import { server } from "../../../../tests/msw/server";
import { WizardShell } from "../WizardShell";

function renderWizard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <WizardShell />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("queue busy analyze submission", () => {
  beforeEach(() => {
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

  it("keeps the user on content entry and shows the queue message", async () => {
    server.use(
      http.post("http://localhost:8000/analyze", () =>
        HttpResponse.json(
          { detail: "The analysis queue is full. Please try again in a moment." },
          { status: 503 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderWizard();

    await user.click(screen.getByRole("button", { name: "Analyze Content" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The analysis queue is full. Please try again in a moment.",
    );
    expect(useWizardStore.getState().currentStep).toBe(2);
  });

  it("reenables the submit button after a 503", async () => {
    server.use(
      http.post("http://localhost:8000/analyze", () =>
        HttpResponse.json({ detail: "The analysis queue is full. Please try again in a moment." }, { status: 503 }),
      ),
    );
    const user = userEvent.setup();
    renderWizard();
    const button = screen.getByRole("button", { name: "Analyze Content" });

    await user.click(button);

    await waitFor(() => expect(button).toBeEnabled());
  });
});

