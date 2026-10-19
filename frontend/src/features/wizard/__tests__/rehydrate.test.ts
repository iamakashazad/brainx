import { useWizardStore } from "@/stores/wizardStore";
import { waitFor } from "@testing-library/react";

describe("wizard store persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    useWizardStore.setState({
      currentStep: 1,
      selectedPersonaId: null,
      contentId: null,
      contentType: null,
      jobId: null,
      activeScreenIndex: 0,
      activeCircuit: null,
      activeRecId: null,
      secondaryRecLocationCursor: 0,
    });
  });

  it("writes to the brainx-wizard-state key when persona changes", async () => {
    useWizardStore.getState().setPersona("p-existing");

    await waitFor(() => {
      expect(localStorage.getItem("brainx-wizard-state")).toContain("p-existing");
    });
  });

  it("rehydrates persisted currentStep and selectedPersonaId", async () => {
    localStorage.setItem(
      "brainx-wizard-state",
      JSON.stringify({
        state: {
          currentStep: 2,
          selectedPersonaId: "p-existing",
        },
        version: 0,
      }),
    );

    await useWizardStore.persist.rehydrate();

    expect(useWizardStore.getState().currentStep).toBe(2);
    expect(useWizardStore.getState().selectedPersonaId).toBe("p-existing");
  });

  it("clearContent drops both contentId and contentType", () => {
    useWizardStore.getState().setContent("c-1", "static");
    expect(useWizardStore.getState().contentId).toBe("c-1");

    useWizardStore.getState().clearContent();

    expect(useWizardStore.getState().contentId).toBeNull();
    expect(useWizardStore.getState().contentType).toBeNull();
  });

  it("never persists contentId/contentType", async () => {
    useWizardStore.getState().setPersona("p-1");
    useWizardStore.getState().setContent("c-should-not-persist", "text");

    await waitFor(() => {
      expect(localStorage.getItem("brainx-wizard-state")).toContain("p-1");
    });

    const stored = localStorage.getItem("brainx-wizard-state") ?? "";
    expect(stored).not.toContain("c-should-not-persist");
    const parsed = JSON.parse(stored) as { state: Record<string, unknown> };
    expect(parsed.state.contentId).toBeUndefined();
    expect(parsed.state.contentType).toBeUndefined();
  });

  it("does not rehydrate contentId from a pre-migration payload", async () => {
    // A v0 entry written before contentId left partialize. Rehydrating it would
    // re-enable "Run Analysis" on a visibly empty content step and submit
    // content the user could no longer see.
    localStorage.setItem(
      "brainx-wizard-state",
      JSON.stringify({
        state: {
          currentStep: 2,
          selectedPersonaId: "p-existing",
          contentId: "c-stale",
          contentType: "ui_screens",
        },
        version: 0,
      }),
    );

    await useWizardStore.persist.rehydrate();

    expect(useWizardStore.getState().selectedPersonaId).toBe("p-existing");
    expect(useWizardStore.getState().contentId).toBeNull();
    expect(useWizardStore.getState().contentType).toBeNull();
  });
});
