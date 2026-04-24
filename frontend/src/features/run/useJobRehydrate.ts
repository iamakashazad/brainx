import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getJobStatus } from "@/lib/api";
import type { JobStatus } from "@/lib/api-types";
import { useWizardStore } from "@/stores/wizardStore";

type RehydrateState = {
  isRehydrating: boolean;
  resolvedStatus: JobStatus | null;
};

export function useJobRehydrate(): RehydrateState {
  const queryClient = useQueryClient();
  const jobId = useWizardStore((state) => state.jobId);
  const setStep = useWizardStore((state) => state.setStep);
  const [state, setState] = useState<RehydrateState>({
    isRehydrating: Boolean(jobId),
    resolvedStatus: null,
  });

  useEffect(() => {
    let isCancelled = false;

    if (!jobId) {
      setState({
        isRehydrating: false,
        resolvedStatus: null,
      });
      return undefined;
    }

    setState({
      isRehydrating: true,
      resolvedStatus: null,
    });

    void queryClient
      .ensureQueryData({
        queryKey: ["job", jobId],
        queryFn: ({ signal }) => getJobStatus(jobId, signal),
        staleTime: 2000,
        revalidateIfStale: false,
      })
      .then((response) => {
        if (isCancelled) {
          return;
        }

        if (response.status === "DONE") {
          setStep(4);
        }

        setState({
          isRehydrating: false,
          resolvedStatus: response.status,
        });
      })
      .catch(() => {
        if (isCancelled) {
          return;
        }

        setState({
          isRehydrating: false,
          resolvedStatus: "ERROR",
        });
      });

    return () => {
      isCancelled = true;
    };
  }, [jobId, queryClient, setStep]);

  return state;
}
