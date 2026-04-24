import { useState } from "react";
import { UploadDropZone } from "./UploadDropZone";
import { useUploadStaticMutation } from "./useUploadContent";

type StaticPreview = {
  file: File;
  previewUrl: string;
  revoke: boolean;
};

function createPreview(file: File): StaticPreview {
  if (typeof URL.createObjectURL === "function") {
    return { file, previewUrl: URL.createObjectURL(file), revoke: true };
  }

  return { file, previewUrl: file.name, revoke: false };
}

export function StaticUploader() {
  const [preview, setPreview] = useState<StaticPreview | null>(null);
  const mutation = useUploadStaticMutation();

  return (
    <div className="space-y-4">
      <UploadDropZone
        label="Drop a single image here, or click to browse"
        accept="image/*"
        onFiles={(files) => {
          const nextPreview = createPreview(files[0]!);
          if (preview?.revoke) {
            URL.revokeObjectURL(preview.previewUrl);
          }
          setPreview(nextPreview);
          mutation.mutate(files[0]!);
        }}
      />

      {preview ? (
        <div className="space-y-3 rounded-2xl border border-border bg-card p-3">
          <img
            src={preview.previewUrl}
            alt="Uploaded static preview"
            className="h-48 w-full rounded-xl object-cover"
          />
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-muted px-3 text-sm font-semibold text-foreground"
            onClick={() => {
              if (preview.revoke) {
                URL.revokeObjectURL(preview.previewUrl);
              }
              setPreview(null);
            }}
          >
            Remove image
          </button>
        </div>
      ) : null}
    </div>
  );
}
