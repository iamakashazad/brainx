import { useEffect, useRef } from "react";
import * as Slider from "@radix-ui/react-slider";
import { useReducedMotion } from "framer-motion";

type TimelineScrubberProps = {
  screenCount: number;
  value: number;
  onChange: (value: number) => void;
  secondaryMarkers?: number[];
};

export function TimelineScrubber({
  screenCount,
  value,
  onChange,
  secondaryMarkers = [],
}: TimelineScrubberProps) {
  const prefersReducedMotion = useReducedMotion();
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    if (prefersReducedMotion || screenCount <= 0) return;

    onChange(0);
    let nextIndex = 1;
    const intervalId = window.setInterval(() => {
      if (cancelledRef.current) { window.clearInterval(intervalId); return; }
      if (nextIndex >= screenCount) { window.clearInterval(intervalId); return; }
      onChange(nextIndex);
      nextIndex += 1;
    }, 600);

    return () => { window.clearInterval(intervalId); };
  }, [onChange, prefersReducedMotion, screenCount]);

  const cancelAutoplay = () => { cancelledRef.current = true; };

  return (
    <div className="space-y-3">
      <Slider.Root
        min={0}
        max={Math.max(screenCount - 1, 0)}
        step={1}
        value={[value]}
        onValueChange={([next]) => { cancelAutoplay(); onChange(next ?? 0); }}
        onPointerDown={cancelAutoplay}
        onKeyDown={cancelAutoplay}
        aria-label="Timeline scrubber"
        className="relative flex min-h-11 w-full touch-none items-center"
      >
        <Slider.Track
          className="relative h-1.5 w-full rounded-full"
          style={{ background: "var(--muted)" }}
        >
          <Slider.Range
            className="absolute h-full rounded-full"
            style={{ background: "var(--color-brand)" }}
          />
          {secondaryMarkers.map((marker) => (
            <span
              key={`${marker}`}
              className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full"
              style={{
                background: "var(--color-brand)",
                opacity: 0.5,
                left:
                  screenCount <= 1
                    ? "0%"
                    : `${(marker / Math.max(screenCount - 1, 1)) * 100}%`,
              }}
            />
          ))}
        </Slider.Track>
        <Slider.Thumb
          aria-valuetext={`Screen ${value + 1} of ${screenCount}`}
          className="block h-4 w-4 rounded-full transition"
          style={{
            background: "var(--color-brand)",
            border: "2px solid var(--background)",
            boxShadow: "var(--shadow-sm)",
          }}
        />
      </Slider.Root>
      <div
        className="flex justify-between text-xs"
        style={{ color: "var(--muted-foreground)", fontFamily: "var(--font-mono)" }}
      >
        {Array.from({ length: screenCount }, (_, index) => (
          <span key={index}>{index + 1}</span>
        ))}
      </div>
    </div>
  );
}
