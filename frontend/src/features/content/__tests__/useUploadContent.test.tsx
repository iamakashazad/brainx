/**
 * An upload that resolves after the visible content changed must not write its
 * contentId back into the wizard store, and a failed upload must not leave the
 * previous content submittable behind the new preview.
 */

import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { useWizardStore } from "@/stores/wizardStore";
import { discardContent, useTextContentMutation } from "../useUploadContent";
import { server } from "../../../../tests/msw/server";

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("content upload mutations", () => {
  beforeEach(() => {
    useWizardStore.setState({ contentId: null, contentType: null });
  });

  it("ignores an upload that resolves after the content was discarded", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.post("http://localhost:8000/content/text", async () => {
        await gate;
        return HttpResponse.json({ content_id: "c-late", content_type: "text" }, { status: 201 });
      }),
    );

    const { result } = renderHook(() => useTextContentMutation(), { wrapper });
    act(() => result.current.mutate("hello"));
    await waitFor(() => expect(result.current.isPending).toBe(true));

    act(() => discardContent());
    release();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(useWizardStore.getState().contentId).toBeNull();
  });

  it("clears previous content when a new upload fails", async () => {
    useWizardStore.getState().setContent("c-old", "text");
    server.use(
      http.post("http://localhost:8000/content/text", () =>
        HttpResponse.json({ detail: "text too long" }, { status: 422 }),
      ),
    );

    const { result } = renderHook(() => useTextContentMutation(), { wrapper });
    act(() => result.current.mutate("new text"));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain("text too long");
    expect(useWizardStore.getState().contentId).toBeNull();
  });

  it("stores content from the latest successful upload", async () => {
    const { result } = renderHook(() => useTextContentMutation(), { wrapper });
    act(() => result.current.mutate("hello"));

    await waitFor(() => expect(useWizardStore.getState().contentId).toBe("c-text-1"));
    expect(useWizardStore.getState().contentType).toBe("text");
  });
});
