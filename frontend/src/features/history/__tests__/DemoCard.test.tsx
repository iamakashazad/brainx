import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DemoCard } from "../DemoCard";

describe("DemoCard", () => {
  it("renders the demo copy", () => {
    render(<DemoCard onOpen={vi.fn()} />);
    expect(screen.getByText("DEMO")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sample Analysis" })).toBeInTheDocument();
    expect(screen.getByText("Explore a pre-built result — no inference required.")).toBeInTheDocument();
  });

  it("uses the required visual distinction classes", () => {
    render(<DemoCard onOpen={vi.fn()} />);
    expect(screen.getByTestId("demo-card")).toHaveClass("border-2");
    expect(screen.getByTestId("demo-card")).toHaveClass("border-primary");
  });

  it("renders the pin icon", () => {
    render(<DemoCard onOpen={vi.fn()} />);
    expect(screen.getByTestId("demo-pin-icon")).toBeInTheDocument();
  });

  it("opens when clicked", async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    render(<DemoCard onOpen={onOpen} />);
    await user.click(screen.getByRole("button", { name: /sample analysis/i }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});

