import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWizardStore } from "@/stores/wizardStore";
import { BrainCanvas } from "../BrainCanvas";

const activation = new Float32Array(20484).fill(0.5);
const computeColorBuffer = vi.fn((_options: unknown) => new Float32Array(20484 * 3));
const useActivation = vi.fn((_jobId: string | null, _screenIndex: number) => ({
  data: activation,
  isLoading: false,
}));

vi.mock("@react-three/fiber", () => ({
  // Do NOT render children: react-dom would serialize the Float32Array args
  // of the three.js elements into jsdom attributes and exhaust the heap.
  Canvas: () => <div data-testid="brain-canvas" />,
}));

vi.mock("@react-three/drei", () => ({
  OrbitControls: () => null,
  PerspectiveCamera: () => null,
}));

vi.mock("../useActivation", () => ({
  useActivation: (jobId: string | null, screenIndex: number) => useActivation(jobId, screenIndex),
}));

// Mock query results must be referentially stable across renders — fresh
// objects per call retrigger BrainCanvas's effect every render (infinite loop).
const meshData = {
  positions: new Float32Array(20484 * 3),
  indices: new Uint32Array(12),
};
const parcellationData = {
  labels: ["Unknown", "Attention"],
  circuitOfLabelIndex: [null, "Attention"],
  vertexToLabelIndex: Array.from({ length: 20484 }, () => 1),
};

vi.mock("../useMeshGeometry", () => ({
  useMeshGeometry: () => ({ data: meshData, isLoading: false }),
}));

vi.mock("../useParcellation", () => ({
  useParcellation: () => ({ data: parcellationData, isLoading: false }),
}));

vi.mock("../colorBuffer", () => ({
  computeColorBuffer: (options: unknown) => computeColorBuffer(options),
}));

describe("BrainCanvas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWizardStore.setState({
      activeScreenIndex: 0,
      activeCircuit: "Attention",
      jobId: "job-1",
    });
  });

  it("requests the active screen activation and forwards the exact buffer into computeColorBuffer", async () => {
    render(<BrainCanvas jobId="job-1" regions={[]} screenIndex={0} />);

    await waitFor(() => {
      expect(useActivation).toHaveBeenCalledWith("job-1", 0);
      expect(computeColorBuffer).toHaveBeenCalledWith(
        expect.objectContaining({
          activations: activation,
          activeCircuit: "Attention",
        }),
      );
    });
  });
});
