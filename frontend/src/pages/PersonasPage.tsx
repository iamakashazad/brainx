/**
 * PersonasPage — "/personas"
 *
 * Standalone persona library page (extracted from WizardShell).
 * Inline creation form — no modal.
 * Inline delete confirmation — no modal.
 * Empty state with CTA.
 *
 * Design tokens: card, border, muted, brand, primary, destructive
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PersonaForm } from "@/features/persona/PersonaForm";
import { useDeletePersonaMutation, usePersonasQuery } from "@/features/persona/usePersonas";
import { useWizardStore } from "@/stores/wizardStore";
import type { PersonaRead } from "@/lib/api-types";

/* ── Persona Card ─────────────────────────────────────────────────────── */

function PersonaCard({
  persona,
  onDelete,
  onAnalyze,
  deleteError,
  deletePending = false,
}: {
  persona: PersonaRead;
  onDelete: () => void;
  onAnalyze: () => void;
  deleteError?: string | null;
  deletePending?: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [hovered, setHovered] = useState(false);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      // Keyboard users never hover; reveal "Analyze" while focus is inside.
      onFocus={() => setHovered(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setHovered(false);
        }
      }}
      style={{
        background: "var(--card)",
        border: `1px solid ${hovered ? "var(--border-medium)" : "var(--border)"}`,
        borderRadius: "var(--radius)",
        padding: "24px",
        boxShadow: hovered ? "var(--shadow-md)" : "var(--shadow)",
        transition: "border-color 150ms, box-shadow 150ms",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3
            className="font-semibold truncate"
            style={{ fontSize: "16px", letterSpacing: "-0.2px", color: "var(--foreground)" }}
          >
            {persona.name}
          </h3>
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            {persona.demographics.role} · {persona.environment.device} · {persona.environment.location}
          </p>
        </div>
        <button
          type="button"
          aria-label={`Delete persona: ${persona.name}`}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition"
          style={{
            background: "var(--muted)",
            color: "var(--muted-foreground)",
            border: "1px solid var(--border)",
          }}
          onClick={() => setConfirmDelete((v) => !v)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-4 space-y-2 text-sm" style={{ color: "var(--muted-foreground)" }}>
        <p>Goals: {persona.psychographics.goals.join(", ") || "Not set"}</p>
        <p>
          Cognitive: {persona.cognitive_state.attention_span} attention,{" "}
          {persona.cognitive_state.stress_level} stress
        </p>
      </div>

      {/* Delete confirmation */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div
              className="mt-4 rounded-2xl p-4 text-sm"
              style={{
                background: "var(--color-error-bg)",
                border: "1px solid var(--color-error)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              <p className="font-semibold" style={{ color: "var(--foreground)" }}>
                Delete "{persona.name}"?
              </p>
              <p className="mt-1" style={{ color: "var(--muted-foreground)" }}>
                This cannot be undone.
              </p>
              {/* A persona already used by an analysis cannot be deleted: the
                  backend answers 409. That detail was previously discarded, so
                  the panel just closed and nothing happened. */}
              {deleteError && (
                <p
                  role="alert"
                  className="mt-2 font-medium"
                  style={{ color: "var(--color-error)" }}
                >
                  {deleteError}
                </p>
              )}
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={deletePending}
                  className="inline-flex items-center rounded-full px-4 py-1.5 text-sm font-medium transition"
                  style={{
                    background: "var(--color-error)",
                    color: "#fff",
                    borderRadius: "var(--radius-full)",
                    opacity: deletePending ? 0.6 : 1,
                    cursor: deletePending ? "not-allowed" : "pointer",
                  }}
                  onClick={onDelete}
                >
                  {deletePending ? "Deleting…" : "Delete"}
                </button>
                <button
                  type="button"
                  className="inline-flex items-center rounded-full px-4 py-1.5 text-sm font-medium transition"
                  style={{
                    background: "var(--card)",
                    color: "var(--foreground)",
                    border: "1px solid var(--border-medium)",
                    borderRadius: "var(--radius-full)",
                  }}
                  onClick={() => setConfirmDelete(false)}
                >
                  Keep
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hover-reveal Analyze button */}
      <AnimatePresence>
        {hovered && !confirmDelete && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.12 }}
            className="mt-4"
          >
            <button
              type="button"
              onClick={onAnalyze}
              className="inline-flex items-center gap-1.5 rounded-full text-sm font-medium transition"
              style={{
                color: "var(--color-brand-deep)",
                background: "transparent",
                padding: "0",
              }}
            >
              Analyze
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

/* ── Empty State ──────────────────────────────────────────────────────── */

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center py-24 text-center"
    >
      <div
        className="inline-flex h-14 w-14 items-center justify-center rounded-2xl mb-5"
        style={{ background: "var(--color-brand-light)" }}
      >
        <Users className="h-7 w-7" style={{ color: "var(--color-brand-deep)" }} />
      </div>
      <h2
        className="font-semibold"
        style={{ fontSize: "20px", letterSpacing: "-0.2px", color: "var(--foreground)" }}
      >
        No personas yet
      </h2>
      <p className="mt-2 text-sm max-w-xs" style={{ color: "var(--muted-foreground)" }}>
        Create your first persona to define who will experience your content.
      </p>
      <button
        type="button"
        onClick={onCreateClick}
        className="mt-6 inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition"
        style={{
          background: "var(--primary)",
          color: "var(--primary-foreground)",
          boxShadow: "var(--shadow-sm)",
          borderRadius: "var(--radius-full)",
        }}
      >
        <Plus className="h-4 w-4" />
        Create Persona
      </button>
    </motion.div>
  );
}

// Need Users icon — import it
import { Users } from "lucide-react";

/* ── Page ─────────────────────────────────────────────────────────────── */

export function PersonasPage() {
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const { data: personas, isLoading } = usePersonasQuery();
  const deleteMutation = useDeletePersonaMutation();
  // One shared mutation serves every card, so remember which persona the
  // pending state and any error belong to.
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const setPersona = useWizardStore((state) => state.setPersona);
  const reset = useWizardStore((state) => state.reset);

  const handleAnalyze = (personaId: string) => {
    reset();
    setPersona(personaId);
    navigate("/analysis/new/content");
  };

  return (
    <div className="min-h-screen px-6 py-10" style={{ background: "var(--background)" }}>
      <div className="mx-auto max-w-5xl space-y-8">

        {/* Page header */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <h1
            className="font-semibold"
            style={{ fontSize: "24px", letterSpacing: "-0.24px", color: "var(--foreground)" }}
          >
            Personas
          </h1>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition"
            style={{
              background: "var(--primary)",
              color: "var(--primary-foreground)",
              boxShadow: "var(--shadow-sm)",
              borderRadius: "var(--radius-full)",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.9"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
          >
            <Plus className="h-4 w-4" />
            Create Persona
          </button>
        </header>

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
                onCreated={() => {
                  setShowForm(false);
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading skeleton */}
        {isLoading && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="animate-pulse h-40 rounded-2xl"
                style={{ background: "var(--muted)", border: "1px solid var(--border)" }}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && (!personas || personas.length === 0) && (
          <EmptyState onCreateClick={() => setShowForm(true)} />
        )}

        {/* Persona grid */}
        {!isLoading && personas && personas.length > 0 && (
          <motion.div layout className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence>
              {personas.map((persona) => (
                <PersonaCard
                  key={persona.id}
                  persona={persona}
                  onDelete={() => {
                    setDeleteTargetId(persona.id);
                    deleteMutation.mutate(persona.id, {
                      onSuccess: () => {
                        // Deleting the persona the wizard still points at would
                        // otherwise leave a dangling selection in the store.
                        // Read at success time, not from the render closure.
                        if (useWizardStore.getState().selectedPersonaId === persona.id) {
                          setPersona(null);
                        }
                      },
                    });
                  }}
                  onAnalyze={() => handleAnalyze(persona.id)}
                  deleteError={
                    deleteTargetId === persona.id && deleteMutation.isError
                      ? deleteMutation.error.message
                      : null
                  }
                  deletePending={deleteTargetId === persona.id && deleteMutation.isPending}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  );
}
