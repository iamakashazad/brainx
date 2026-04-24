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
          className={[
            "min-h-11 rounded-xl border border-border px-3 py-2 text-sm font-semibold transition",
            activePreset === preset
              ? "bg-primary text-primary-foreground"
              : "bg-card text-card-foreground hover:bg-accent",
          ].join(" ")}
        >
          {preset}
        </button>
      ))}
    </div>
  );
}
