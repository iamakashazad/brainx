import { useQuery } from "@tanstack/react-query";

export function useMeshGeometry() {
  return useQuery({
    queryKey: ["fsaverage5-mesh"],
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: async ({ signal }) => {
      const response = await fetch("/brain/fsaverage5_pial_bilateral.bin", { signal });
      if (!response.ok) {
        throw new Error(`Mesh fetch failed: ${response.status}`);
      }

      const buffer = await response.arrayBuffer();
      const view = new DataView(buffer);
      const vertexCount = view.getUint32(0, true);
      const triangleCount = view.getUint32(4, true);
      const positionsByteLength = vertexCount * 3 * 4;
      const indicesOffset = 8 + positionsByteLength;

      return {
        positions: new Float32Array(buffer.slice(8, indicesOffset)),
        indices: new Uint32Array(buffer.slice(indicesOffset)),
        vertexCount,
        triangleCount,
      };
    },
  });
}
