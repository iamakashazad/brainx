import { useQuery } from "@tanstack/react-query";
import { getJobStatus } from "@/lib/api";
import type { JobStatusResponse } from "@/lib/api-types";

export function useJobStatus(jobId: string | null) {
  return useQuery<JobStatusResponse>({
    queryKey: ["job", jobId],
    enabled: Boolean(jobId),
    queryFn: ({ signal }) => getJobStatus(jobId!, signal),
    refetchOnMount: false,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "DONE" || status === "ERROR") return false;
      return 2000;
    },
    refetchIntervalInBackground: false,
    retry: (failureCount) => failureCount < 3,
    retryDelay: 5000,
  });
}
