import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWizardStore } from "@/stores/wizardStore";
import { RecommendationCard } from "../RecommendationCard";
import { withStableIds } from "../recommendationsByScreen";

const stableRecs = withStableIds([
  {
    rec_type: "copy_rewrite" as const,
    screen_index: 2,
    evidence: {
      circuit: "Attention" as const,
      region: "S_front_inf",
      activation_score: 74.3,
      score_rank: "High" as const,
    },
    before: "Buy now",
    after: "Start your free trial",
    rationale: "The CTA needs a clearer promise.",
  },
  {
    rec_type: "layout_flag" as const,
    screen_index: 2,
    evidence: {
      circuit: "Memory Encoding" as const,
      region: "G_oc-temp_med-Parahip",
      activation_score: 63.1,
      score_rank: "Moderate" as const,
    },
    rationale: "The CTA competes with the hero art.",
  },
]);

describe("RecommendationCard", () => {
  beforeEach(() => {
    useWizardStore.setState({
      activeRecId: null,
      activeScreenIndex: 0,
      activeCircuit: null,
      secondaryRecLocationCursor: 0,
      setActiveRecId: vi.fn(),
      setActiveScreenIndex: vi.fn(),
      setActiveCircuit: vi.fn(),
      bumpSecondaryCursor: vi.fn(),
    });
  });

  it("renders the grounding footer and copy rewrite before/after treatment", () => {
    render(<RecommendationCard rec={stableRecs[0]!} allRecs={stableRecs} />);

    expect(screen.getByText("Attention · S_front_inf · 74.3/100 · High")).toBeInTheDocument();
    expect(screen.getByText("Buy now")).toHaveClass("line-through");
    expect(screen.getByText("Start your free trial")).toBeInTheDocument();
  });

  it("dispatches active rec, screen, and circuit in order on first click", async () => {
    const user = userEvent.setup();
    const rec = stableRecs[0]!;

    render(<RecommendationCard rec={rec} allRecs={stableRecs} />);

    await user.click(screen.getByRole("button", { name: /Copy Rewrite/i }));

    const { setActiveRecId, setActiveScreenIndex, setActiveCircuit } = useWizardStore.getState();
    expect(setActiveRecId).toHaveBeenCalledWith(rec.id);
    expect(setActiveScreenIndex).toHaveBeenCalledWith(2);
    expect(setActiveCircuit).toHaveBeenCalledWith("Attention");
    expect((setActiveRecId as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0]).toBeLessThan(
      (setActiveScreenIndex as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0],
    );
    expect(
      (setActiveScreenIndex as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0],
    ).toBeLessThan((setActiveCircuit as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0]);
  });

  it("bumps the secondary cursor and cycles to the next same-screen recommendation on re-click", async () => {
    const user = userEvent.setup();
    const rec = stableRecs[0]!;
    useWizardStore.setState({
      activeRecId: rec.id,
      secondaryRecLocationCursor: 0,
    });

    render(<RecommendationCard rec={rec} allRecs={stableRecs} />);

    await user.click(screen.getByRole("button", { name: /Copy Rewrite/i }));

    expect(useWizardStore.getState().bumpSecondaryCursor).toHaveBeenCalledTimes(1);
    expect(useWizardStore.getState().setActiveRecId).toHaveBeenCalledWith(stableRecs[1]!.id);
    expect(useWizardStore.getState().setActiveScreenIndex).toHaveBeenCalledWith(2);
    expect(useWizardStore.getState().setActiveCircuit).toHaveBeenCalledWith("Memory Encoding");
  });
});
