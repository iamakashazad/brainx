import { useEffect, useRef, useState } from "react";
import { UploadDropZone } from "./UploadDropZone";
import { discardContent, useUploadStaticMutation } from "./useUploadContent";

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

  // Radix unmounts this panel on every tab switch; revoke the blob URL then too.
  const previewRef = useRef(preview);
  previewRef.current = preview;
  useEffect(() => {
    return () => {
      if (previewRef.current?.revoke) {
        URL.revokeObjectURL(previewRef.current.previewUrl);
      }
    };
  }, []);

  return (
    <div className="space-y-4">
      <UploadDropZone
        label="Drop a single image here, or click to browse"
        accept="image/*"
        disabled={mutation.isPending}
        onFiles={(files) => {
          const nextPreview = createPreview(files[0]!);
          if (preview?.revoke) {
            URL.revokeObjectURL(preview.previewUrl);
          }
          setPreview(nextPreview);
          mutation.mutate(files[0]!);
        }}
      />

      {mutation.isPending ? (
        <p className="text-sm text-muted-foreground">Uploading image…</p>
      ) : null}

      {/* Without this the server's rejection (too large, unsupported type,
          undecodable) was silent: the preview below still rendered, so the
          upload looked successful while "Run Analysis" stayed disabled. */}
      {mutation.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {`Upload failed: ${mutation.error.message}`}
        </p>
      ) : null}

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
              // Clearing only local preview state used to leave contentId set,
              // so "Run Analysis" stayed enabled and submitted the removed image.
              discardContent();
            }}
          >
            Remove image
          </button>
        </div>
      ) : null}
    </div>
  );
}
