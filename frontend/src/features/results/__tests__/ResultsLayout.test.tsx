import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWizardStore } from "@/stores/wizardStore";
import { ResultsLayout } from "../ResultsLayout";

vi.mock("../BrainCanvas", () => ({
  BrainCanvas: () => <div>BrainCanvas</div>,
}));

vi.mock("../TimelineScrubber", () => ({
  TimelineScrubber: () => <div>TimelineScrubber</div>,
}));

vi.mock("../CircuitSelector", () => ({
  CircuitSelector: () => <div>CircuitSelector</div>,
}));

vi.mock("../CircuitScoreBar", () => ({
  CircuitScoreBar: ({ circuit }: { circuit: string }) => <div>{`CircuitScoreBar:${circuit}`}</div>,
}));

vi.mock("../RecommendationsPanel", () => ({
  RecommendationsPanel: () => <div>RecommendationsPanel</div>,
}));

vi.mock("../ROIScoreTable", () => ({
  ROIScoreTable: () => <div>ROIScoreTable</div>,
}));

vi.mock("../FlowContinuityChart", () => ({
  FlowContinuityChart: () => <div>FlowContinuityChart</div>,
}));

vi.mock("@/features/run/useJobStatus", () => ({
  useJobStatus: () => ({
    data: {
      status: "DONE",
      result: {
        schema_version: 1,
        simulation: {},
        overlays: [],
        activations: [{ screen_index: 0, path: "activations/job-1/screen_1.npy", shape: [4, 20484], timesteps: 4 }],
        roi: [
          {
            screen_index: 0,
            circuits: {
              Attention: { score: 80, peak: 88 },
              "Cognitive Load": { score: 34, peak: 40 },
              "Emotional Response": { score: 21, peak: 25 },
              "Memory Encoding": { score: 56, peak: 60 },
              Reward: { score: 41, peak: 48 },
            },
            regions: [],
          },
        ],
        flow_continuity: {
          circuits: {
            Attention: { per_screen: [{ screen_index: 0, score_0_100: 80, delta_from_prev: 0 }], trend: "flat" },
            "Cognitive Load": { per_screen: [{ screen_index: 0, score_0_100: 34, delta_from_prev: 0 }], trend: "flat" },
            "Emotional Response": { per_screen: [{ screen_index: 0, score_0_100: 21, delta_from_prev: 0 }], trend: "flat" },
            "Memory Encoding": { per_screen: [{ screen_index: 0, score_0_100: 56, delta_from_prev: 0 }], trend: "flat" },
            Reward: { per_screen: [{ screen_index: 0, score_0_100: 41, delta_from_prev: 0 }], trend: "flat" },
          },
        },
        recommendations: [],
        pathway: { selected_pathway: "text", slideshow_path: null, durations: [] },
      },
    },
  }),
}));

describe("ResultsLayout", () => {
  beforeEach(() => {
    useWizardStore.setState({
      jobId: "job-1",
      activeScreenIndex: 0,
      activeCircuit: null,
      setActiveCircuit: vi.fn(),
    });
  });

  it("renders the brain-primary 3fr/2fr grid and the required results sections", () => {
    const { container } = render(<ResultsLayout />);

    expect(container.innerHTML).toContain("grid-cols-[3fr_2fr]");
    expect(screen.getByText("BrainCanvas")).toBeInTheDocument();
    expect(screen.getByText("TimelineScrubber")).toBeInTheDocument();
    expect(screen.getByText("CircuitSelector")).toBeInTheDocument();
    expect(screen.getByText("RecommendationsPanel")).toBeInTheDocument();
    expect(screen.getByText("ROIScoreTable")).toBeInTheDocument();
    expect(screen.getByText("FlowContinuityChart")).toBeInTheDocument();
    expect(screen.getAllByText(/^CircuitScoreBar:/)).toHaveLength(5);
  });

  it("renders the required titles and initializes the active circuit from the highest screen score", () => {
    render(<ResultsLayout />);

    expect(screen.getByRole("heading", { name: "Brain Analysis Results" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Recommendations" })).toBeInTheDocument();
    expect(useWizardStore.getState().setActiveCircuit).toHaveBeenCalledWith("Attention");
  });
});
