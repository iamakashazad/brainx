import { useEffect, useState } from "react";
import type { CircuitName } from "@/lib/api-types";
import { useJobStatus } from "@/features/run/useJobStatus";
import { useWizardStore } from "@/stores/wizardStore";
import { BrainCanvas } from "./BrainCanvas";
import { BrainPresetButtons } from "./BrainPresetButtons";
import { CircuitScoreBar } from "./CircuitScoreBar";
import { CircuitSelector } from "./CircuitSelector";
import { FlowContinuityChart } from "./FlowContinuityChart";
import { RecommendationsPanel } from "./RecommendationsPanel";
import { ROIScoreTable } from "./ROIScoreTable";
import { TimelineScrubber } from "./TimelineScrubber";

function getHighestCircuit(circuits: Record<CircuitName, { score: number }>) {
  return (Object.entries(circuits) as [CircuitName, { score: number }][]).reduce(
    (best, entry) => (entry[1].score > best[1].score ? entry : best),
  )[0];
}

export function ResultsLayout() {
  const jobId = useWizardStore((state) => state.jobId);
  const activeScreenIndex = useWizardStore((state) => state.activeScreenIndex);
  const activeCircuit = useWizardStore((state) => state.activeCircuit);
  const setActiveCircuit = useWizardStore((state) => state.setActiveCircuit);
  const setActiveScreenIndex = useWizardStore((state) => state.setActiveScreenIndex);
  const [activePreset, setActivePreset] = useState<"Lateral-L" | "Lateral-R" | "Superior" | "Anterior">("Lateral-L");
  const jobQuery = useJobStatus(jobId);
  const result = jobQuery.data?.result;

  useEffect(() => {
    if (activeCircuit !== null || !result?.roi[0]) {
      return;
    }
    setActiveCircuit(getHighestCircuit(result.roi[0].circuits));
  }, [activeCircuit, result, setActiveCircuit]);

  if (!result) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-lg">
        <p className="text-sm text-muted-foreground">Waiting for completed analysis results...</p>
      </div>
    );
  }

  const currentScreen = result.roi[activeScreenIndex] ?? result.roi[0]!;

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-foreground">Brain Analysis Results</h1>
        <p className="max-w-3xl text-base leading-7 text-muted-foreground">
          Explore the predicted brain response, scrub across screens, and inspect the evidence-backed recommendations alongside the activation view.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 p-2 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-5">
          <BrainCanvas jobId={jobId} regions={currentScreen.regions} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CircuitSelector circuits={currentScreen.circuits} />
            <BrainPresetButtons activePreset={activePreset} onPresetChange={setActivePreset} />
          </div>
          <TimelineScrubber
            screenCount={result.roi.length}
            value={activeScreenIndex}
            onChange={setActiveScreenIndex}
          />
        </div>

        <div className="space-y-5">
          {(Object.entries(currentScreen.circuits) as [CircuitName, { score: number }][]).map(
            ([circuit, values]) => (
              <CircuitScoreBar key={circuit} circuit={circuit} score={values.score} />
            ),
          )}
          <ROIScoreTable regions={currentScreen.regions} />
          <FlowContinuityChart continuity={result.flow_continuity} />
          <RecommendationsPanel recommendations={result.recommendations} />
        </div>
      </div>
    </section>
  );
}
