const PRESETS = ["Lateral-L", "Lateral-R", "Superior", "Anterior"] as const;

type BrainPresetButtonsProps = {
  activePreset: (typeof PRESETS)[number];
  onPresetChange: (preset: (typeof PRESETS)[number]) => void;
};

export function BrainPresetButtons({
  activePreset,
  onPresetChange,
}: BrainPresetButtonsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {PRESETS.map((preset) => (
        <button
          key={preset}
          type="button"
          aria-label={`View: ${preset}`}
          onClick={() => onPresetChange(preset)}
          className="rounded-full px-4 py-1.5 text-sm font-medium transition"
          style={{
            background: activePreset === preset ? "var(--primary)" : "transparent",
            color: activePreset === preset ? "var(--primary-foreground)" : "var(--muted-foreground)",
            border: activePreset === preset ? "none" : "1px solid var(--border-medium)",
            borderRadius: "var(--radius-full)",
          }}
        >
          {preset}
        </button>
      ))}
    </div>
  );
}
