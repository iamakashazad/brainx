import { useEffect, useRef } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { QueueBadge } from "./QueueBadge";
import { ProgressSummary } from "./ProgressSummary";
import { StageIndicator } from "./StageIndicator";
import { useJobRehydrate } from "./useJobRehydrate";
import { useJobStatus } from "./useJobStatus";
import { useWizardStore } from "@/stores/wizardStore";
import {
  DISPLAY_FAILED_BODY,
  DISPLAY_FAILED_HEADING,
  DISPLAY_QUEUED,
  displayStage,
} from "@/lib/stageLabels";

type FailureStateProps = {
  onRetry: () => void;
  onGoBack: () => void;
};

function FailureState({ onRetry, onGoBack }: FailureStateProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8 text-foreground">
      <div className="w-full max-w-xl rounded-3xl border border-border bg-card p-8 shadow-xl">
        <div className="flex items-start gap-4">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-6 w-6" />
          </span>
          <div className="space-y-3">
            <h2 className="text-3xl font-semibold">{DISPLAY_FAILED_HEADING}</h2>
            <p className="text-base leading-7 text-muted-foreground">{DISPLAY_FAILED_BODY}</p>
          </div>
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-md transition hover:shadow-lg"
          >
            <RotateCcw className="h-4 w-4" />
            Try Again
          </button>
          <button
            type="button"
            onClick={onGoBack}
            className="inline-flex items-center justify-center rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold text-card-foreground shadow-md transition hover:bg-accent"
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}

export function ProgressView() {
  const jobId = useWizardStore((state) => state.jobId);
  const setStep = useWizardStore((state) => state.setStep);
  const containerRef = useRef<HTMLDivElement>(null);
  const { isRehydrating, resolvedStatus } = useJobRehydrate();
  const jobQuery = useJobStatus(isRehydrating ? null : jobId);

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isRehydrating && resolvedStatus !== "DONE" && jobQuery.data?.status === "DONE") {
      setStep(4);
    }
  }, [isRehydrating, jobQuery.data?.status, resolvedStatus, setStep]);

  if (!jobId) {
    return null;
  }

  const shouldShowFailure =
    resolvedStatus === "ERROR" ||
    jobQuery.data?.status === "ERROR" ||
    (jobQuery.isError && !jobQuery.isFetching);

  if (shouldShowFailure) {
    return (
      <FailureState
        onRetry={() => {
          setStep(3);
          void jobQuery.refetch();
        }}
        onGoBack={() => setStep(2)}
      />
    );
  }

  const stageLabel = jobQuery.data
    ? displayStage(jobQuery.data.stage, jobQuery.data.status)
    : DISPLAY_QUEUED;

  const showRetryBanner = jobQuery.isFetching && jobQuery.failureCount > 0;

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 overflow-y-auto bg-background px-4 py-8 text-foreground outline-none"
    >
      <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col justify-center gap-8">
        {showRetryBanner ? (
          <div className="rounded-2xl border border-border bg-card px-4 py-3 text-sm font-semibold text-muted-foreground shadow-md">
            Lost connection to the server. Retrying…
          </div>
        ) : null}
        <div className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            BrainX Run
          </p>
          <h2 className="max-w-3xl text-3xl font-semibold leading-tight md:text-5xl">
            {stageLabel}
          </h2>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground">
            Your analysis is running against the live backend pipeline. This screen stays active
            until the job finishes or fails.
          </p>
        </div>
        <StageIndicator
          stage={jobQuery.data?.stage ?? null}
          status={jobQuery.data?.status ?? "PENDING"}
        />
        <QueueBadge position={jobQuery.data?.queue_position ?? null} />
        <ProgressSummary />
      </div>
    </div>
  );
}
