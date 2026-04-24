import { useEffect } from "react";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import type { CircuitName, CircuitScore } from "@/lib/api-types";
import { useWizardStore } from "@/stores/wizardStore";

const CIRCUITS = [
  "Attention",
  "Cognitive Load",
  "Emotional Response",
  "Memory Encoding",
  "Reward",
] as const satisfies CircuitName[];

type CircuitSelectorProps = {
  circuits: Record<CircuitName, CircuitScore>;
};

export function CircuitSelector({ circuits }: CircuitSelectorProps) {
  const activeCircuit = useWizardStore((state) => state.activeCircuit);
  const setActiveCircuit = useWizardStore((state) => state.setActiveCircuit);

  useEffect(() => {
    if (activeCircuit !== null) {
      return;
    }

    let highest: CircuitName = "Attention";
    let highestScore = Number.NEGATIVE_INFINITY;
    for (const circuit of CIRCUITS) {
      const score = circuits[circuit]?.score ?? 0;
      if (score > highestScore) {
        highest = circuit;
        highestScore = score;
      }
    }
    setActiveCircuit(highest);
  }, [activeCircuit, circuits, setActiveCircuit]);

  return (
    <ToggleGroup.Root
      type="single"
      value={activeCircuit ?? ""}
      onValueChange={(value) => {
        if (value) {
          setActiveCircuit(value as CircuitName);
        }
      }}
      className="flex flex-wrap gap-2"
      aria-label="Circuit selector"
    >
      {CIRCUITS.map((circuit) => (
        <ToggleGroup.Item
          key={circuit}
          value={circuit}
          className="rounded-xl border border-border bg-card px-3 py-2 font-mono text-sm text-card-foreground transition data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          {circuit}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
