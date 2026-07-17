/**
 * RunningPage — "/analysis/:jobId/running"
 *
 * Ambient headline cycling through stage-specific copy.
 * Horizontal stage rail: 6 steps, active = brand green pulse, complete = checkmark.
 * Geist Mono elapsed timer bottom-left.
 * Queue position badge (hidden once RUNNING).
 * PENDING / RUNNING / ERROR states.
 * On DONE → auto-navigate to /analysis/:jobId/results
 *
 * Design tokens: brand, muted, destructive, font-mono, radius-full
 */

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, useParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Check, AlertTriangle, ArrowLeft, Square } from "lucide-react";
import { useJobStatus } from "@/features/run/useJobStatus";
import { useSubmitAnalyze } from "@/features/wizard/useSubmitAnalyze";
import { useWizardStore } from "@/stores/wizardStore";
import { deleteJob } from "@/lib/api";
import { AnalysisFailureCard } from "@/components/AnalysisFailureCard";
import type { JobStatus, StageValue } from "@/lib/api-types";

/* ── Stage configuration ──────────────────────────────────────────────── */

const STAGE_STEPS = [
  { key: "simulation",     label: "Simulating neural pathways…" },
  { key: "grounding_check", label: "Checking evidence chains…" },
  { key: "inference",      label: "Running activation inference…" },
  { key: "roi_aggregation", label: "Aggregating brain regions…" },
  { key: "processing",     label: "Processing results…" },
  { key: "recommendations", label: "Building recommendations…" },
] as const satisfies { key: StageValue; label: string }[];

const STAGE_INDEX: Record<StageValue, number> = {
  simulation: 0,
  grounding_check: 1,
  inference: 2,
  roi_aggregation: 3,
  processing: 4,
  recommendations: 5,
};

const LONG_RUNNING_AFTER_SECONDS = 120;
const POSSIBLY_STALLED_AFTER_SECONDS = 600;
const MAX_SERVER_AGE_SECONDS = 24 * 60 * 60;
const LONG_RUNNING_MESSAGE =
  "This step is taking longer than usual. Keep this page open; if the backend loses connection, this screen will switch to an error state.";
const POSSIBLY_STALLED_MESSAGE =
  "This has been running longer than expected. The backend timeout should report a failure shortly; if it stays here, restart the backend and try again with shorter content.";

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

function getActiveIndex(stage: StageValue | null, status: JobStatus): number {
  if (status === "DONE") return STAGE_STEPS.length;
  if (!stage || status === "PENDING") return -1;
  return STAGE_INDEX[stage] ?? 0;
}

function getAmbientLabel(stage: StageValue | null, status: JobStatus): string {
  if (status === "DONE") return "Analysis complete";
  if (status === "RUNNING" && !stage) return "Starting analysis…";
  if (status === "PENDING" || !stage) return "Queued — waiting to start…";
  const step = STAGE_STEPS.find((s) => s.key === stage);
  return step?.label ?? "Processing…";
}

/* ── Stage Rail ───────────────────────────────────────────────────────── */

function StageRail({
  stage,
  status,
}: {
  stage: StageValue | null;
  status: JobStatus;
}) {
  const activeIndex = getActiveIndex(stage, status);
  const isDone = status === "DONE";

  return (
    <div className="flex items-center gap-0 w-full max-w-2xl" role="list" aria-label="Analysis stages">
      {STAGE_STEPS.map((step, index) => {
        const isComplete = isDone ? true : index < activeIndex;
        const isActive = !isDone && index === activeIndex;
        const isLast = index === STAGE_STEPS.length - 1;

        return (
          <div key={step.key} className="flex items-center flex-1 min-w-0" role="listitem">
            <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
              <motion.span
                animate={isActive ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                transition={isActive ? { repeat: Infinity, duration: 1.4, ease: "easeInOut" } : {}}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold"
                style={{
                  background: isComplete
                    ? "var(--color-brand)"
                    : isActive
                      ? "var(--color-brand)"
                      : "var(--muted)",
                  color: isComplete || isActive
                    ? "var(--color-near-black)"
                    : "var(--muted-foreground)",
                  boxShadow: isActive
                    ? "0 0 0 4px var(--color-brand-light)"
                    : "none",
                }}
              >
                {isComplete ? <Check className="h-3 w-3" /> : index + 1}
              </motion.span>
            </div>
            {!isLast && (
              <div
                className="flex-1 h-px mx-1"
                style={{
                  background: isComplete ? "var(--color-brand)" : "var(--border-medium)",
                  transition: "background 300ms",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────── */

export function RunningPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const setJob = useWizardStore((s) => s.setJob);
  const selectedPersonaId = useWizardStore((s) => s.selectedPersonaId);
  const contentId = useWizardStore((s) => s.contentId);
  const retryMutation = useSubmitAnalyze();
  const stopMutation = useMutation({
    mutationFn: () => deleteJob(jobId!),
    onSuccess: () => {
      setJob(null);
      navigate("/analysis/new/content", { replace: true });
    },
  });

  // Sync jobId from URL into store (handles direct navigation / refresh)
  useEffect(() => {
    if (jobId) setJob(jobId);
  }, [jobId, setJob]);

  const jobQuery = useJobStatus(jobId ?? null);

  // Focus for screen readers
  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  // Auto-navigate on DONE
  useEffect(() => {
    if (jobQuery.data?.status === "DONE" && jobId) {
      navigate(`/analysis/${jobId}/results`, { replace: true });
    }
  }, [jobQuery.data?.status, jobId, navigate]);

  // Elapsed timer
  const isRunning =
    jobQuery.data?.status === "RUNNING" || jobQuery.data?.status === "PENDING";
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!isRunning) { setElapsed(0); return; }
    setElapsed(0);
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [isRunning]);

  if (!jobId) return null;

  const stage = jobQuery.data?.stage ?? null;
  const status = jobQuery.data?.status ?? "PENDING";
  const queuePosition = jobQuery.data?.queue_position ?? null;

  const shouldShowFailure =
    status === "ERROR" || (jobQuery.isError && !jobQuery.isFetching);

  if (shouldShowFailure) {
    return (
      <AnalysisFailureCard
        errorMessage={jobQuery.data?.error}
        stage={jobQuery.data?.stage}
        onRetry={() => {
          if (selectedPersonaId && contentId) {
            retryMutation.mutate();
            return;
          }
          navigate("/analysis/new/content");
        }}
        onBack={() => navigate("/analysis/new/content")}
      />
    );
  }

  const ambientLabel = getAmbientLabel(stage, status);
  const showQueueBadge =
    queuePosition !== null && queuePosition > 0 && status === "PENDING";
  const showRetryBanner = jobQuery.isError && jobQuery.isFetching;
  const serverAgeSeconds = recentServerAgeSeconds(jobQuery.data?.created_at);
  const displayElapsed = Math.max(elapsed, serverAgeSeconds ?? 0);
  const showLongRunningBanner = isRunning && displayElapsed >= LONG_RUNNING_AFTER_SECONDS;
  const isPossiblyStalled = isRunning && displayElapsed >= POSSIBLY_STALLED_AFTER_SECONDS;
  const backendStatusMessage = jobQuery.data?.status_message;

  const elapsedFormatted = `${String(Math.floor(displayElapsed / 60)).padStart(2, "0")}:${String(displayElapsed % 60).padStart(2, "0")}`;

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      role="status"
      aria-live="polite"
      aria-label="Analysis running"
      className="min-h-screen px-6 py-10 outline-none"
      style={{ background: "var(--background)" }}
    >
      <div className="mx-auto max-w-3xl space-y-12">

        {/* Back link */}
        <Link
          to="/analysis/new/content"
          className="inline-flex items-center gap-1.5 text-sm font-medium"
          style={{ color: "var(--muted-foreground)" }}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to content
        </Link>

        <div className="flex justify-end">
          <button
            type="button"
            disabled={stopMutation.isPending}
            onClick={() => stopMutation.mutate()}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              background: "transparent",
              color: "var(--destructive)",
              border: "1px solid var(--destructive)",
              borderRadius: "var(--radius-full)",
            }}
          >
            <Square className="h-3.5 w-3.5" />
            {stopMutation.isPending ? "Stopping…" : "Stop and delete"}
          </button>
        </div>

        {/* Retry banner */}
        {showRetryBanner && (
          <div
            className="rounded-2xl px-4 py-3 text-sm"
            style={{
              background: "var(--color-amber-bg)",
              border: "1px solid var(--color-amber)",
              color: "var(--color-amber)",
              borderRadius: "var(--radius)",
            }}
          >
            Lost connection to the server. Retrying…
          </div>
        )}

        {showLongRunningBanner && (
          <div
            className="flex items-start gap-3 rounded-2xl px-4 py-3 text-sm"
            style={{
              background: "var(--color-amber-bg)",
              border: "1px solid var(--color-amber)",
              color: "var(--color-amber)",
              borderRadius: "var(--radius)",
            }}
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="font-medium leading-6">
              {backendStatusMessage ?? (isPossiblyStalled ? POSSIBLY_STALLED_MESSAGE : LONG_RUNNING_MESSAGE)}
            </p>
          </div>
        )}

        {/* Ambient headline */}
        <div className="space-y-4">
          <p
            className="text-sm font-semibold uppercase tracking-widest"
            style={{
              color: "var(--muted-foreground)",
              fontFamily: "var(--font-mono)",
              letterSpacing: "0.6px",
            }}
          >
            BrainX Analysis
          </p>
          <AnimatePresence mode="wait">
            <motion.h1
              key={ambientLabel}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="font-semibold"
              style={{
                fontSize: "clamp(28px, 5vw, 40px)",
                letterSpacing: "-0.8px",
                lineHeight: "1.1",
                color: "var(--foreground)",
                maxWidth: "600px",
              }}
            >
              {ambientLabel}
            </motion.h1>
          </AnimatePresence>

          <div className="flex items-center gap-4">
            {/* Elapsed timer */}
            {isRunning && displayElapsed > 0 && (
              <p
                className="text-sm"
                style={{ color: "var(--muted-foreground)", fontFamily: "var(--font-mono)" }}
              >
                {elapsedFormatted} elapsed
              </p>
            )}

            {/* Queue position badge */}
            {showQueueBadge && (
              <span
                className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
                style={{
                  background: "var(--color-amber-bg)",
                  color: "var(--color-amber)",
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "0.6px",
                  borderRadius: "var(--radius-full)",
                  textTransform: "uppercase",
                }}
              >
                #{queuePosition} IN QUEUE
              </span>
            )}
            {stage === "inference" && jobQuery.data ? (
              <span
                className="text-sm"
                style={{ color: "var(--muted-foreground)", fontFamily: "var(--font-mono)" }}
              >
                {jobQuery.data.inference_processes} inference process(es)
                {jobQuery.data.stale_inference_processes > 0
                  ? `, ${jobQuery.data.stale_inference_processes} stale`
                  : ""}
              </span>
            ) : null}
          </div>
        </div>

        {/* Stage rail */}
        <StageRail stage={stage} status={status} />

      </div>
    </div>
  );
}
