import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ROIScoreTable } from "../ROIScoreTable";

describe("ROIScoreTable", () => {
  it("sorts rows by descending score", () => {
    render(
      <ROIScoreTable
        regions={[
          { atlas_label: "region low", circuit: "Attention", score: 50, peak: 55 },
          { atlas_label: "region high", circuit: "Reward", score: 90, peak: 95 },
          { atlas_label: "region tiny", circuit: "Cognitive Load", score: 10, peak: 20 },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Region Activation Scores" })).toBeInTheDocument();

    const rows = within(screen.getByRole("table")).getAllByRole("row");
    expect(rows[1]).toHaveTextContent("Region High");
    expect(rows[2]).toHaveTextContent("Region Low");
    expect(rows[3]).toHaveTextContent("Region Tiny");
  });
});
