import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

const parcellationSchema = z.object({
  labels: z.array(z.string()),
  circuit_of_label_index: z.array(z.string().nullable()),
  vertex_to_label_index: z.array(z.number().int()),
});

export function useParcellation() {
  return useQuery({
    queryKey: ["fsaverage5-parcellation"],
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: async ({ signal }) => {
      const response = await fetch("/brain/fsaverage5_parcellation.json", { signal });
      if (!response.ok) {
        throw new Error(`Parcellation fetch failed: ${response.status}`);
      }

      const parsed = parcellationSchema.parse(await response.json());
      return {
        labels: parsed.labels,
        circuitOfLabelIndex: parsed.circuit_of_label_index,
        vertexToLabelIndex: parsed.vertex_to_label_index,
      };
    },
  });
}
