import { describe, expect, it } from "vitest";
import type { Recommendation } from "@/lib/api-types";
import {
  cycleToSecondary,
  groupRecsByScreen,
  withStableIds,
} from "../recommendationsByScreen";

const baseRecommendations: Recommendation[] = [
  {
    rec_type: "copy_rewrite",
    screen_index: 0,
    evidence: {
      circuit: "Attention",
      region: "S_front_inf",
      activation_score: 74.3,
      score_rank: "High",
    },
    before: "Buy now",
    after: "Start your free trial",
    rationale: "Tighten the CTA.",
  },
  {
    rec_type: "layout_flag",
    screen_index: 2,
    evidence: {
      circuit: "Reward",
      region: "G_rectus",
      activation_score: 61.2,
      score_rank: "Moderate",
    },
    rationale: "The CTA is visually buried.",
  },
  {
    rec_type: "memorability",
    screen_index: 0,
    evidence: {
      circuit: "Memory Encoding",
      region: "G_oc-temp_med-Parahip",
      activation_score: 39.4,
      score_rank: "Low",
    },
    rationale: "The promise is easy to forget.",
  },
];

describe("recommendationsByScreen", () => {
  it("groups recommendations by screen index", () => {
    const recs = withStableIds(baseRecommendations);

    expect(groupRecsByScreen(recs)).toEqual({
      0: [recs[0], recs[2]],
      2: [recs[1]],
    });
  });

  it("cycles through same-screen recommendations with wraparound", () => {
    const sameScreen = withStableIds([
      baseRecommendations[0]!,
      {
        ...baseRecommendations[2]!,
        rec_type: "emotional_dropoff",
      },
      {
        ...baseRecommendations[2]!,
        rec_type: "layout_flag",
      },
    ]);

    expect(cycleToSecondary(sameScreen[0]!.id, 0, sameScreen)).toBe(sameScreen[1]);
    expect(cycleToSecondary(sameScreen[0]!.id, 1, sameScreen)).toBe(sameScreen[2]);
    expect(cycleToSecondary(sameScreen[0]!.id, 2, sameScreen)).toBe(sameScreen[0]);
  });

  it("returns the active recommendation when it has no same-screen peers", () => {
    const one = withStableIds([baseRecommendations[1]!]);
    expect(cycleToSecondary(one[0]!.id, 0, one)).toBe(one[0]);
  });
});
