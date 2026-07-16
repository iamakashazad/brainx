import { beforeEach, describe, expect, it, vi } from "vitest";

describe("themeStore", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    vi.resetModules();
  });

  it("defaults to dark", async () => {
    const { useThemeStore } = await import("../themeStore");
    expect(useThemeStore.getState().theme).toBe("dark");
  });

  it("toggles dark to light and back", async () => {
    const { useThemeStore } = await import("../themeStore");
    useThemeStore.getState().toggle();
    expect(useThemeStore.getState().theme).toBe("light");
    useThemeStore.getState().toggle();
    expect(useThemeStore.getState().theme).toBe("dark");
  });

  it("persists the selected theme", async () => {
    const { useThemeStore } = await import("../themeStore");
    useThemeStore.getState().setTheme("light");
    expect(JSON.parse(localStorage.getItem("brainx-theme") ?? "{}")).toMatchObject({
      state: { theme: "light" },
    });
  });

  it("restores the persisted theme on import", async () => {
    localStorage.setItem("brainx-theme", JSON.stringify({ state: { theme: "light" }, version: 0 }));
    const { useThemeStore } = await import("../themeStore");
    expect(useThemeStore.getState().theme).toBe("light");
  });
});

