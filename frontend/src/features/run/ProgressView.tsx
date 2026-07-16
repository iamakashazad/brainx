import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, RotateCcw, Square } from "lucide-react";
import { QueueBadge } from "./QueueBadge";
import { ProgressSummary } from "./ProgressSummary";
import { StageIndicator } from "./StageIndicator";
import { useJobRehydrate } from "./useJobRehydrate";
import { useJobStatus } from "./useJobStatus";
import { deleteJob } from "@/lib/api";
import { useWizardStore } from "@/stores/wizardStore";
import {
  DISPLAY_FAILED_HEADING,
  DISPLAY_QUEUED,
  displayFailureBodyFor,
  displayStage,
} from "@/lib/stageLabels";

const LONG_RUNNING_AFTER_SECONDS = 120;
const POSSIBLY_STALLED_AFTER_SECONDS = 600;
const MAX_SERVER_AGE_SECONDS = 24 * 60 * 60;
const LONG_RUNNING_MESSAGE =
  "This step is taking longer than usual. Keep this page open; if the backend loses connection, this screen will switch to an error state.";
const POSSIBLY_STALLED_MESSAGE =
  "This has been running longer than expected. The backend timeout should report a failure shortly; if it stays here, restart the backend and try again with shorter content.";

type FailureStateProps = {
  errorMessage?: string | null;
  onRetry: () => void;
  onGoBack: () => void;
};

function recentServerAgeSeconds(createdAt: string | null | undefined): number | null {
  if (!createdAt) return null;

  const normalizedCreatedAt = /(?:Z|[+-]\d{2}:?\d{2})$/.test(createdAt)
    ? createdAt
    : `${createdAt.replace(" ", "T")}Z`;
  const createdAtMs = Date.parse(normalizedCreatedAt);
  if (!Number.isFinite(createdAtMs)) return null;

  const ageSeconds = Math.floor((Date.now() - createdAtMs) / 1000);
  if (ageSeconds < 0 || ageSeconds > MAX_SERVER_AGE_SECONDS) return null;

  return ageSeconds;
}

function FailureState({ errorMessage, onRetry, onGoBack }: FailureStateProps) {
  const body = displayFailureBodyFor(errorMessage);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8 text-foreground">
      <div className="w-full max-w-xl rounded-3xl border border-border bg-card p-8 shadow-xl">
        <div className="flex items-start gap-4">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-6 w-6" />
          </span>
          <div className="space-y-3">
            <h2 className="text-3xl font-semibold">{DISPLAY_FAILED_HEADING}</h2>
            <p className="text-base leading-7 text-muted-foreground">{body}</p>
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
  const setJob = useWizardStore((state) => state.setJob);
  const containerRef = useRef<HTMLDivElement>(null);
  const { isRehydrating, resolvedStatus } = useJobRehydrate();
  const jobQuery = useJobStatus(isRehydrating ? null : jobId);
  const stopMutation = useMutation({
    mutationFn: () => deleteJob(jobId!),
    onSuccess: () => {
      setJob(null);
      setStep(2);
    },
  });

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isRehydrating && resolvedStatus !== "DONE" && jobQuery.data?.status === "DONE") {
      setStep(4);
    }
  }, [isRehydrating, jobQuery.data?.status, resolvedStatus, setStep]);

  const isRunning =
    jobQuery.data?.status === "RUNNING" || jobQuery.data?.status === "PENDING";
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!isRunning) {
      setElapsed(0);
      return;
    }
    setElapsed(0);
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [isRunning]);

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
        errorMessage={jobQuery.data?.error}
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

  const showRetryBanner = jobQuery.isError && jobQuery.isFetching;
  const serverAgeSeconds = recentServerAgeSeconds(jobQuery.data?.created_at);
  const displayElapsed = Math.max(elapsed, serverAgeSeconds ?? 0);
  const showLongRunningBanner = isRunning && displayElapsed >= LONG_RUNNING_AFTER_SECONDS;
  const isPossiblyStalled = isRunning && displayElapsed >= POSSIBLY_STALLED_AFTER_SECONDS;
  const backendStatusMessage = jobQuery.data?.status_message;
  const elapsedMinutes = String(Math.floor(displayElapsed / 60)).padStart(2, "0");
  const elapsedSeconds = String(displayElapsed % 60).padStart(2, "0");

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
        {showLongRunningBanner ? (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 shadow-md dark:text-amber-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="font-semibold leading-6">
              {backendStatusMessage ?? (isPossiblyStalled ? POSSIBLY_STALLED_MESSAGE : LONG_RUNNING_MESSAGE)}
            </p>
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
          {isRunning && displayElapsed > 0 ? (
            <p className="text-sm font-mono text-muted-foreground">
              {elapsedMinutes}:{elapsedSeconds} elapsed
            </p>
          ) : null}
          {jobQuery.data?.stage === "inference" ? (
            <p className="text-sm font-mono text-muted-foreground">
              {jobQuery.data.inference_processes} inference process(es)
              {jobQuery.data.stale_inference_processes > 0
                ? `, ${jobQuery.data.stale_inference_processes} stale`
                : ""}
            </p>
          ) : null}
          {isRunning ? (
            <button
              type="button"
              disabled={stopMutation.isPending}
              onClick={() => stopMutation.mutate()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-destructive px-4 py-2 text-sm font-semibold text-destructive transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Square className="h-4 w-4" />
              {stopMutation.isPending ? "Stopping…" : "Stop and delete"}
            </button>
          ) : null}
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
