import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type Theme = "dark" | "light";

type ThemeState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
};

function applyThemeClass(theme: Theme) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.classList.toggle("dark", theme === "dark");
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "dark",
      setTheme: (theme) => {
        applyThemeClass(theme);
        set({ theme });
      },
      toggle: () =>
        set((state) => {
          const theme = state.theme === "dark" ? "light" : "dark";
          applyThemeClass(theme);
          return { theme };
        }),
    }),
    {
      name: "brainx-theme",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        applyThemeClass(state?.theme ?? "dark");
      },
    },
  ),
);

