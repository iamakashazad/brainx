import type { RegionScore } from "@/lib/api-types";
import { CIRCUIT_CHART_TOKEN } from "./colorBuffer";

function titleCase(value: string) {
  return value.replace(/[_-]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function ROIScoreTable({ regions }: { regions: RegionScore[] }) {
  const sorted = [...regions].sort((a, b) => b.score - a.score);

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
        Region Activation Scores
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              {["Region", "Circuit", "Score", "Peak"].map((col) => (
                <th
                  key={col}
                  className="pb-3 text-xs font-semibold uppercase tracking-wider"
                  style={{
                    color: "var(--muted-foreground)",
                    fontFamily: "var(--font-mono)",
                    letterSpacing: "0.6px",
                  }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((region, index) => (
              <tr
                key={`${region.atlas_label}-${index}`}
                style={{
                  borderTop: index > 0 ? "1px solid var(--border)" : "none",
                }}
              >
                <td
                  className="py-2.5 pr-4"
                  style={{ color: "var(--foreground)" }}
                >
                  {titleCase(region.atlas_label)}
                </td>
                <td className="py-2.5 pr-4">
                  <span
                    className="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold"
                    style={{
                      color: `var(${CIRCUIT_CHART_TOKEN[region.circuit]})`,
                      background: "var(--muted)",
                      borderRadius: "var(--radius-full)",
                    }}
                  >
                    {region.circuit}
                  </span>
                </td>
                <td
                  className="py-2.5 pr-4"
                  style={{ color: "var(--muted-foreground)", fontFamily: "var(--font-mono)" }}
                >
                  {region.score.toFixed(1)}
                </td>
                <td
                  className="py-2.5"
                  style={{ color: "var(--muted-foreground)", fontFamily: "var(--font-mono)" }}
                >
                  {region.peak.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
