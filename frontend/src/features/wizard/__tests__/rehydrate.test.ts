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
});
