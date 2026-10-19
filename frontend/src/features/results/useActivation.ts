import { useQuery } from "@tanstack/react-query";
import { API_BASE_URL } from "@/lib/api";

export function useActivation(jobId: string | null, screenIndex: number) {
  return useQuery<Float32Array>({
    queryKey: ["activation", jobId, screenIndex],
    enabled: Boolean(jobId),
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: async ({ signal }) => {
      const url =
        jobId === "demo"
          ? `/demo/activations/screen_${screenIndex + 1}.bin`
          : `${API_BASE_URL}/jobs/${jobId}/activations/${screenIndex}`;
      const response = await fetch(url, { signal });
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
