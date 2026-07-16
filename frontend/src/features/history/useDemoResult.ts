import { useQuery } from "@tanstack/react-query";
import { analysisResultSchema } from "@/lib/api-schemas";

export function useDemoResult(enabled: boolean) {
  return useQuery({
    queryKey: ["demo-result"],
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: async ({ signal }) => {
      const response = await fetch("/demo/result.json", { signal });
      if (!response.ok) {
        throw new Error("Could not load demo. Check that frontend/public/demo/result.json exists.");
      }
      return analysisResultSchema.parse(await response.json());
    },
  });
}

