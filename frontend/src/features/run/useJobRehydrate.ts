import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { getJobStatus } from "@/lib/api";
import type { JobStatus } from "@/lib/api-types";
import { useWizardStore } from "@/stores/wizardStore";

type RehydrateState = {
  isRehydrating: boolean;
  resolvedStatus: JobStatus | null;
};

/**
 * useJobRehydrate
 *
 * On mount, fetches the current job status once to resolve rehydration.
 * If the job is already DONE, navigates to the results page.
 * Used by RunningPage and the legacy ProgressView.
 */
export function useJobRehydrate(): RehydrateState {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const jobId = useWizardStore((state) => state.jobId);
  const [state, setState] = useState<RehydrateState>({
    isRehydrating: Boolean(jobId),
    resolvedStatus: null,
  });

  useEffect(() => {
    let isCancelled = false;

    if (!jobId) {
      setState({ isRehydrating: false, resolvedStatus: null });
      return undefined;
    }

    setState({ isRehydrating: true, resolvedStatus: null });

    void queryClient
      .ensureQueryData({
        queryKey: ["job", jobId],
        queryFn: ({ signal }) => getJobStatus(jobId, signal),
        staleTime: 2000,
        revalidateIfStale: false,
      })
      .then((response) => {
        if (isCancelled) return;

        if (response.status === "DONE") {
          navigate(`/analysis/${jobId}/results`, { replace: true });
        }

        setState({ isRehydrating: false, resolvedStatus: response.status });
      })
      .catch(() => {
        if (isCancelled) return;
        // Network failure during rehydration — let polling take over.
        setState({ isRehydrating: false, resolvedStatus: null });
      });

    return () => { isCancelled = true; };
  }, [jobId, queryClient, navigate]);

  return state;
}
