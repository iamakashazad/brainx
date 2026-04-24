import { Check } from "lucide-react";
import { motion } from "framer-motion";
import type { JobStatus, StageValue } from "@/lib/api-types";
import { displayStageIndex, stageOrder } from "@/lib/stageLabels";

type StageIndicatorProps = {
  stage: StageValue | null;
  status: JobStatus;
};

const indicatorStages = [...stageOrder, "Complete"] as const;

export function StageIndicator({ stage, status }: StageIndicatorProps) {
  const activeIndex = status === "DONE" ? stageOrder.length : displayStageIndex(stage, status);

  return (
    <ol className="grid w-full max-w-4xl gap-4 md:grid-cols-5">
      {indicatorStages.map((label, index) => {
        const isDone = status === "DONE";
        const isComplete = isDone ? index <= activeIndex : index < activeIndex;
        const isActive = isDone ? index === activeIndex : index === activeIndex;

        return (
          <li key={label} className="flex items-center gap-3 rounded-2xl border border-border bg-card/80 p-4 shadow-md">
            <motion.span
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className={[
                "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
                isComplete
                  ? "border-primary bg-primary text-primary-foreground"
                  : isActive
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-muted text-muted-foreground",
              ].join(" ")}
            >
              {isComplete && !isActive ? <Check className="h-4 w-4" /> : index + 1}
            </motion.span>
            <span
              aria-live="polite"
              className={[
                "text-sm font-semibold",
                isActive ? "text-foreground" : "text-muted-foreground",
              ].join(" ")}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
