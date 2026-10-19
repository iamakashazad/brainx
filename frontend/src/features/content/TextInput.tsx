import { useState } from "react";
import { discardContent, useTextContentMutation } from "./useUploadContent";

const MAX_TEXT_LENGTH = 20_000;

export function TextInput() {
  const [value, setValue] = useState("");
  const [savedValue, setSavedValue] = useState<string | null>(null);
  const mutation = useTextContentMutation();

  // Editing after saving left the previously saved text as the content that
  // would actually be analyzed, with no indication the textarea had diverged.
  const handleChange = (next: string) => {
    setValue(next);
    if (savedValue !== null && next !== savedValue) {
      setSavedValue(null);
      discardContent();
    }
  };

  return (
    <div className="space-y-4">
      <label className="grid gap-2">
        <span className="text-sm font-semibold text-foreground">Content Text</span>
        <textarea
          value={value}
          // Editing mid-save would let the in-flight save mark the old text as
          // saved while the textarea shows the new text.
          readOnly={mutation.isPending}
          onChange={(event) => handleChange(event.target.value)}
          placeholder="Describe or paste the content your persona will experience…"
          className="min-h-52 w-full rounded-2xl border border-input bg-background px-4 py-3 text-base font-normal leading-6 text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>
      <div className="flex items-center justify-between gap-4">
        <span className="font-mono text-sm text-muted-foreground">
          {value.length}/{MAX_TEXT_LENGTH}
        </span>
        <button
          type="button"
          disabled={
            !value.trim() ||
            value.length > MAX_TEXT_LENGTH ||
            mutation.isPending ||
            savedValue === value
          }
          onClick={() => {
            const submitted = value;
            mutation.mutate(submitted, { onSuccess: () => setSavedValue(submitted) });
          }}
          className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-md transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
        >
          {mutation.isPending ? "Saving…" : "Save Text Content"}
        </button>
      </div>

      {/* The button disables once saved, so say why. */}
      {savedValue === value && savedValue !== null ? (
        <p className="text-sm text-muted-foreground">
          Text saved — ready to analyze.
        </p>
      ) : null}

      {mutation.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {`Could not save text: ${mutation.error.message}`}
        </p>
      ) : null}
    </div>
  );
}
