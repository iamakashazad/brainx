import { useWizardStore } from "@/stores/wizardStore";

const contentTypeLabels = {
  text: "Text content",
  ui_screens: "UI screens",
  static: "Static image",
} as const;

export function ProgressSummary() {
  const selectedPersonaId = useWizardStore((state) => state.selectedPersonaId);
  const contentType = useWizardStore((state) => state.contentType);

  if (!selectedPersonaId && !contentType) {
    return null;
  }

  return (
    <aside className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-lg">
      <p className="text-sm font-semibold text-foreground">Run context</p>
      {selectedPersonaId ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Persona selected: <span className="font-mono text-foreground">{selectedPersonaId}</span>
        </p>
      ) : null}
      {contentType ? (
        <span className="mt-4 inline-flex rounded-full border border-border bg-muted px-3 py-1 text-sm font-semibold text-foreground">
          {contentTypeLabels[contentType]}
        </span>
      ) : null}
    </aside>
  );
}
