import type { RegionScore } from "@/lib/api-types";
import { CIRCUIT_CHART_TOKEN } from "./colorBuffer";

function titleCase(value: string) {
  return value.replace(/[_-]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function ROIScoreTable({ regions }: { regions: RegionScore[] }) {
  const sorted = [...regions].sort((a, b) => b.score - a.score);

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-lg">
      <h3 className="text-lg font-semibold text-foreground">Region Activation Scores</h3>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-muted-foreground">
            <tr>
              <th className="pb-2">Region</th>
              <th className="pb-2">Circuit</th>
              <th className="pb-2">Score</th>
              <th className="pb-2">Peak</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((region, index) => (
              <tr key={`${region.atlas_label}-${index}`} className="odd:bg-muted/40">
                <td className="px-2 py-3 text-foreground">{titleCase(region.atlas_label)}</td>
                <td className="px-2 py-3">
                  <span
                    className="inline-flex rounded-full border border-border px-2 py-1 text-xs font-semibold"
                    style={{ color: `var(${CIRCUIT_CHART_TOKEN[region.circuit]})` }}
                  >
                    {region.circuit}
                  </span>
                </td>
                <td className="px-2 py-3 font-mono text-muted-foreground">
                  {region.score.toFixed(1)}
                </td>
                <td className="px-2 py-3 font-mono text-muted-foreground">
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
