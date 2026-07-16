import { Moon, Sun } from "lucide-react";
import { useThemeStore } from "@/stores/themeStore";

export function ThemeToggle() {
  const theme = useThemeStore((state) => state.theme);
  const toggle = useThemeStore((state) => state.toggle);
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={toggle}
      className="inline-flex h-11 w-11 items-center justify-center rounded-full transition hover:opacity-90"
      style={{
        background: isDark ? "var(--color-brand-light)" : "var(--muted)",
        color: isDark ? "var(--color-brand-deep)" : "var(--muted-foreground)",
        border: "1px solid var(--border-medium)",
      }}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

