/**
 * "Run Analysis" must only submit content that belongs to the tab the user is
 * looking at. Three ways this used to go wrong, all covered here:
 *   - content uploaded on one tab stayed submittable from another tab
 *   - removing the uploaded file left contentId set, so the button stayed enabled
 *     on a visibly empty step
 *   - switching tabs unmounts the uploader and destroys its preview, so any
 *     leftover contentId referred to something the user could no longer see
 */

import type { ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { useWizardStore } from "@/stores/wizardStore";
import { ContentStepPage } from "../ContentStepPage";

function renderContentStep(element: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/analysis/new/content"]}>
        <Routes>
          <Route path="/analysis/new/content" element={element} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const runAnalysis = () => screen.getByRole("button", { name: /Run Analysis/i });

describe("ContentStepPage submit gating", () => {
  beforeEach(() => {
    localStorage.clear();
    useWizardStore.setState({
      currentStep: 2,
      selectedPersonaId: "p-1",
      contentId: null,
      contentType: null,
      jobId: null,
      activeScreenIndex: 0,
      activeCircuit: null,
      activeRecId: null,
      secondaryRecLocationCursor: 0,
    });
  });

  it("disables Run Analysis when no content is set", () => {
    renderContentStep(<ContentStepPage />);
    expect(runAnalysis()).toBeDisabled();
  });

  it("enables Run Analysis when content matches the visible tab", () => {
    // Default tab is "screens", which pairs with contentType "ui_screens".
    useWizardStore.getState().setContent("c-1", "ui_screens");
    renderContentStep(<ContentStepPage />);
    expect(runAnalysis()).toBeEnabled();
  });

  it("does NOT enable Run Analysis for content from a different tab", () => {
    // Text content while the screens tab is showing: previously submittable.
    useWizardStore.getState().setContent("c-text", "text");
    renderContentStep(<ContentStepPage />);
    expect(runAnalysis()).toBeDisabled();
  });

  it("clears stored content when the content-type tab changes", async () => {
    const user = userEvent.setup();
    useWizardStore.getState().setContent("c-1", "ui_screens");
    renderContentStep(<ContentStepPage />);
    expect(runAnalysis()).toBeEnabled();

    await user.click(screen.getByRole("tab", { name: "Text" }));

    expect(useWizardStore.getState().contentId).toBeNull();
    expect(useWizardStore.getState().contentType).toBeNull();
    expect(runAnalysis()).toBeDisabled();
  });

  it("disables Run Analysis once content is cleared, e.g. after removing a file", () => {
    useWizardStore.getState().setContent("c-1", "ui_screens");
    renderContentStep(<ContentStepPage />);
    expect(runAnalysis()).toBeEnabled();

    act(() => {
      useWizardStore.getState().clearContent();
    });

    expect(runAnalysis()).toBeDisabled();
  });
});
