import { X } from "lucide-react";
import { Button, Surface } from "@/components/design-system";
import { ResultsLayout } from "@/features/results/ResultsLayout";
import { useDemoResult } from "./useDemoResult";

type DemoOverlayProps = {
  open: boolean;
  onClose: () => void;
};

export function DemoOverlay({ open, onClose }: DemoOverlayProps) {
  const demoQuery = useDemoResult(open);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto px-6 py-8"
      style={{ background: "var(--background)", color: "var(--foreground)" }}
      role="dialog"
      aria-modal="true"
      aria-label="Sample analysis"
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Button variant="ghost" onClick={onClose}>
            <span aria-hidden>←</span>
            Back to History
          </Button>
          <button
            type="button"
            aria-label="Close demo"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full"
            style={{
              border: "1px solid var(--border-medium)",
              color: "var(--muted-foreground)",
            }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {demoQuery.isLoading ? (
          <Surface className="p-8">
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              Loading sample analysis…
            </p>
          </Surface>
        ) : demoQuery.isError ? (
          <Surface className="p-8">
            <p className="text-sm font-medium" style={{ color: "var(--destructive)" }}>
              Could not load demo. Check that frontend/public/demo/result.json exists.
            </p>
          </Surface>
        ) : (
          <ResultsLayout resultOverride={demoQuery.data} jobIdOverride="demo" />
        )}
      </div>
    </div>
  );
}
