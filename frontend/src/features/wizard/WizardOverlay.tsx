import { lazy, Suspense } from "react";
import { X } from "lucide-react";
import { useWizardStore } from "@/stores/wizardStore";

const WizardShell = lazy(() =>
  import("./WizardShell").then((module) => ({ default: module.WizardShell })),
);

type WizardOverlayProps = {
  open: boolean;
  onClose: () => void;
};

export function WizardOverlay({ open, onClose }: WizardOverlayProps) {
  const reset = useWizardStore((state) => state.reset);

  if (!open) {
    return null;
  }

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Analysis wizard"
      className="fixed inset-0 z-40 overflow-y-auto bg-background"
    >
      <button
        type="button"
        onClick={handleClose}
        aria-label="Close wizard and return to history"
        className="fixed right-6 top-6 z-50 inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-md transition hover:bg-accent hover:text-foreground"
      >
        <X className="h-5 w-5" />
      </button>
      <Suspense fallback={null}>
        <WizardShell />
      </Suspense>
    </div>
  );
}
