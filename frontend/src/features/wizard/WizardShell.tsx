import { ContentTypeTabs } from "@/features/content/ContentTypeTabs";
import { PersonaLibrary } from "@/features/persona/PersonaLibrary";
import { useWizardStore } from "@/stores/wizardStore";
import { WizardStep } from "./WizardStep";
import { WizardStepper } from "./WizardStepper";
import { useSubmitAnalyze } from "./useSubmitAnalyze";

function getStepContent(step: 1 | 2 | 3 | 4) {
  switch (step) {
    case 1:
      return <PersonaLibrary />;
    case 2:
      return <ContentTypeTabs />;
    case 3:
      return <div className="text-sm text-muted-foreground">Run - delivered by plan 04-02</div>;
    case 4:
      return <div className="text-sm text-muted-foreground">Results - delivered by plan 04-03</div>;
    default:
      return null;
  }
}

export function WizardShell() {
  const currentStep = useWizardStore((state) => state.currentStep);
  const selectedPersonaId = useWizardStore((state) => state.selectedPersonaId);
  const contentId = useWizardStore((state) => state.contentId);
  const jobId = useWizardStore((state) => state.jobId);
  const setStep = useWizardStore((state) => state.setStep);
  const submitAnalyzeMutation = useSubmitAnalyze();

  const canNavigateToStep = (step: 1 | 2 | 3 | 4) => {
    if (step === 1) {
      return true;
    }

    if (step === 2) {
      return Boolean(selectedPersonaId);
    }

    if (step === 3) {
      return Boolean(contentId);
    }

    return Boolean(jobId);
  };

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <WizardStepper
          currentStep={currentStep}
          canNavigateToStep={canNavigateToStep}
          onStepChange={setStep}
        />
        <WizardStep>{getStepContent(currentStep)}</WizardStep>
        {currentStep === 1 ? (
          <div className="flex justify-end">
            <button
              type="button"
              disabled={!selectedPersonaId}
              onClick={() => setStep(2)}
              className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-md transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next: Add Content
            </button>
          </div>
        ) : null}
        {currentStep === 2 ? (
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="inline-flex items-center justify-center rounded-lg border border-border bg-card px-5 py-3 text-sm font-semibold text-card-foreground shadow-md transition hover:bg-accent"
            >
              Back to Persona
            </button>
            <button
              type="button"
              disabled={!selectedPersonaId || !contentId || submitAnalyzeMutation.isPending}
              onClick={() => submitAnalyzeMutation.mutate()}
              className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-md transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
            >
              Analyze Content
            </button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
