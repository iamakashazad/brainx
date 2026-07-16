/**
 * ResultsPage — "/analysis/:jobId/results"
 *
 * Four-tab results layout:
 *   Overview | Brain Explorer | Circuits | Recommendations
 *
 * Tab bar: pill tabs, brand green active indicator.
 * Results header: persona name chip + date + Share button (copies URL, shows toast).
 *
 * Overview tab:
 *   - AI Narrative featured card
 *   - 3 metric tiles
 *   - Flow Continuity Chart
 *   - "Explore brain activation →" text link
 *
 * Brain Explorer tab:
 *   - BrainCanvas full width
 *   - Preset camera pill toggle group
 *   - Circuit Selector pill toggles
 *   - Timeline Scrubber (multi-screen only)
 *   - ROI Score Table
 *   - WebGL failure fallback
 *
 * Circuits tab:
 *   - Screen selector pill tabs
 *   - 5 CircuitScoreBars with animated switch
 *
 * Recommendations tab:
 *   - Filter bar (rec_type + screen filters)
 *   - RecommendationCards grouped by screen
 *   - Empty state
 *
 * Design tokens: brand, card, border, primary, radius-full, font-mono
 */

import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import * as Tabs from "@radix-ui/react-tabs";
import { motion, AnimatePresence } from "framer-motion";
import { Share2, Check, ArrowLeft } from "lucide-react";

import { Button, PillButton, Surface } from "@/components/design-system";
import { useJobStatus } from "@/features/run/useJobStatus";
import { usePersonasQuery } from "@/features/persona/usePersonas";
import { useWizardStore } from "@/stores/wizardStore";

import { BrainCanvas } from "@/features/results/BrainCanvas";
import { CircuitScoreBar } from "@/features/results/CircuitScoreBar";
import { CircuitSelector } from "@/features/results/CircuitSelector";
import { FlowContinuityChart } from "@/features/results/FlowContinuityChart";
import { ROIScoreTable } from "@/features/results/ROIScoreTable";
import { TimelineScrubber } from "@/features/results/TimelineScrubber";
import { RecommendationCard } from "@/features/results/RecommendationCard";
import { groupRecsByScreen, withStableIds } from "@/features/results/recommendationsByScreen";

import type { CircuitName, RecType } from "@/lib/api-types";

/* ── Pill Tab Bar ─────────────────────────────────────────────────────── */

const RESULT_TABS = [
  { value: "overview", label: "Overview" },
  { value: "brain", label: "Brain Explorer" },
  { value: "circuits", label: "Circuits" },
  { value: "recommendations", label: "Recommendations" },
] as const;

type ResultTab = (typeof RESULT_TABS)[number]["value"];

function PillTabBar({
  active,
  onChange,
}: {
  active: ResultTab;
  onChange: (tab: ResultTab) => void;
}) {
  return (
    <div
      className="flex gap-1.5 flex-wrap"
      role="tablist"
      aria-label="Results sections"
    >
      {RESULT_TABS.map(({ value, label }) => {
        const isActive = value === active;
        return (
          <PillButton
            key={value}
            active={isActive}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(value as ResultTab)}
            style={
              isActive
                ? { background: "var(--color-brand)", color: "var(--color-near-black)" }
                : undefined
            }
          >
            {label}
          </PillButton>
        );
      })}
    </div>
  );
}

/* ── Share Button ─────────────────────────────────────────────────────── */

function ShareButton() {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: no-op
    }
  };

  return (
    <Button
      variant="ghost"
      onClick={() => void handleShare()}
      className="px-3 py-1.5"
      style={{
        color: copied ? "var(--color-brand-deep)" : "var(--muted-foreground)",
        border: `1px solid ${copied ? "var(--color-brand)" : "var(--border-medium)"}`,
      }}
      aria-label="Share results link"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
      {copied ? "Copied!" : "Share"}
    </Button>
  );
}

/* ── Metric Tile ──────────────────────────────────────────────────────── */

function MetricTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Surface
      style={{
        padding: "20px 24px",
      }}
    >
      <p
        className="text-xs font-semibold uppercase tracking-wider"
        style={{
          color: "var(--muted-foreground)",
          fontFamily: "var(--font-mono)",
          letterSpacing: "0.6px",
        }}
      >
        {label}
      </p>
      <p
        className="mt-1.5 font-semibold"
        style={{
          fontSize: "20px",
          letterSpacing: "-0.2px",
          color: "var(--foreground)",
        }}
      >
        {value}
      </p>
      {sub && (
        <p className="mt-0.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
          {sub}
        </p>
      )}
    </Surface>
  );
}

/* ── Overview Tab ─────────────────────────────────────────────────────── */

function OverviewTab({
  result,
  onTabChange,
}: {
  result: NonNullable<ReturnType<typeof useJobStatus>["data"]>["result"];
  onTabChange: (tab: ResultTab) => void;
}) {
  if (!result) return null;

  // Derive metrics
  const allCircuits = result.roi.flatMap((screen) =>
    Object.entries(screen.circuits) as [CircuitName, { score: number; peak: number }][]
  );
  const circuitTotals: Partial<Record<CircuitName, number>> = {};
  for (const [name, data] of allCircuits) {
    circuitTotals[name] = (circuitTotals[name] ?? 0) + data.score;
  }
  const strongestCircuit =
    (Object.entries(circuitTotals) as [CircuitName, number][]).sort(
      (a, b) => b[1] - a[1]
    )[0]?.[0] ?? "—";

  // Engagement drop = largest negative delta in flow continuity
  let maxDrop = 0;
  for (const [, cdata] of Object.entries(result.flow_continuity.circuits)) {
    for (const pt of cdata.per_screen) {
      if (pt.delta_from_prev < maxDrop) maxDrop = pt.delta_from_prev;
    }
  }

  const recCount = result.recommendations.length;

  return (
    <div className="space-y-6">
      {/* AI Narrative */}
      <Surface
        style={{
          borderRadius: "var(--radius-lg)",
          padding: "32px",
          background: `
            radial-gradient(ellipse 70% 50% at 50% 0%,
              rgba(24, 226, 153, 0.08) 0%,
              transparent 60%
            ),
            var(--card)
          `,
        }}
      >
        <p
          className="text-xs font-semibold uppercase tracking-wider mb-3"
          style={{ color: "var(--muted-foreground)", fontFamily: "var(--font-mono)", letterSpacing: "0.6px" }}
        >
          AI Narrative
        </p>
        <p
          className="leading-relaxed"
          style={{
            fontSize: "16px",
            color: "var(--foreground)",
            lineHeight: "1.65",
          }}
        >
          {result.roi.length > 0
            ? `Across ${result.roi.length} screen${result.roi.length !== 1 ? "s" : ""}, the strongest neural engagement was in the ${strongestCircuit} circuit. ${recCount > 0 ? `${recCount} recommendation${recCount !== 1 ? "s" : ""} were generated to improve cognitive performance.` : "No significant issues were detected."}`
            : "Analysis complete. No screen data was found."}
        </p>
      </Surface>

      {/* Metric tiles */}
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricTile
          label="Strongest Circuit"
          value={strongestCircuit}
          sub="Highest cumulative score"
        />
        <MetricTile
          label="Engagement Drop"
          value={maxDrop < 0 ? `${maxDrop.toFixed(1)}` : "None"}
          sub="Largest cross-screen delta"
        />
        <MetricTile
          label="Recommendations"
          value={String(recCount)}
          sub="Actionable improvements"
        />
      </div>

      {/* Flow Continuity Chart */}
      <FlowContinuityChart continuity={result.flow_continuity} />

      {/* CTA to Brain Explorer */}
      <div className="flex justify-start">
        <Button
          variant="ghost"
          onClick={() => onTabChange("brain")}
          className="inline-flex items-center gap-1.5 text-sm font-medium transition"
          style={{ color: "var(--color-brand-deep)", border: "1px solid transparent" }}
        >
          Explore brain activation
          <span aria-hidden>→</span>
        </Button>
      </div>
    </div>
  );
}

/* ── Brain Explorer Tab ───────────────────────────────────────────────── */

function BrainExplorerTab({
  jobId,
  result,
}: {
  jobId: string;
  result: NonNullable<ReturnType<typeof useJobStatus>["data"]>["result"];
}) {
  const activeScreenIndex = useWizardStore((s) => s.activeScreenIndex);
  const setActiveScreenIndex = useWizardStore((s) => s.setActiveScreenIndex);
  const [activePreset, setActivePreset] = useState<
    "Lateral-L" | "Lateral-R" | "Superior" | "Anterior"
  >("Lateral-L");

  if (!result) return null;

  const currentScreen = result.roi[activeScreenIndex] ?? result.roi[0];
  if (!currentScreen) return null;

  const isMultiScreen = result.roi.length > 1;

  return (
    <div className="space-y-6">
      <BrainCanvas jobId={jobId} regions={currentScreen.regions} />

      {/* Preset buttons */}
      <div className="flex flex-wrap gap-2">
        {(["Lateral-L", "Lateral-R", "Superior", "Anterior"] as const).map(
          (preset) => (
            <PillButton
              key={preset}
              active={activePreset === preset}
              onClick={() => setActivePreset(preset)}
            >
              {preset}
            </PillButton>
          )
        )}
      </div>

      {/* Circuit Selector */}
      <CircuitSelector circuits={currentScreen.circuits} />

      {/* Timeline Scrubber — only for multi-screen */}
      {isMultiScreen && (
        <TimelineScrubber
          screenCount={result.roi.length}
          value={activeScreenIndex}
          onChange={setActiveScreenIndex}
        />
      )}

      {/* ROI Score Table */}
      <ROIScoreTable regions={currentScreen.regions} />
    </div>
  );
}

/* ── Circuits Tab ─────────────────────────────────────────────────────── */

function CircuitsTab({
  result,
}: {
  result: NonNullable<ReturnType<typeof useJobStatus>["data"]>["result"];
}) {
  const [screenIndex, setScreenIndex] = useState(0);

  if (!result) return null;

  const currentScreen = result.roi[screenIndex] ?? result.roi[0];
  if (!currentScreen) return null;

  return (
    <div className="space-y-6">
      {/* Screen selector pill tabs */}
      {result.roi.length > 1 && (
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Select screen">
          {result.roi.map((_, i) => (
            <PillButton
              key={i}
              active={screenIndex === i}
              role="tab"
              aria-selected={screenIndex === i}
              onClick={() => setScreenIndex(i)}
              className="px-3 py-1"
            >
              {`Screen ${i + 1}`}
            </PillButton>
          ))}
        </div>
      )}

      {/* Circuit score bars */}
      <AnimatePresence mode="wait">
        <motion.div
          key={screenIndex}
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -8 }}
          transition={{ duration: 0.2 }}
          className="space-y-4"
        >
          {(
            Object.entries(currentScreen.circuits) as [
              CircuitName,
              { score: number; peak: number }
            ][]
          ).map(([circuit, data]) => (
            <CircuitScoreBar key={circuit} circuit={circuit} score={data.score} />
          ))}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ── Recommendations Tab ──────────────────────────────────────────────── */

const REC_TYPE_LABELS: Record<RecType, string> = {
  copy_rewrite: "Copy Rewrite",
  layout_flag: "Layout Flag",
  memorability: "Memorability",
  emotional_dropoff: "Emotional Drop-off",
};

function RecommendationsTab({
  result,
}: {
  result: NonNullable<ReturnType<typeof useJobStatus>["data"]>["result"];
}) {
  const [activeType, setActiveType] = useState<RecType | "all">("all");
  const [activeScreen, setActiveScreen] = useState<number | "all">("all");

  if (!result) return null;

  const stable = withStableIds(result.recommendations);
  const allTypes = [...new Set(stable.map((r) => r.rec_type))] as RecType[];
  const allScreens = [...new Set(stable.map((r) => r.screen_index))].sort(
    (a, b) => a - b
  );

  const filtered = stable.filter((r) => {
    const typeMatch = activeType === "all" || r.rec_type === activeType;
    const screenMatch = activeScreen === "all" || r.screen_index === activeScreen;
    return typeMatch && screenMatch;
  });

  const grouped = groupRecsByScreen(filtered);
  const groupedScreens = Object.keys(grouped)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div className="space-y-6">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-3">
        {/* Type filters */}
        <div className="flex flex-wrap gap-1.5">
          <PillButton
            active={activeType === "all"}
            className="px-3 py-1 text-xs"
            onClick={() => setActiveType("all")}
          >
            All types
          </PillButton>
          {allTypes.map((type) => (
            <PillButton
              key={type}
              active={activeType === type}
              className="px-3 py-1 text-xs"
              onClick={() => setActiveType(type)}
            >
              {REC_TYPE_LABELS[type]}
            </PillButton>
          ))}
        </div>

        {/* Screen filters */}
        {allScreens.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            <PillButton
              active={activeScreen === "all"}
              className="px-3 py-1 text-xs"
              onClick={() => setActiveScreen("all")}
            >
              All screens
            </PillButton>
            {allScreens.map((i) => (
              <PillButton
                key={i}
                active={activeScreen === i}
                className="px-3 py-1 text-xs"
                onClick={() => setActiveScreen(i)}
              >
                {`Screen ${i + 1}`}
              </PillButton>
            ))}
          </div>
        )}
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <Surface
          className="py-16 text-center"
        >
          <p
            className="text-sm font-medium"
            style={{ color: "var(--muted-foreground)" }}
          >
            No recommendations — your content performed well across all circuits.
          </p>
        </Surface>
      )}

      {/* Grouped recommendations */}
      {groupedScreens.map((screenIdx) => (
        <div key={screenIdx} className="space-y-3">
          <div
            className="flex items-center gap-3"
            style={{ borderBottom: "1px solid var(--border)", paddingBottom: "8px" }}
          >
            <h3
              className="text-xs font-semibold uppercase tracking-wider"
              style={{
                color: "var(--muted-foreground)",
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.6px",
              }}
            >
              {`Screen ${screenIdx + 1}`}
            </h3>
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
              style={{
                background: "var(--muted)",
                color: "var(--muted-foreground)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {grouped[screenIdx]!.length}
            </span>
          </div>
          <div className="space-y-3">
            {grouped[screenIdx]!.map((rec) => (
              <RecommendationCard key={rec.id} rec={rec} allRecs={stable} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────── */

export function ResultsPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ResultTab>("overview");
  const setJob = useWizardStore((s) => s.setJob);

  // Sync jobId from URL into store
  useEffect(() => {
    if (jobId) setJob(jobId);
  }, [jobId, setJob]);

  const jobQuery = useJobStatus(jobId ?? null);
  const personasQuery = usePersonasQuery();

  if (!jobId) return null;

  const job = jobQuery.data;
  const result = job?.result ?? null;

  // If still running, redirect to running page
  if (job?.status === "RUNNING" || job?.status === "PENDING") {
    navigate(`/analysis/${jobId}/running`, { replace: true });
    return null;
  }

  const personas = personasQuery.data ?? [];
  const personaName =
    personas.find((p) => p.id === job?.persona_id)?.name ?? "Unknown Persona";

  // Format date
  const date = job?.created_at
    ? new Date(job.created_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

  return (
    <div className="min-h-screen px-6 py-10" style={{ background: "var(--background)" }}>
      <div className="mx-auto max-w-5xl space-y-8">

        {/* Back */}
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium"
          style={{ color: "var(--muted-foreground)" }}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Dashboard
        </Link>

        {/* Results header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium"
              style={{
                background: "var(--color-brand-light)",
                color: "var(--color-brand-deep)",
                borderRadius: "var(--radius-full)",
              }}
            >
              {personaName}
            </span>
            <span
              className="text-sm"
              style={{ color: "var(--muted-foreground)", fontFamily: "var(--font-mono)" }}
            >
              {date}
            </span>
          </div>
          <ShareButton />
        </div>

        {/* Loading state */}
        {jobQuery.isLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="animate-pulse rounded-2xl h-24"
                style={{ background: "var(--muted)", border: "1px solid var(--border)" }}
              />
            ))}
          </div>
        )}

        {/* No result yet */}
        {!jobQuery.isLoading && !result && (
          <div
            className="py-16 text-center rounded-2xl"
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
            }}
          >
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              Waiting for completed analysis results…
            </p>
          </div>
        )}

        {/* Tabbed results */}
        {result && (
          <>
            <PillTabBar active={activeTab} onChange={setActiveTab} />

            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
              >
                {activeTab === "overview" && (
                  <OverviewTab result={result} onTabChange={setActiveTab} />
                )}
                {activeTab === "brain" && (
                  <BrainExplorerTab jobId={jobId} result={result} />
                )}
                {activeTab === "circuits" && (
                  <CircuitsTab result={result} />
                )}
                {activeTab === "recommendations" && (
                  <RecommendationsTab result={result} />
                )}
              </motion.div>
            </AnimatePresence>
          </>
        )}
      </div>
    </div>
  );
}
