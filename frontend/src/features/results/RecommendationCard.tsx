import { motion } from "framer-motion";
import { useWizardStore } from "@/stores/wizardStore";
import { cycleToSecondary, groupRecsByScreen, type RecWithId } from "./recommendationsByScreen";

function formatRecType(recType: RecWithId["rec_type"]) {
  if (recType === "emotional_dropoff") {
    return "Emotional Drop-off";
  }
  return recType
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function rankClass(rank: RecWithId["evidence"]["score_rank"]) {
  switch (rank) {
    case "Very High":
      return "bg-primary/15 text-primary";
    case "High":
      return "bg-[color:var(--chart-2)]/15 text-[color:var(--chart-2)]";
    case "Moderate":
      return "bg-[color:var(--chart-5)]/15 text-[color:var(--chart-5)]";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function RecommendationCard({
  rec,
  allRecs,
}: {
  rec: RecWithId;
  allRecs: RecWithId[];
}) {
  const activeRecId = useWizardStore((state) => state.activeRecId);
  const secondaryRecLocationCursor = useWizardStore((state) => state.secondaryRecLocationCursor);
  const setActiveRecId = useWizardStore((state) => state.setActiveRecId);
  const setActiveScreenIndex = useWizardStore((state) => state.setActiveScreenIndex);
  const setActiveCircuit = useWizardStore((state) => state.setActiveCircuit);
  const bumpSecondaryCursor = useWizardStore((state) => state.bumpSecondaryCursor);
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
      whileHover={{ scale: 1.01, y: -2 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      onClick={handleClick}
      className={[
        "w-full rounded-2xl border border-border bg-card p-4 text-left shadow-lg transition",
        isActive ? "border-l-4 border-primary" : "hover:border-primary/40",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-border px-2 py-1 text-xs font-semibold text-foreground">
          {formatRecType(rec.rec_type)}
        </span>
        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${rankClass(rec.evidence.score_rank)}`}>
          {rec.evidence.score_rank}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {rec.rec_type === "copy_rewrite" ? (
          <>
            {rec.before ? (
              <p className="line-through text-sm text-muted-foreground">{rec.before}</p>
            ) : null}
            {rec.after ? (
              <p className="text-base font-semibold text-foreground">{rec.after}</p>
            ) : null}
            <p className="text-sm leading-6 text-muted-foreground">{rec.rationale}</p>
          </>
        ) : null}

        {rec.rec_type === "layout_flag" ? (
          <>
            <p className="text-base font-semibold text-foreground">
              {rec.element_description ?? "Layout element"}
            </p>
            <p className="text-sm leading-6 text-muted-foreground">{rec.rationale}</p>
          </>
        ) : null}

        {rec.rec_type === "memorability" || rec.rec_type === "emotional_dropoff" ? (
          <>
            <p className="text-sm font-semibold text-foreground">{`Screen ${rec.screen_index + 1}`}</p>
            <p className="text-sm leading-6 text-muted-foreground">{rec.rationale}</p>
          </>
        ) : null}
      </div>

      <p className="mt-4 font-mono text-sm text-muted-foreground">
        {`${rec.evidence.circuit} · ${rec.evidence.region} · ${rec.evidence.activation_score.toFixed(1)}/100 · ${rec.evidence.score_rank}`}
      </p>
    </motion.button>
  );
}
