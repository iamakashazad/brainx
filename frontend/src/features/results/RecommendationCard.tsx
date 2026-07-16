import { motion } from "framer-motion";
import { useWizardStore } from "@/stores/wizardStore";
import { cycleToSecondary, groupRecsByScreen, type RecWithId } from "./recommendationsByScreen";

function formatRecType(recType: RecWithId["rec_type"]) {
  if (recType === "emotional_dropoff") return "Emotional Drop-off";
  return recType
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const RANK_STYLE: Record<RecWithId["evidence"]["score_rank"], React.CSSProperties> = {
  "Very High": { background: "var(--color-brand-light)", color: "var(--color-brand-deep)" },
  "High":      { background: "var(--color-blue-bg)",    color: "var(--color-blue)" },
  "Moderate":  { background: "var(--color-amber-bg)",   color: "var(--color-amber)" },
  "Low":       { background: "var(--muted)",            color: "var(--muted-foreground)" },
};

export function RecommendationCard({
  rec,
  allRecs,
}: {
  rec: RecWithId;
  allRecs: RecWithId[];
}) {
  const activeRecId = useWizardStore((s) => s.activeRecId);
  const secondaryRecLocationCursor = useWizardStore((s) => s.secondaryRecLocationCursor);
  const setActiveRecId = useWizardStore((s) => s.setActiveRecId);
  const setActiveScreenIndex = useWizardStore((s) => s.setActiveScreenIndex);
  const setActiveCircuit = useWizardStore((s) => s.setActiveCircuit);
  const bumpSecondaryCursor = useWizardStore((s) => s.bumpSecondaryCursor);
  const isActive = activeRecId === rec.id;

  const handleClick = () => {
    const sameScreen = groupRecsByScreen(allRecs)[rec.screen_index] ?? [rec];
    if (activeRecId === rec.id) {
      bumpSecondaryCursor();
      const next = cycleToSecondary(rec.id, secondaryRecLocationCursor, sameScreen);
      setActiveRecId(next.id);
      setActiveScreenIndex(next.screen_index);
      setActiveCircuit(next.evidence.circuit);
      return;
    }
    setActiveRecId(rec.id);
    setActiveScreenIndex(rec.screen_index);
    setActiveCircuit(rec.evidence.circuit);
  };

  return (
    <motion.button
      type="button"
      whileHover={{ y: -1 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      onClick={handleClick}
      className="w-full text-left transition"
      style={{
        background: "var(--card)",
        border: isActive
          ? "1px solid var(--color-brand)"
          : "1px solid var(--border)",
        borderLeft: isActive
          ? "3px solid var(--color-brand)"
          : "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "16px",
        boxShadow: "var(--shadow)",
      }}
    >
      {/* Badges */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span
          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider"
          style={{
            background: "var(--muted)",
            color: "var(--muted-foreground)",
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.6px",
            borderRadius: "var(--radius-full)",
          }}
        >
          {formatRecType(rec.rec_type)}
        </span>
        <span
          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
          style={{
            ...RANK_STYLE[rec.evidence.score_rank],
            borderRadius: "var(--radius-full)",
          }}
        >
          {rec.evidence.score_rank}
        </span>
        <span
          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
          style={{
            background: "var(--muted)",
            color: "var(--muted-foreground)",
            borderRadius: "var(--radius-full)",
          }}
        >
          {`Screen ${rec.screen_index + 1}`}
        </span>
      </div>

      {/* Body */}
      <div className="space-y-2">
        {rec.rec_type === "copy_rewrite" && (
          <>
            {rec.before && (
              <p
                className="text-sm line-through"
                style={{ color: "var(--muted-foreground)" }}
              >
                {rec.before}
              </p>
            )}
            {rec.after && (
              <p
                className="text-sm font-semibold"
                style={{ color: "var(--foreground)", letterSpacing: "-0.1px" }}
              >
                {rec.after}
              </p>
            )}
            <p className="text-sm" style={{ color: "var(--muted-foreground)", lineHeight: "1.6" }}>
              {rec.rationale}
            </p>
          </>
        )}

        {rec.rec_type === "layout_flag" && (
          <>
            <p
              className="text-sm font-semibold"
              style={{ color: "var(--foreground)" }}
            >
              {rec.element_description ?? "Layout element"}
            </p>
            <p className="text-sm" style={{ color: "var(--muted-foreground)", lineHeight: "1.6" }}>
              {rec.rationale}
            </p>
          </>
        )}

        {(rec.rec_type === "memorability" || rec.rec_type === "emotional_dropoff") && (
          <>
            <p className="text-sm" style={{ color: "var(--muted-foreground)", lineHeight: "1.6" }}>
              {rec.rationale}
            </p>
          </>
        )}
      </div>

      {/* Evidence pills */}
      <p
        className="mt-3 text-xs"
        style={{ color: "var(--muted-foreground)", fontFamily: "var(--font-mono)" }}
      >
        {`${rec.evidence.circuit} · ${rec.evidence.region} · ${rec.evidence.activation_score.toFixed(1)}/100`}
      </p>
    </motion.button>
  );
}
