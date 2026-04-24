import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CircuitScoreBar } from "../CircuitScoreBar";

describe("CircuitScoreBar", () => {
  it("maps all five circuits to the locked chart tokens and uses the mono score style", () => {
    const circuits = [
      "Attention",
      "Cognitive Load",
      "Emotional Response",
      "Memory Encoding",
      "Reward",
    ] as const;

    const { container } = render(
      <div>
        {circuits.map((circuit) => (
          <CircuitScoreBar key={circuit} circuit={circuit} score={77} />
        ))}
      </div>,
    );

    expect(screen.getByText("Attention")).toBeInTheDocument();
    expect(container.innerHTML).toContain("--chart-1");
    expect(container.innerHTML).toContain("--chart-2");
    expect(container.innerHTML).toContain("--chart-3");
    expect(container.innerHTML).toContain("--chart-4");
    expect(container.innerHTML).toContain("--chart-5");
    expect(container.innerHTML).toContain("font-mono");
  });

  it("renders the numeric score in a mono element", () => {
    const { container } = render(<CircuitScoreBar circuit="Attention" score={77} />);

    expect(screen.getByText("77.0")).toBeInTheDocument();
    expect(container.querySelector(".font-mono")).not.toBeNull();
  });
});
