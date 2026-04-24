import { useQuery } from "@tanstack/react-query";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export function useActivation(jobId: string | null, screenIndex: number) {
  return useQuery<Float32Array>({
    queryKey: ["activation", jobId, screenIndex],
    enabled: Boolean(jobId),
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: async ({ signal }) => {
      const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/activations/${screenIndex}`, {
        signal,
      });
      if (!response.ok) {
        throw new Error(`Activation fetch failed: ${response.status}`);
      }

      const buffer = await response.arrayBuffer();
      const activation = new Float32Array(buffer);
      if (activation.length !== 20484) {
        throw new Error(`Unexpected activation length ${activation.length} - expected 20484`);
      }
      return activation;
    },
  });
}
