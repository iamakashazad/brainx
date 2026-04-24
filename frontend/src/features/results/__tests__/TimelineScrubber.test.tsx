import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TimelineScrubber } from "../TimelineScrubber";

const useReducedMotion = vi.fn(() => false);

vi.mock("framer-motion", async () => {
  const actual = await vi.importActual<typeof import("framer-motion")>("framer-motion");
  return {
    ...actual,
    useReducedMotion: () => useReducedMotion(),
  };
});

describe("TimelineScrubber", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useReducedMotion.mockReturnValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("auto-plays once on first mount and then lets the user drag to a target screen", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<TimelineScrubber screenCount={4} value={0} onChange={onChange} />);

    vi.advanceTimersByTime(2400);
    expect(onChange).toHaveBeenCalledWith(0);
    expect(onChange).toHaveBeenCalledWith(1);
    expect(onChange).toHaveBeenCalledWith(2);
    expect(onChange).toHaveBeenCalledWith(3);

    await user.click(screen.getByRole("slider"));

    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuetext", "Screen 1 of 4");
  });

  it("cancels autoplay after user interaction and respects reduced motion", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    const { rerender } = render(<TimelineScrubber screenCount={4} value={0} onChange={onChange} />);

    await user.pointer({
      target: screen.getByRole("slider"),
      keys: "[MouseLeft]",
    });

    vi.advanceTimersByTime(2400);
    expect(onChange).not.toHaveBeenCalled();

    useReducedMotion.mockReturnValue(true);
    rerender(<TimelineScrubber screenCount={4} value={0} onChange={onChange} />);

    vi.advanceTimersByTime(2400);
    expect(onChange).not.toHaveBeenCalled();
  });
});
