import { motion } from "framer-motion";
import { StatusBadge } from "@/components/design-system";
import type { JobSummary } from "@/lib/api-types";

type SessionCardProps = {
  job: JobSummary;
  personaName: string;
  onOpen: (jobId: string) => void;
};

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function SessionCard({ job, personaName, onOpen }: SessionCardProps) {
  return (
    <motion.button
      type="button"
      data-testid="session-card"
      whileHover={{ scale: 1.01, y: -2 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className="w-full rounded-2xl border border-border bg-card p-5 text-left shadow-md transition hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      onClick={() => onOpen(job.job_id)}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <h2 className="truncate text-lg font-semibold text-foreground">{personaName}</h2>
          <p className="font-mono text-sm text-muted-foreground">{formatDate(job.created_at)}</p>
        </div>
        <StatusBadge status={job.status} />
      </div>
    </motion.button>
  );
}
