import { useState } from "react";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { usePersonasQuery } from "@/features/persona/usePersonas";
import { WizardOverlay } from "@/features/wizard/WizardOverlay";
import { useWizardStore } from "@/stores/wizardStore";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DemoCard } from "./DemoCard";
import { DemoOverlay } from "./DemoOverlay";
import { SessionCard } from "./SessionCard";
import { useJobHistory } from "./useJobHistory";

export function HistoryView() {
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isDemoOpen, setIsDemoOpen] = useState(false);
  const jobsQuery = useJobHistory();
  const personasQuery = usePersonasQuery();
  const reset = useWizardStore((state) => state.reset);
  const setJob = useWizardStore((state) => state.setJob);
  const setStep = useWizardStore((state) => state.setStep);
  const jobs = jobsQuery.data ?? [];
  const personaNameById = new Map((personasQuery.data ?? []).map((persona) => [persona.id, persona.name]));

  const handleNewAnalysis = () => {
    reset();
    setIsWizardOpen(true);
  };

  const handleOpenSession = (jobId: string) => {
    setJob(jobId);
    setStep(4);
    setIsWizardOpen(true);
  };

  return (
    <main className="min-h-screen bg-background px-6 py-12 text-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-semibold">Analysis Sessions</h1>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button
              type="button"
              onClick={handleNewAnalysis}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-md transition hover:shadow-lg"
            >
              <Plus className="h-4 w-4" />
              New Analysis
            </button>
          </div>
        </header>

        {jobs.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="rounded-2xl border border-border bg-card p-12 text-center shadow-md"
          >
            <h2 className="text-3xl font-semibold">No analyses yet</h2>
            <p className="mt-3 text-base leading-7 text-muted-foreground">
              Run your first analysis to see brain activation results here. Click "New Analysis" to get started.
            </p>
          </motion.div>
        ) : null}

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
              transition={{ duration: 0.2, delay: (index + 1) * 0.06, ease: "easeOut" }}
            >
              <SessionCard
                job={job}
                personaName={
                  job.persona_id ? (personaNameById.get(job.persona_id) ?? "Deleted Persona") : "Deleted Persona"
                }
                onOpen={handleOpenSession}
              />
            </motion.div>
          ))}
        </div>
      </div>

      <WizardOverlay open={isWizardOpen} onClose={() => setIsWizardOpen(false)} />
      <DemoOverlay open={isDemoOpen} onClose={() => setIsDemoOpen(false)} />
    </main>
  );
}
