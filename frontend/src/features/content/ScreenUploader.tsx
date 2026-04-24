import { useEffect, useState } from "react";
import { UploadDropZone } from "./UploadDropZone";
import { useUploadScreensMutation } from "./useUploadContent";

type ScreenUploaderProps = {
  onUpload?: (files: File[]) => void;
};

type PreviewFile = {
  file: File;
  previewUrl: string;
  revoke: boolean;
};

function createPreviewFile(file: File): PreviewFile {
  if (typeof URL.createObjectURL === "function") {
    return {
      file,
      previewUrl: URL.createObjectURL(file),
      revoke: true,
    };
  }

  return {
    file,
    previewUrl: file.name,
    revoke: false,
  };
}

export function ScreenUploader({ onUpload }: ScreenUploaderProps) {
  const [files, setFiles] = useState<PreviewFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const mutation = useUploadScreensMutation();

  useEffect(() => {
    return () => {
      files.forEach((preview) => {
        if (preview.revoke) {
          URL.revokeObjectURL(preview.previewUrl);
        }
      });
    };
  }, [files]);

  const handleFiles = (incomingFiles: File[]) => {
    const acceptedFiles = incomingFiles.slice(0, 5);
    const hadExtras = incomingFiles.length > 5;

    setFiles((currentFiles) => {
      currentFiles.forEach((preview) => {
        if (preview.revoke) {
          URL.revokeObjectURL(preview.previewUrl);
        }
      });

      return acceptedFiles.map(createPreviewFile);
    });

    setError(
      hadExtras ? "Only 1–5 screens allowed. Extra files were not added." : null,
    );
    onUpload?.(acceptedFiles);
    mutation.mutate(acceptedFiles);
  };

  return (
    <div className="space-y-4">
      <UploadDropZone
        label="Drop 1–5 UI screens here, or click to browse"
        accept="image/*"
        multiple
        onFiles={handleFiles}
      />

      {files.length ? (
        <p className="text-sm text-muted-foreground">{`${files.length}/5 screens added`}</p>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {files.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {files.map((preview, index) => (
            <div
              key={`${preview.file.name}-${index}`}
              className="space-y-3 rounded-2xl border border-border bg-card p-3"
            >
              <img
                src={preview.previewUrl}
                alt={`Screen ${index + 1}`}
                className="h-40 w-full rounded-xl object-cover"
              />
              <button
                type="button"
                aria-label={`Remove screen ${index + 1}`}
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-muted px-3 text-sm font-semibold text-foreground"
                onClick={() => {
                  setFiles((currentFiles) => {
                    const nextFiles = currentFiles.filter((_, currentIndex) => currentIndex !== index);
                    const removed = currentFiles[index];
                    if (removed?.revoke) {
                      URL.revokeObjectURL(removed.previewUrl);
                    }
                    return nextFiles;
                  });
                }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
