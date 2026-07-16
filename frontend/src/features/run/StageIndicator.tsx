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
    <ol className="flex w-full max-w-2xl items-center gap-0" aria-label="Analysis stages">
      {indicatorStages.map((label, index) => {
        const isDone = status === "DONE";
        const isComplete = isDone ? index <= activeIndex : index < activeIndex;
        const isActive = isDone ? index === activeIndex : index === activeIndex;
        const isLast = index === indicatorStages.length - 1;

        return (
          <li key={label} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold"
                style={{
                  background: isComplete || isActive
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
                {isComplete && !isActive ? (
                  <Check className="h-3 w-3" />
                ) : isActive && status === "RUNNING" ? (
                  <motion.span
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: "var(--color-near-black)" }}
                  />
                ) : (
                  index + 1
                )}
              </motion.span>
            </div>
            {!isLast && (
              <div
                className="flex-1 h-px mx-1"
                style={{
                  background: isComplete ? "var(--color-brand)" : "var(--border-medium)",
                  transition: "background 400ms",
                }}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
