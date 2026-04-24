import { Check } from "lucide-react";

const steps = [
  { label: "Persona", value: 1 },
  { label: "Content", value: 2 },
  { label: "Run", value: 3 },
  { label: "Results", value: 4 },
] as const;

type WizardStepperProps = {
  currentStep: 1 | 2 | 3 | 4;
  canNavigateToStep: (step: 1 | 2 | 3 | 4) => boolean;
  onStepChange: (step: 1 | 2 | 3 | 4) => void;
};

export function WizardStepper({
  currentStep,
  canNavigateToStep,
  onStepChange,
}: WizardStepperProps) {
  return (
    <nav aria-label="Wizard steps" className="rounded-2xl border border-border bg-card p-4 shadow-lg">
      <ol className="grid gap-3 md:grid-cols-4">
        {steps.map((step) => {
          const isCurrent = currentStep === step.value;
          const isComplete = step.value < currentStep;
          const isAccessible = canNavigateToStep(step.value);

          return (
            <li key={step.label}>
              <button
                type="button"
                disabled={!isAccessible}
                onClick={() => onStepChange(step.value)}
                className="flex w-full items-center gap-3 rounded-xl border border-border px-4 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span
                  className={[
                    "inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold",
                    isCurrent || isComplete
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-muted text-muted-foreground",
                  ].join(" ")}
                >
                  {isComplete ? <Check className="h-4 w-4" /> : step.value}
                </span>
                <span className="text-sm font-semibold text-foreground">{step.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
