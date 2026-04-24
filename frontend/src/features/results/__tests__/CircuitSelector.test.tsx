import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWizardStore } from "@/stores/wizardStore";
import { CircuitSelector } from "../CircuitSelector";

describe("CircuitSelector", () => {
  beforeEach(() => {
    const setActiveCircuit = vi.fn();
    useWizardStore.setState({
      activeScreenIndex: 0,
      activeCircuit: "Attention",
      setActiveCircuit,
    });
  });

  it("renders five circuit toggles and dispatches the selected circuit", async () => {
    const user = userEvent.setup();

    render(
      <CircuitSelector
        circuits={{
          Attention: { score: 50, peak: 60 },
          "Cognitive Load": { score: 45, peak: 55 },
          "Emotional Response": { score: 40, peak: 50 },
          "Memory Encoding": { score: 35, peak: 45 },
          Reward: { score: 30, peak: 40 },
        }}
      />,
    );

    expect(screen.getAllByRole("radio")).toHaveLength(5);
    expect(screen.getByRole("radio", { name: "Attention" })).toHaveAttribute("aria-checked", "true");

    await user.click(screen.getByRole("radio", { name: "Memory Encoding" }));

    expect(useWizardStore.getState().setActiveCircuit).toHaveBeenCalledWith("Memory Encoding");
  });
});
