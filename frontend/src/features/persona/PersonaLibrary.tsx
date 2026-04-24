import { useState } from "react";
import { useWizardStore } from "@/stores/wizardStore";
import { PersonaCard } from "./PersonaCard";
import { PersonaForm } from "./PersonaForm";
import { useDeletePersonaMutation, usePersonasQuery } from "./usePersonas";

export function PersonaLibrary() {
  const [showForm, setShowForm] = useState(false);
  const selectedPersonaId = useWizardStore((state) => state.selectedPersonaId);
  const setPersona = useWizardStore((state) => state.setPersona);
  const { data: personas, isLoading } = usePersonasQuery();
  const deleteMutation = useDeletePersonaMutation();

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-lg">
        <p className="text-sm text-muted-foreground">Loading personas...</p>
      </div>
    );
  }

  if (!personas?.length) {
    return (
      <div className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-lg">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-foreground">No personas yet</h2>
          <p className="text-sm text-muted-foreground">
            Create your first persona to define who will experience your content.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-md"
          onClick={() => setShowForm(true)}
        >
          Create Persona
        </button>
        {showForm ? (
          <PersonaForm
            onCreated={(persona) => {
              setPersona(persona.id);
              setShowForm(false);
            }}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Persona Library</h2>
          <p className="text-sm text-muted-foreground">
            Pick an existing persona or create a new one.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-md"
          onClick={() => setShowForm((value) => !value)}
        >
          Create Persona
        </button>
      </div>

      {showForm ? (
        <PersonaForm
          onCreated={(persona) => {
            setPersona(persona.id);
            setShowForm(false);
          }}
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {personas.map((persona) => (
          <PersonaCard
            key={persona.id}
            persona={persona}
            selected={selectedPersonaId === persona.id}
            onSelect={() => setPersona(persona.id)}
            onDelete={() => {
              deleteMutation.mutate(persona.id);
              if (selectedPersonaId === persona.id) {
                setPersona(null);
              }
            }}
          />
        ))}
      </div>
    </div>
  );
}
