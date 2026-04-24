import type { CircuitName } from "@/lib/api-types";
import { CIRCUIT_CHART_TOKEN } from "./colorBuffer";

export function CircuitScoreBar({
  circuit,
  score,
}: {
  circuit: CircuitName;
  score: number;
}) {
  const token = CIRCUIT_CHART_TOKEN[circuit];

  return (
    <div className="space-y-2 rounded-2xl border border-border bg-card p-4 shadow-lg">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-semibold text-foreground">{circuit}</span>
        <span className="font-mono text-sm text-muted-foreground">{score.toFixed(1)}</span>
      </div>
      <div className="h-5 rounded-full bg-muted">
        <div
          className="h-5 rounded-full transition-[width] duration-400 ease-out"
          style={{
            width: `${score}%`,
            background: `linear-gradient(90deg, var(${token}) 0%, color-mix(in oklab, var(${token}) 40%, transparent) 100%)`,
          }}
        />
      </div>
    </div>
  );
}
