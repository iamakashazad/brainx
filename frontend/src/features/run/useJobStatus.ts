import { useQuery } from "@tanstack/react-query";
import { getJobStatus } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import type { JobStatus, JobStatusResponse } from "@/lib/api-types";

function isClientError(error: unknown): boolean {
  return error instanceof ApiError && error.status >= 400 && error.status < 500;
}

export function jobStatusRefetchInterval(
  status: JobStatus | undefined,
  errorUpdateCount: number,
  error?: unknown,
): number | false {
  if (status === "DONE" || status === "ERROR") return false;
  // A 4xx (job deleted / never existed) is terminal — retrying cannot help.
  if (isClientError(error)) return false;
  // Client-side watchdog: after 3 failed refetch cycles (each with its own
  // retries) the backend is considered unreachable — stop polling so the UI
  // settles into a terminal error state instead of looping forever.
  if (errorUpdateCount >= 3) return false;
  return 2000;
}

export function useJobStatus(jobId: string | null) {
  return useQuery<JobStatusResponse>({
    queryKey: ["job", jobId],
    enabled: Boolean(jobId),
    queryFn: ({ signal }) => getJobStatus(jobId!, signal),
    refetchOnMount: false,
    refetchInterval: (query) =>
      jobStatusRefetchInterval(
        query.state.data?.status,
        query.state.errorUpdateCount,
        query.state.error,
      ),
    refetchIntervalInBackground: false,
    retry: (failureCount, error) => !isClientError(error) && failureCount < 3,
    retryDelay: 5000,
  });
}
