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
  clearContent: () => void;
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
      clearContent: () => set({ contentId: null, contentType: null }),
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
      // contentId/contentType are deliberately NOT persisted. The uploaders keep
      // their previews in local component state, which a reload destroys — so a
      // rehydrated contentId pointed at content the user could no longer see,
      // leaving "Run Analysis" enabled on a visibly empty step and submitting
      // whatever was uploaded before the reload.
      partialize: (state) => ({
        currentStep: state.currentStep,
        selectedPersonaId: state.selectedPersonaId,
        jobId: state.jobId,
      }),
      // Bumped when contentId/contentType left partialize: without this, entries
      // already in localStorage would rehydrate them one last time and reproduce
      // the phantom-enabled button exactly once per browser.
      version: 1,
      migrate: (persisted) => {
        const { contentId: _c, contentType: _t, ...rest } = (persisted ?? {}) as Record<
          string,
          unknown
        >;
        return rest as unknown as WizardState;
      },
    },
  ),
);
