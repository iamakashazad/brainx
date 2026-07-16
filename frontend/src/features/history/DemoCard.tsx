import { motion } from "framer-motion";
import { Pin } from "lucide-react";

type DemoCardProps = {
  onOpen: () => void;
};

export function DemoCard({ onOpen }: DemoCardProps) {
  return (
    <motion.button
      type="button"
      data-testid="demo-card"
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      onClick={onOpen}
      className="w-full border-2 border-primary text-left transition"
      style={{
        background: "var(--card)",
        borderRadius: "var(--radius)",
        padding: "24px",
        boxShadow: "var(--shadow)",
        cursor: "pointer",
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <Pin data-testid="demo-pin-icon" className="h-4 w-4" style={{ color: "var(--primary)" }} />
          <span
            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
            style={{
              background: "var(--color-brand-light)",
              color: "var(--color-brand-deep)",
              fontFamily: "var(--font-mono)",
              letterSpacing: "0.6px",
            }}
          >
            DEMO
          </span>
        </div>
      </div>
      <h3 className="mt-4 text-base font-semibold" style={{ color: "var(--foreground)" }}>
        Sample Analysis
      </h3>
      <p className="mt-1.5 text-sm" style={{ color: "var(--muted-foreground)", lineHeight: 1.6 }}>
        Explore a pre-built result — no inference required.
      </p>
    </motion.button>
  );
}

