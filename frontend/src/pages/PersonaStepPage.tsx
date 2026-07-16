/**
 * PersonaStepPage — "/analysis/new"
 *
 * Step 1 of the analysis flow.
 * Horizontal step indicator: Persona → Content → Review
 * Persona card grid (selectable radio-group semantics, green ring on selection)
 * "Create new persona" dashed card expands inline form below grid.
 * "Continue to Content →" pill button bottom-right, disabled until selected.
 * Back link to Dashboard.
 *
 * Design tokens: brand, border, card, primary, radius-full
 */

import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Plus, ArrowLeft } from "lucide-react";
import { Button, StepIndicator } from "@/components/design-system";
import { PersonaForm } from "@/features/persona/PersonaForm";
import { usePersonasQuery } from "@/features/persona/usePersonas";
import { useWizardStore } from "@/stores/wizardStore";
import type { PersonaRead } from "@/lib/api-types";

const STEPS = ["Persona", "Content", "Review"] as const;

/* ── Selectable Persona Card ──────────────────────────────────────────── */

function SelectablePersonaCard({
  persona,
  selected,
  onSelect,
}: {
  persona: PersonaRead;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <motion.button
      type="button"
      role="radio"
      aria-checked={selected}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      onClick={onSelect}
      className="w-full text-left transition"
      style={{
        background: "var(--card)",
        border: selected
          ? `2px solid var(--color-brand)`
          : "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: selected ? "23px" : "24px",
        boxShadow: selected ? "0 0 0 3px var(--color-brand-light)" : "var(--shadow)",
        outline: "none",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3
            className="font-semibold truncate"
            style={{ fontSize: "15px", letterSpacing: "-0.2px", color: "var(--foreground)" }}
          >
            {persona.name}
          </h3>
          <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>
            {persona.demographics.role} · {persona.environment.device}
          </p>
        </div>
        {selected && (
          <span
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
            style={{ background: "var(--color-brand)" }}
          >
            <Check className="h-3 w-3" style={{ color: "var(--color-near-black)" }} />
          </span>
        )}
      </div>
      <p className="mt-3 text-sm" style={{ color: "var(--muted-foreground)" }}>
        {persona.cognitive_state.attention_span} attention · {persona.cognitive_state.stress_level} stress
      </p>
    </motion.button>
  );
}

/* ── Create New Persona Dashed Card ───────────────────────────────────── */

function CreatePersonaCard({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex w-full flex-col items-center justify-center gap-3 transition"
      style={{
        border: `2px dashed ${hovered ? "var(--color-brand)" : "var(--border-medium)"}`,
        borderRadius: "var(--radius)",
        padding: "32px 24px",
        background: hovered ? "var(--color-brand-light)" : "transparent",
        color: hovered ? "var(--color-brand-deep)" : "var(--muted-foreground)",
        minHeight: "120px",
      }}
    >
      <Plus className="h-5 w-5" />
      <span className="text-sm font-medium">Create new persona</span>
    </motion.button>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────── */

export function PersonaStepPage() {
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const { data: personas, isLoading } = usePersonasQuery();
  const selectedPersonaId = useWizardStore((state) => state.selectedPersonaId);
  const setPersona = useWizardStore((state) => state.setPersona);

  const handleContinue = () => {
    if (selectedPersonaId) navigate("/analysis/new/content");
  };

  return (
    <div className="min-h-screen px-6 py-10" style={{ background: "var(--background)" }}>
      <div className="mx-auto max-w-4xl space-y-8">

        {/* Back link */}
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium transition"
          style={{ color: "var(--muted-foreground)" }}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Dashboard
        </Link>

        {/* Step indicator */}
        <StepIndicator labels={STEPS} activeIndex={0} />

        {/* Heading */}
        <div>
          <h1
            className="font-semibold"
            style={{ fontSize: "24px", letterSpacing: "-0.24px", color: "var(--foreground)" }}
          >
            Choose a persona
          </h1>
          <p className="mt-1.5 text-sm" style={{ color: "var(--muted-foreground)" }}>
            Select who will experience your content.
          </p>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="animate-pulse h-32 rounded-2xl"
                style={{ background: "var(--muted)", border: "1px solid var(--border)" }}
              />
            ))}
          </div>
        )}

        {/* Persona grid */}
        {!isLoading && (
          <div
            role="radiogroup"
            aria-label="Select a persona"
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {(personas ?? []).map((persona) => (
              <SelectablePersonaCard
                key={persona.id}
                persona={persona}
                selected={selectedPersonaId === persona.id}
                onSelect={() => setPersona(persona.id)}
              />
            ))}
            <CreatePersonaCard onClick={() => setShowForm((v) => !v)} />
          </div>
        )}

        {/* Inline create form */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <PersonaForm
                onCreated={(persona) => {
                  setPersona(persona.id);
                  setShowForm(false);
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer nav */}
        <div className="flex justify-end pt-2">
          <Button
            disabled={!selectedPersonaId}
            onClick={handleContinue}
            variant={selectedPersonaId ? "primary" : "subtle"}
          >
            Continue to Content
            <span aria-hidden>→</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
