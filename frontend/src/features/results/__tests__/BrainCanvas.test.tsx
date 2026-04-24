import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWizardStore } from "@/stores/wizardStore";
import { BrainCanvas } from "../BrainCanvas";

const activation = new Float32Array(20484).fill(0.5);
const computeColorBuffer = vi.fn(() => new Float32Array(20484 * 3));
const useActivation = vi.fn(() => ({ data: activation, isLoading: false }));

vi.mock("@react-three/fiber", () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => <div data-testid="brain-canvas">{children}</div>,
}));

vi.mock("@react-three/drei", () => ({
  OrbitControls: () => null,
  PerspectiveCamera: () => null,
}));

vi.mock("../useActivation", () => ({
  useActivation: (...args: unknown[]) => useActivation(...args),
}));

vi.mock("../useMeshGeometry", () => ({
  useMeshGeometry: () => ({
    positions: new Float32Array(20484 * 3),
    indices: new Uint32Array(12),
    isLoading: false,
  }),
}));

vi.mock("../useParcellation", () => ({
  useParcellation: () => ({
    labels: ["Unknown", "Attention"],
    circuitOfLabelIndex: [null, "Attention"],
    vertexToLabelIndex: Array.from({ length: 20484 }, () => 1),
    isLoading: false,
  }),
}));

vi.mock("../colorBuffer", () => ({
  computeColorBuffer: (...args: unknown[]) => computeColorBuffer(...args),
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
    render(<BrainCanvas jobId="job-1" regions={[]} />);

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
