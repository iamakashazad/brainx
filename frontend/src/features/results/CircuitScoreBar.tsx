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
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "16px",
        boxShadow: "var(--shadow)",
      }}
    >
      <div className="flex items-center justify-between gap-4 mb-3">
        <span
          className="text-sm font-medium"
          style={{ color: "var(--foreground)" }}
        >
          {circuit}
        </span>
        <span
          className="text-sm font-semibold"
          style={{ color: "var(--muted-foreground)", fontFamily: "var(--font-mono)" }}
        >
          {score.toFixed(1)}
        </span>
      </div>
      <div
        className="h-2 rounded-full overflow-hidden"
        style={{ background: "var(--muted)" }}
      >
        <div
          className="h-2 rounded-full transition-[width] duration-500 ease-out"
          style={{
            width: `${score}%`,
            background: `linear-gradient(90deg, var(${token}) 0%, color-mix(in oklab, var(${token}) 40%, transparent) 100%)`,
          }}
        />
      </div>
    </div>
  );
}
