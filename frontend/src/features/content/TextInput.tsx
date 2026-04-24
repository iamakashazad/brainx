import { useState } from "react";
import { useTextContentMutation } from "./useUploadContent";

const MAX_TEXT_LENGTH = 20_000;

export function TextInput() {
  const [value, setValue] = useState("");
  const mutation = useTextContentMutation();

  return (
    <div className="space-y-4">
      <label className="grid gap-2">
        <span className="text-sm font-semibold text-foreground">Content Text</span>
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
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
          disabled={!value.trim() || value.length > MAX_TEXT_LENGTH || mutation.isPending}
          onClick={() => mutation.mutate(value)}
          className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-md transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save Text Content
        </button>
      </div>
    </div>
  );
}
