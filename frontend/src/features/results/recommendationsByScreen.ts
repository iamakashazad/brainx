import type { Recommendation } from "@/lib/api-types";

export type RecWithId = Recommendation & { id: string };

export function withStableIds(recommendations: Recommendation[]): RecWithId[] {
  return recommendations.map((recommendation, index) => ({
    ...recommendation,
    id: `${recommendation.screen_index}-${recommendation.rec_type}-${index}`,
  }));
}

export function groupRecsByScreen(recommendations: RecWithId[]) {
  return recommendations.reduce<Record<number, RecWithId[]>>((acc, recommendation) => {
    const key = recommendation.screen_index;
    acc[key] = acc[key] ?? [];
    acc[key].push(recommendation);
    return acc;
  }, {});
}

export function cycleToSecondary(
  activeRecId: string,
  cursor: number,
  sameScreenGroup: RecWithId[],
) {
  if (sameScreenGroup.length <= 1) {
    return sameScreenGroup[0]!;
  }

  const activeIndex = sameScreenGroup.findIndex((recommendation) => recommendation.id === activeRecId);
  const nextIndex = (activeIndex + 1 + cursor) % sameScreenGroup.length;
  return sameScreenGroup[nextIndex]!;
}
