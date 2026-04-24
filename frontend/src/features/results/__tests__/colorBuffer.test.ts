import { describe, expect, it } from "vitest";
import { computeColorBuffer } from "../colorBuffer";

function buildVertexMap(labelIndex = 0) {
  return Array.from({ length: 20484 }, () => labelIndex);
}

describe("computeColorBuffer", () => {
  it("returns a 20484x3 buffer and colors only active-circuit vertices above threshold", () => {
    const activations = new Float32Array(20484).fill(0.05);
    activations[0] = 0.85;
    activations[1] = 0.9;
    activations[2] = 0.95;

    const vertexToLabelIndex = buildVertexMap(0);
    vertexToLabelIndex[0] = 1;
    vertexToLabelIndex[1] = 1;
    vertexToLabelIndex[2] = 1;
    vertexToLabelIndex[3] = 2;

    const result = computeColorBuffer({
      activations,
      circuitOfLabelIndex: [null, "Attention", "Reward"],
      vertexToLabelIndex,
      activeCircuit: "Attention",
      baseColor: [0.1, 0.2, 0.3],
      peakColor: [0.9, 0.8, 0.7],
    });

    expect(result).toHaveLength(20484 * 3);
    expect(Array.from(result.slice(0, 3))).not.toEqual([0.1, 0.2, 0.3]);
    expect(Array.from(result.slice(9, 12))).toEqual([0.1, 0.2, 0.3]);
  });

  it("uses the 20th percentile threshold to fall back to the neutral color", () => {
    const activations = new Float32Array(20484).fill(0);
    activations[0] = 0.1;
    activations[1] = 0.2;
    activations[2] = 0.3;
    activations[3] = 0.4;
    activations[4] = 0.5;

    const vertexToLabelIndex = buildVertexMap(0);
    vertexToLabelIndex[0] = 1;
    vertexToLabelIndex[1] = 1;
    vertexToLabelIndex[2] = 1;
    vertexToLabelIndex[3] = 1;
    vertexToLabelIndex[4] = 1;

    const result = computeColorBuffer({
      activations,
      circuitOfLabelIndex: [null, "Attention"],
      vertexToLabelIndex,
      activeCircuit: "Attention",
      baseColor: [0.11, 0.22, 0.33],
      peakColor: [0.91, 0.82, 0.73],
    });

    expect(Array.from(result.slice(0, 3))).toEqual([0.11, 0.22, 0.33]);
    expect(Array.from(result.slice(3, 6))).not.toEqual([0.11, 0.22, 0.33]);
  });
});
