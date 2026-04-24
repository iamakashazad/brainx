import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { CircuitName } from "@/lib/api-types";

type ContentType = "text" | "ui_screens" | "static";
type WizardStep = 1 | 2 | 3 | 4;

type WizardState = {
  currentStep: WizardStep;
  selectedPersonaId: string | null;
  contentId: string | null;
  contentType: ContentType | null;
  jobId: string | null;
  activeScreenIndex: number;
  activeCircuit: CircuitName | null;
  activeRecId: string | null;
  secondaryRecLocationCursor: number;
  setStep: (step: WizardStep) => void;
  setPersona: (id: string | null) => void;
  setContent: (id: string, type: ContentType) => void;
  setJob: (id: string | null) => void;
  setActiveScreenIndex: (index: number) => void;
  setActiveCircuit: (circuit: CircuitName | null) => void;
  setActiveRecId: (id: string | null) => void;
  bumpSecondaryCursor: () => void;
  reset: () => void;
};

const initialState = {
  currentStep: 1 as WizardStep,
  selectedPersonaId: null,
  contentId: null,
  contentType: null,
  jobId: null,
  activeScreenIndex: 0,
  activeCircuit: null,
  activeRecId: null,
  secondaryRecLocationCursor: 0,
};

export const useWizardStore = create<WizardState>()(
  persist(
    (set) => ({
      ...initialState,
      setStep: (step) => set({ currentStep: step }),
      setPersona: (id) => set({ selectedPersonaId: id }),
      setContent: (id, type) => set({ contentId: id, contentType: type }),
      setJob: (id) => set({ jobId: id }),
      setActiveScreenIndex: (index) => set({ activeScreenIndex: index }),
      setActiveCircuit: (circuit) => set({ activeCircuit: circuit }),
      setActiveRecId: (id) =>
        set({ activeRecId: id, secondaryRecLocationCursor: 0 }),
      bumpSecondaryCursor: () =>
        set((state) => ({
          secondaryRecLocationCursor: state.secondaryRecLocationCursor + 1,
        })),
      reset: () => set(initialState),
    }),
    {
      name: "brainx-wizard-state",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        currentStep: state.currentStep,
        selectedPersonaId: state.selectedPersonaId,
        contentId: state.contentId,
        contentType: state.contentType,
        jobId: state.jobId,
      }),
    },
  ),
);
