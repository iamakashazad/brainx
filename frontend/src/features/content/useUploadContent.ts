import { useMutation } from "@tanstack/react-query";
import {
  createTextContent,
  uploadScreens,
  uploadStatic,
} from "@/lib/api";
import type { ContentCreated } from "@/lib/api-types";
import { useWizardStore } from "@/stores/wizardStore";

// Bumped whenever the content the user can see changes (a new upload starts,
// content is removed, the tab switches). An upload that resolves after a newer
// change is stale and must not write its contentId back into the store —
// otherwise a slow first upload landing after "Remove" or a re-upload would
// re-enable "Run Analysis" against content no longer on screen. Module-level so
// it also covers uploads started by an uploader that has since unmounted.
let contentGeneration = 0;

/** Drop the stored content and invalidate any upload still in flight. */
export function discardContent() {
  contentGeneration += 1;
  useWizardStore.getState().clearContent();
}

function useContentMutation<TVariables>(
  mutationFn: (variables: TVariables) => Promise<ContentCreated>,
) {
  const setContent = useWizardStore((state) => state.setContent);

  return useMutation<ContentCreated, Error, TVariables, number>({
    mutationFn,
    // Clear first so a failed upload cannot leave the previous content enabled
    // behind a preview of the new one.
    onMutate: () => {
      discardContent();
      return contentGeneration;
    },
    onSuccess: (content, _variables, generation) => {
      if (generation === contentGeneration) {
        setContent(content.content_id, content.content_type);
      }
    },
  });
}

export function useTextContentMutation() {
  return useContentMutation<string>((text) => createTextContent(text));
}

export function useUploadScreensMutation() {
  return useContentMutation<File[]>((files) => uploadScreens(files));
}

export function useUploadStaticMutation() {
  return useContentMutation<File>((file) => uploadStatic(file));
}
