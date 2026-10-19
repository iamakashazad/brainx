/**
 * AnalysisFailureCard
 *
 * Shared terminal-error card for a failed analysis job.
 * Used by RunningPage (live failure) and ResultsPage (opening an ERROR session).
 *
 * Design tokens: card, border, radius-lg, color-error, primary, radius-full
 */

import { AlertTriangle, RotateCcw } from "lucide-react";
import { displayFailureBodyFor } from "@/lib/stageLabels";
import type { StageValue } from "@/lib/api-types";

export function AnalysisFailureCard({
  errorMessage,
  stage,
  retryError,
  onRetry,
  onBack,
  backLabel = "Go Back",
}: {
  errorMessage?: string | null;
  stage?: StageValue | null;
  /** Why the last "Try Again" itself failed (e.g. queue full), if it did. */
  retryError?: string | null;
  onRetry: () => void;
  onBack: () => void;
  backLabel?: string;
}) {
  const body = displayFailureBodyFor(errorMessage, stage);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div
        className="w-full max-w-xl"
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          padding: "40px",
          boxShadow: "var(--shadow-md)",
        }}
      >
        <div className="flex items-start gap-4">
          <span
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            style={{ background: "var(--color-error-bg)", color: "var(--color-error)" }}
          >
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div className="space-y-2">
            <h2
              className="font-semibold"
              style={{ fontSize: "20px", letterSpacing: "-0.2px", color: "var(--foreground)" }}
            >
              Analysis failed
            </h2>
            <p className="text-sm" style={{ color: "var(--muted-foreground)", lineHeight: "1.6" }}>
              {body}
            </p>
          </div>
        </div>
        {retryError ? (
          <p role="alert" className="mt-4 text-sm font-medium" style={{ color: "var(--color-error)" }}>
            {`Retry failed: ${retryError}`}
          </p>
        ) : null}
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition"
            style={{
              background: "var(--primary)",
              color: "var(--primary-foreground)",
              borderRadius: "var(--radius-full)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Try Again
          </button>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center rounded-full px-5 py-2.5 text-sm font-medium transition"
            style={{
              background: "transparent",
              color: "var(--foreground)",
              border: "1px solid var(--border-medium)",
              borderRadius: "var(--radius-full)",
            }}
          >
            {backLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
