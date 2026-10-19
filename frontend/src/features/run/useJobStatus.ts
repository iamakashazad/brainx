import { useQuery } from "@tanstack/react-query";
import { getJobStatus } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import type { JobStatus, JobStatusResponse } from "@/lib/api-types";

function isClientError(error: unknown): boolean {
  return error instanceof ApiError && error.status >= 400 && error.status < 500;
}

export function jobStatusRefetchInterval(
  status: JobStatus | undefined,
  consecutiveErrorCount: number,
  error?: unknown,
): number | false {
  if (status === "DONE" || status === "ERROR") return false;
  // A 4xx (job deleted / never existed) is terminal — retrying cannot help.
  if (isClientError(error)) return false;
  // Client-side watchdog: after 3 consecutive failed refetch cycles (each with
  // its own retries) the backend is considered unreachable — stop polling so
  // the UI settles into a terminal error state instead of looping forever.
  if (consecutiveErrorCount >= 3) return false;
  return 2000;
}

// TanStack's errorUpdateCount only ever grows, so on its own three unrelated
// blips across an hour-long job would stop polling for good. Remember the count
// at the last successful fetch per job and measure failures since then.
const errorCountAtLastSuccess = new Map<string, number>();

type JobQueryState = { errorUpdateCount: number; error: unknown };

export function consecutiveJobErrors(jobId: string, state: JobQueryState): number {
  if (state.error == null) {
    errorCountAtLastSuccess.set(jobId, state.errorUpdateCount);
    return 0;
  }
  return state.errorUpdateCount - (errorCountAtLastSuccess.get(jobId) ?? 0);
}

/** True once polling has given up on a job the server never reported finished. */
export function isJobPollingStopped(
  jobId: string,
  state: JobQueryState & { status?: JobStatus; isFetching: boolean },
): boolean {
  return (
    state.error != null &&
    !state.isFetching &&
    jobStatusRefetchInterval(state.status, consecutiveJobErrors(jobId, state), state.error) === false
  );
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
        consecutiveJobErrors(jobId!, query.state),
        query.state.error,
      ),
    refetchIntervalInBackground: false,
    retry: (failureCount, error) => !isClientError(error) && failureCount < 3,
    retryDelay: 5000,
  });
}
