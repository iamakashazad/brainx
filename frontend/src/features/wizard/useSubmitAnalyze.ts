import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ApiError } from "@/lib/errors";
import { submitAnalyze } from "@/lib/api";
import { useWizardStore } from "@/stores/wizardStore";

export function isQueueBusyError(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 503;
}

export function useSubmitAnalyze() {
  const navigate = useNavigate();
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
      navigate(`/analysis/${response.job_id}/running`);
    },
  });
}
