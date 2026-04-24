import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { ScreenUploader } from "../ScreenUploader";
import { server } from "../../../../tests/msw/server";

function createFile(name: string) {
  return new File([new Uint8Array([1, 2, 3])], name, { type: "image/png" });
}

function renderScreenUploader() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <ScreenUploader />
    </QueryClientProvider>,
  );
}

describe("ScreenUploader", () => {
  it("renders the exact drop-zone label", () => {
    renderScreenUploader();

    expect(
      screen.getByText("Drop 1–5 UI screens here, or click to browse"),
    ).toBeInTheDocument();
  });

  it("shows the 2/5 screens added caption after uploading two images", async () => {
    const user = userEvent.setup();
    renderScreenUploader();

    await user.upload(screen.getByLabelText("Upload files"), [
      createFile("screen-1.png"),
      createFile("screen-2.png"),
    ]);

    expect(screen.getByText("2/5 screens added")).toBeInTheDocument();
  });

  it("clamps to five files and shows an inline error for extras", async () => {
    const user = userEvent.setup();
    renderScreenUploader();

    await user.upload(
      screen.getByLabelText("Upload files"),
      Array.from({ length: 6 }, (_, index) => createFile(`screen-${index + 1}.png`)),
    );

    expect(screen.getAllByRole("img")).toHaveLength(5);
    expect(
      screen.getByText("Only 1–5 screens allowed. Extra files were not added."),
    ).toBeInTheDocument();
  });

  it("uploads multipart form data without an explicit content-type header", async () => {
    const user = userEvent.setup();
    let fileCount = 0;
    let contentTypeHeader: string | null = null;

    server.use(
      http.post("http://localhost:8000/content/screens", async ({ request }) => {
        const formData = await request.formData();
        fileCount = formData.getAll("files").length;
        contentTypeHeader = request.headers.get("Content-Type");

        return HttpResponse.json(
          { content_id: "c-screens-1", content_type: "ui_screens" },
          { status: 201 },
        );
      }),
    );

    renderScreenUploader();

    await user.upload(screen.getByLabelText("Upload files"), [
      createFile("screen-1.png"),
      createFile("screen-2.png"),
    ]);

    await waitFor(() => {
      expect(fileCount).toBe(2);
    });

    expect(contentTypeHeader ?? "").not.toContain("application/json");
  });
});
