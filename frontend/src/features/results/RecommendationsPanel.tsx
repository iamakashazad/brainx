import type { Recommendation } from "@/lib/api-types";
import { RecommendationCard } from "./RecommendationCard";
import { groupRecsByScreen, withStableIds } from "./recommendationsByScreen";

export function RecommendationsPanel({
  recommendations,
}: {
  recommendations: Recommendation[];
}) {
  const stable = withStableIds(recommendations);
  const grouped = groupRecsByScreen(stable);
  const screens = Object.keys(grouped)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-lg">
      <h2 className="text-2xl font-semibold text-foreground">Recommendations</h2>
      <div className="mt-4 max-h-[60vh] space-y-6 overflow-y-auto pr-2">
        {screens.map((screenIndex) => (
          <div key={screenIndex} className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {`Screen ${screenIndex + 1}`}
            </h3>
            <div className="space-y-3">
              {grouped[screenIndex]!.map((recommendation) => (
                <RecommendationCard
                  key={recommendation.id}
                  rec={recommendation}
                  allRecs={stable}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
