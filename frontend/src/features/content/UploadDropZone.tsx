import { useId, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { log } from "@/lib/logger";

type UploadDropZoneProps = {
  label: string;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
};

// Must match MAX_INPUT_BYTES in backend/services/content_processing.py. When the
// client limit was larger, an oversized file passed this check, previewed as if
// it had uploaded, was rejected server-side, and left "Run Analysis" disabled
// with nothing on screen to explain why.
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_FILE_SIZE_LABEL = `${MAX_FILE_SIZE / (1024 * 1024)} MB`;

function filterFiles(files: File[], accept?: string) {
  const rejected: string[] = [];
  const accepted = files.filter((file) => {
    if (file.size > MAX_FILE_SIZE) {
      rejected.push(`${file.name} is larger than ${MAX_FILE_SIZE_LABEL}.`);
      return false;
    }
    if (accept === "image/*" && !file.type.startsWith("image/")) {
      rejected.push(`${file.name} is not a supported image file.`);
      return false;
    }
    return true;
  });
  return { accepted, rejected };
}

export function UploadDropZone({
  label,
  accept,
  multiple = false,
  disabled = false,
  onFiles,
}: UploadDropZoneProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleIncomingFiles = (incomingFiles: File[]) => {
    const { accepted, rejected } = filterFiles(incomingFiles, accept);
    log("upload", "selected files", { files: incomingFiles });
    if (rejected.length > 0) {
      setError(rejected[0] ?? null);
    } else {
      setError(null);
    }
    if (accepted.length > 0) {
      onFiles(accepted);
    }
  };

  return (
    <div className="space-y-3">
      <label htmlFor={inputId} className="sr-only">
        Upload files
      </label>
      <input
        id={inputId}
        ref={inputRef}
        aria-label="Upload files"
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          handleIncomingFiles(Array.from(event.target.files ?? []));
          event.currentTarget.value = "";
        }}
      />
      <button
        type="button"
        disabled={disabled}
        className="flex w-full flex-col items-center justify-center gap-3 px-6 py-12 text-center transition"
        style={{
          border: `2px dashed ${isDragging ? "var(--color-brand)" : "var(--border-medium)"}`,
          borderRadius: "var(--radius)",
          background: isDragging ? "var(--color-brand-light)" : "var(--card)",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.6 : 1,
        }}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          handleIncomingFiles(Array.from(event.dataTransfer.files));
        }}
      >
        <Upload
          className="h-6 w-6"
          style={{ color: isDragging ? "var(--color-brand-deep)" : "var(--muted-foreground)" }}
        />
        <span
          className="text-sm font-medium"
          style={{ color: isDragging ? "var(--color-brand-deep)" : "var(--muted-foreground)" }}
        >
          {label}
        </span>
      </button>
      <div aria-live="polite" className="min-h-5 text-sm">
        {error ? (
          <span style={{ color: "var(--color-error)" }}>{error}</span>
        ) : null}
      </div>
    </div>
  );
}
