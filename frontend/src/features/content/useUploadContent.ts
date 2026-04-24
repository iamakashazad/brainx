import { useMutation } from "@tanstack/react-query";
import {
  createTextContent,
  uploadScreens,
  uploadStatic,
} from "@/lib/api";
import type { ContentCreated } from "@/lib/api-types";
import { useWizardStore } from "@/stores/wizardStore";

export function useTextContentMutation() {
  const setContent = useWizardStore((state) => state.setContent);

  return useMutation<ContentCreated, Error, string>({
    mutationFn: (text) => createTextContent(text),
    onSuccess: (content) => {
      setContent(content.content_id, content.content_type);
    },
  });
}

export function useUploadScreensMutation() {
  const setContent = useWizardStore((state) => state.setContent);

  return useMutation<ContentCreated, Error, File[]>({
    mutationFn: (files) => uploadScreens(files),
    onSuccess: (content) => {
      setContent(content.content_id, content.content_type);
    },
  });
}

export function useUploadStaticMutation() {
  const setContent = useWizardStore((state) => state.setContent);

  return useMutation<ContentCreated, Error, File>({
    mutationFn: (file) => uploadStatic(file),
    onSuccess: (content) => {
      setContent(content.content_id, content.content_type);
    },
  });
}
