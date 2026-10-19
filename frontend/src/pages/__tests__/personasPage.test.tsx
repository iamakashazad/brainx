/**
 * Persona cards: "Analyze" must be reachable without a mouse, and a refused
 * delete (409, persona still used by a job) must show the server's reason.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { PersonasPage } from "../PersonasPage";
import { server } from "../../../tests/msw/server";

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <PersonasPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("PersonasPage", () => {
  it("reveals Analyze when keyboard focus enters a card", async () => {
    const user = userEvent.setup();
    renderPage();

    const deleteButton = (await screen.findAllByRole("button", { name: /^Delete persona:/ }))[0]!;
    const card = deleteButton.closest("article")!;
    expect(within(card).queryByRole("button", { name: /Analyze/ })).not.toBeInTheDocument();

    deleteButton.focus();
    await user.keyboard("{Shift>}{Tab}{/Shift}");
    deleteButton.focus();

    expect(await within(card).findByRole("button", { name: /Analyze/ })).toBeInTheDocument();
  });

  it("shows the server's reason when a delete is refused", async () => {
    server.use(
      http.delete("http://localhost:8000/personas/:id", () =>
        HttpResponse.json(
          { detail: "Persona is still referenced by existing analyze jobs" },
          { status: 409 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderPage();

    const deleteButton = (await screen.findAllByRole("button", { name: /^Delete persona:/ }))[0]!;
    await user.click(deleteButton);
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("still referenced by existing analyze jobs"),
    );
  });
});
