import { useState } from "react";
import { motion } from "framer-motion";
import { Trash2 } from "lucide-react";
import type { PersonaRead } from "@/lib/api-types";

type PersonaCardProps = {
  persona: PersonaRead;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
};

export function PersonaCard({
  persona,
  selected,
  onSelect,
  onDelete,
}: PersonaCardProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <motion.article
      whileHover={{ scale: 1.02, y: -2 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className={[
        "rounded-2xl border bg-card p-5 shadow-md transition hover:shadow-xl",
        selected ? "border-2 border-primary" : "border-border",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-foreground">{persona.name}</h3>
          <p className="text-sm text-muted-foreground">
            {persona.demographics.role} · {persona.environment.device} · {persona.environment.location}
          </p>
        </div>
        <button
          type="button"
          aria-label={`Delete persona: ${persona.name}`}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground transition hover:bg-accent hover:text-foreground"
          onClick={() => setConfirmingDelete((value) => !value)}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 space-y-3 text-sm text-muted-foreground">
        <p>Goals: {persona.psychographics.goals.join(", ") || "Not set"}</p>
        <p>
          Cognitive state: {persona.cognitive_state.attention_span} attention,{" "}
          {persona.cognitive_state.stress_level} stress
        </p>
      </div>

      {confirmingDelete ? (
        <div className="mt-4 rounded-xl border border-destructive bg-muted p-4 text-sm">
          <p className="font-semibold text-foreground">{`Delete "${persona.name}"?`}</p>
          <p className="mt-1 text-muted-foreground">This cannot be undone.</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="rounded-lg bg-destructive px-3 py-2 text-sm font-semibold text-primary-foreground"
              onClick={onDelete}
            >
              Delete
            </button>
            <button
              type="button"
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-card-foreground"
              onClick={() => setConfirmingDelete(false)}
            >
              Keep Persona
            </button>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-md transition hover:shadow-lg"
        onClick={onSelect}
      >
        Use this persona
      </button>
    </motion.article>
  );
}
