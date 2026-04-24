import type { CircuitName } from "@/lib/api-types";
import { NEUTRAL_BASE, getTokenColor } from "./oklchToLinear";

export const CIRCUIT_CHART_TOKEN: Record<CircuitName, string> = {
  Attention: "--chart-1",
  "Cognitive Load": "--chart-2",
  "Emotional Response": "--chart-3",
  "Memory Encoding": "--chart-4",
  Reward: "--chart-5",
};

export function computeColorBuffer({
  activations,
  circuitOfLabelIndex,
  vertexToLabelIndex,
  activeCircuit,
  peakColor,
  baseColor,
}: {
  activations: Float32Array;
  circuitOfLabelIndex: (string | null)[];
  vertexToLabelIndex: number[];
  activeCircuit: CircuitName;
  peakColor?: [number, number, number];
  baseColor?: [number, number, number];
}) {
  if (activations.length !== vertexToLabelIndex.length) {
    throw new Error(
      `Activation length ${activations.length} does not match vertex count ${vertexToLabelIndex.length}`,
    );
  }

  const base = baseColor ?? NEUTRAL_BASE;
  const peak = peakColor ?? getTokenColor(CIRCUIT_CHART_TOKEN[activeCircuit]);
  const inCircuit: number[] = [];

  for (let index = 0; index < activations.length; index += 1) {
    const labelIndex = vertexToLabelIndex[index];
    if (circuitOfLabelIndex[labelIndex] === activeCircuit) {
      inCircuit.push(activations[index]!);
    }
  }

  const sorted = [...inCircuit].sort((a, b) => a - b);
  const threshold = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.2)]! : 0;
  const maxValue = sorted.length > 0 ? sorted[sorted.length - 1]! : 1;
  const range = Math.max(maxValue - threshold, 1e-6);
  const buffer = new Float32Array(activations.length * 3);

  for (let index = 0; index < activations.length; index += 1) {
    const labelIndex = vertexToLabelIndex[index];
    const isActiveCircuit = circuitOfLabelIndex[labelIndex] === activeCircuit;
    const activation = activations[index]!;
    const offset = index * 3;

    if (!isActiveCircuit || activation < threshold) {
      buffer[offset] = base[0];
      buffer[offset + 1] = base[1];
      buffer[offset + 2] = base[2];
      continue;
    }

    const t = Math.min(1, Math.max(0, (activation - threshold) / range));
    buffer[offset] = base[0] + (peak[0] - base[0]) * t;
    buffer[offset + 1] = base[1] + (peak[1] - base[1]) * t;
    buffer[offset + 2] = base[2] + (peak[2] - base[2]) * t;
  }

  return buffer;
}
