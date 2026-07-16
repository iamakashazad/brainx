import { useQuery } from "@tanstack/react-query";
import { listJobs } from "@/lib/api";

export function useJobHistory() {
  return useQuery({
    queryKey: ["jobs"],
    queryFn: ({ signal }) => listJobs(signal),
    staleTime: 10_000,
  });
}
