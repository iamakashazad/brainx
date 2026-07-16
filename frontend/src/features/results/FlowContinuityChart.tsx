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
  if (points.length < 2) return "";
  const maxX = points.length - 1;
  return points
    .map((point, index) => {
      const x = (index / maxX) * width;
      const y = height - (point.score_0_100 / 100) * height;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

function getPointCoords(
  point: { screen_index: number; score_0_100: number },
  index: number,
  total: number,
  width: number,
  height: number,
) {
  const x = total === 1 ? width / 2 : (index / (total - 1)) * width;
  const y = height - (point.score_0_100 / 100) * height;
  return { x, y };
}

export function FlowContinuityChart({ continuity }: { continuity: FlowContinuity }) {
  const hasAnyData = CIRCUITS.some((c) => (continuity.circuits[c]?.per_screen.length ?? 0) > 0);

  return (
    <section
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "20px",
        boxShadow: "var(--shadow)",
      }}
    >
      <h3
        className="font-semibold mb-4"
        style={{ fontSize: "15px", letterSpacing: "-0.2px", color: "var(--foreground)" }}
      >
        Cognitive Arc
      </h3>
      {!hasAnyData ? (
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          No flow continuity data available.
        </p>
      ) : (
        <svg viewBox="0 0 320 140" className="h-40 w-full overflow-visible">
          {CIRCUITS.map((circuit) => {
            const points = continuity.circuits[circuit]?.per_screen ?? [];
            if (points.length === 0) return null;
            const color = `var(${CIRCUIT_CHART_TOKEN[circuit]})`;
            const d = buildPath(points, 320, 140);
            return (
              <g key={circuit}>
                {d && (
                  <path
                    d={d}
                    fill="none"
                    stroke={color}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
                {points.map((point, i) => {
                  const { x, y } = getPointCoords(point, i, points.length, 320, 140);
                  return (
                    <circle
                      key={i}
                      cx={x}
                      cy={y}
                      r={points.length === 1 ? 5 : 3}
                      fill={color}
                    />
                  );
                })}
              </g>
            );
          })}
        </svg>
      )}

      {/* Legend */}
      {hasAnyData && (
        <div className="mt-3 flex flex-wrap gap-3">
          {CIRCUITS.filter((c) => (continuity.circuits[c]?.per_screen.length ?? 0) > 0).map((circuit) => (
            <div key={circuit} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: `var(${CIRCUIT_CHART_TOKEN[circuit]})` }}
              />
              <span
                className="text-xs"
                style={{ color: "var(--muted-foreground)" }}
              >
                {circuit}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
