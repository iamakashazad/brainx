import type { CircuitName, FlowContinuity } from "@/lib/api-types";
import { CIRCUIT_CHART_TOKEN } from "./colorBuffer";

const CIRCUITS = [
  "Attention",
  "Cognitive Load",
  "Emotional Response",
  "Memory Encoding",
  "Reward",
] as const satisfies CircuitName[];

function buildPath(points: { screen_index: number; score_0_100: number }[], width: number, height: number) {
  if (points.length === 0) {
    return "";
  }

  const maxX = Math.max(points.length - 1, 1);
  return points
    .map((point, index) => {
      const x = (point.screen_index / maxX) * width;
      const y = height - (point.score_0_100 / 100) * height;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

export function FlowContinuityChart({ continuity }: { continuity: FlowContinuity }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-lg">
      <h3 className="text-lg font-semibold text-foreground">Cognitive Arc</h3>
      <svg viewBox="0 0 320 140" className="mt-4 h-40 w-full">
        {CIRCUITS.map((circuit) => {
          const points = continuity.circuits[circuit]?.per_screen ?? [];
          const d = buildPath(points, 320, 140);
          return (
            <path
              key={circuit}
              d={d}
              fill="none"
              stroke={`var(${CIRCUIT_CHART_TOKEN[circuit]})`}
              strokeWidth="3"
              strokeDasharray="1"
              strokeDashoffset="0"
            />
          );
        })}
      </svg>
    </section>
  );
}
