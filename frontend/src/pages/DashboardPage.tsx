/**
 * DashboardPage — "/"
 *
 * First-time empty: full atmospheric hero with brand-green gradient wash.
 * After 3+ sessions: hero collapses, session grid dominates.
 *
 * Session grid: 3-col desktop / 2-col tablet / 1-col mobile.
 * SessionCards are fully restyled to Mintlify design tokens.
 *
 * Loading: 3 shimmer skeleton cards.
 * Error: inline error with retry.
 */

import { motion } from "framer-motion";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, StatusBadge, Surface } from "@/components/design-system";
import { DemoCard } from "@/features/history/DemoCard";
import { DemoOverlay } from "@/features/history/DemoOverlay";
import { useJobHistory } from "@/features/history/useJobHistory";
import { usePersonasQuery } from "@/features/persona/usePersonas";
import { useWizardStore } from "@/stores/wizardStore";
import type { JobSummary } from "@/lib/api-types";

/* ── Session Card ─────────────────────────────────────────────────────── */

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function SessionCard({
  job,
  personaName,
  onOpen,
}: {
  job: JobSummary;
  personaName: string;
  onOpen: (jobId: string) => void;
}) {
  return (
    <motion.button
      type="button"
      data-testid="session-card"
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className="w-full text-left transition"
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "24px",
        boxShadow: "var(--shadow)",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--border-medium)";
        (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-md)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
        (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow)";
      }}
      onClick={() => onOpen(job.job_id)}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
          <h3
            className="truncate text-base font-semibold"
            style={{ color: "var(--foreground)", letterSpacing: "-0.2px" }}
          >
            {personaName}
          </h3>
          <p
            className="text-sm"
            style={{ color: "var(--muted-foreground)", fontFamily: "var(--font-mono)" }}
          >
            {formatDate(job.created_at)}
          </p>
        </div>
        <StatusBadge status={job.status} />
      </div>
    </motion.button>
  );
}

/* ── Skeleton Card ────────────────────────────────────────────────────── */

function SkeletonCard() {
  return (
    <Surface
      className="animate-pulse"
      style={{
        padding: "24px",
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          <div
            className="h-4 rounded-full"
            style={{ width: "60%", background: "var(--muted)" }}
          />
          <div
            className="h-3 rounded-full"
            style={{ width: "40%", background: "var(--muted)" }}
          />
        </div>
        <div
          className="h-5 w-20 rounded-full"
          style={{ background: "var(--muted)" }}
        />
      </div>
    </Surface>
  );
}

/* ── Hero Section ─────────────────────────────────────────────────────── */

function HeroSection({ onStart }: { onStart: () => void }) {
  return (
    <div
      className="relative overflow-hidden"
      style={{
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--border)",
        padding: "96px 48px",
        textAlign: "center",
        background: `
          radial-gradient(ellipse 80% 60% at 50% -10%,
            rgba(24, 226, 153, 0.18) 0%,
            rgba(24, 226, 153, 0.06) 40%,
            transparent 70%
          ),
          var(--card)
        `,
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="mx-auto max-w-2xl space-y-5"
      >
        <h1
          className="font-semibold"
          style={{
            fontSize: "40px",
            lineHeight: "1.10",
            letterSpacing: "-0.8px",
            color: "var(--foreground)",
          }}
        >
          See your product through the brain
        </h1>
        <p
          style={{
            fontSize: "18px",
            lineHeight: "1.50",
            color: "var(--color-gray-500)",
            fontWeight: 400,
          }}
        >
          Predict how human brains respond to your UI — before you ship.
        </p>
        <div className="flex justify-center pt-2">
          <Button onClick={onStart} className="px-6">
            Start your first analysis
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────── */

export function DashboardPage() {
  const navigate = useNavigate();
  const [isDemoOpen, setIsDemoOpen] = useState(false);
  const jobsQuery = useJobHistory();
  const personasQuery = usePersonasQuery();

  const jobs = jobsQuery.data ?? [];
  const personaNameById = new Map(
    (personasQuery.data ?? []).map((p) => [p.id, p.name]),
  );

  const showHero = !jobsQuery.isLoading && jobs.length === 0;
  const showCollapsedHeader = jobs.length >= 3;

  const resetWizard = useWizardStore((s) => s.reset);
  const handleNewAnalysis = () => {
    resetWizard();
    navigate("/analysis/new");
  };
  const handleOpenSession = (jobId: string) =>
    navigate(`/analysis/${jobId}/results`);

  return (
    <div
      className="min-h-screen px-6 py-10"
      style={{ background: "var(--background)" }}
    >
      <div className="mx-auto max-w-5xl space-y-8">

        {/* Collapsed header (after 3+ sessions) */}
        {showCollapsedHeader && (
          <header className="flex flex-wrap items-center justify-between gap-4">
            <h1
              className="font-semibold"
              style={{
                fontSize: "24px",
                letterSpacing: "-0.24px",
                color: "var(--foreground)",
              }}
            >
              Analysis Sessions
            </h1>
            <Button onClick={handleNewAnalysis} className="px-5 py-2">
              New Analysis
            </Button>
          </header>
        )}

        {/* Loading state */}
        {jobsQuery.isLoading && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {/* Error state */}
        {jobsQuery.isError && !jobsQuery.isLoading && (
          <div
            className="flex items-center justify-between gap-4 rounded-2xl px-5 py-4"
            style={{
              background: "var(--color-error-bg)",
              border: "1px solid var(--color-error)",
              borderRadius: "var(--radius)",
            }}
          >
            <p className="text-sm" style={{ color: "var(--color-error)" }}>
              Failed to load sessions.
            </p>
            <button
              type="button"
              onClick={() => void jobsQuery.refetch()}
              className="text-sm font-medium underline"
              style={{ color: "var(--color-error)" }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Hero (empty / < 3 sessions) */}
        {!jobsQuery.isLoading && showHero && (
          <HeroSection onStart={handleNewAnalysis} />
        )}

        {/* Session grid */}
        {!jobsQuery.isLoading && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <DemoCard onOpen={() => setIsDemoOpen(true)} />
            </motion.div>
            {jobs.map((job, index) => (
              <motion.div
                key={job.job_id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: index * 0.05, ease: "easeOut" }}
              >
                <SessionCard
                  job={job}
                  personaName={
                    job.persona_id
                      ? (personaNameById.get(job.persona_id) ?? "Deleted Persona")
                      : "Deleted Persona"
                  }
                  onOpen={handleOpenSession}
                />
              </motion.div>
            ))}
          </div>
        )}
      </div>
      <DemoOverlay open={isDemoOpen} onClose={() => setIsDemoOpen(false)} />
    </div>
  );
}
