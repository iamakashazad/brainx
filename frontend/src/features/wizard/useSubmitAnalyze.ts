import { useMutation } from "@tanstack/react-query";
import { submitAnalyze } from "@/lib/api";
import { useWizardStore } from "@/stores/wizardStore";

export function useSubmitAnalyze() {
  const selectedPersonaId = useWizardStore((state) => state.selectedPersonaId);
  const contentId = useWizardStore((state) => state.contentId);
  const setJob = useWizardStore((state) => state.setJob);
  const setStep = useWizardStore((state) => state.setStep);

  return useMutation({
    mutationFn: async () => {
      if (!selectedPersonaId) {
        throw new Error("No persona selected");
      }

      if (!contentId) {
        throw new Error("No content uploaded");
      }

      return submitAnalyze({ persona_id: selectedPersonaId, content_id: contentId });
    },
    onSuccess: (response) => {
      setJob(response.job_id);
      setStep(3);
    },
  });
}
