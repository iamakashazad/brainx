import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { queryClient } from "./lib/queryClient";
import { useThemeStore } from "./stores/themeStore";
import "./styles/index.css";

async function prepareApp() {
  document.documentElement.classList.toggle(
    "dark",
    useThemeStore.getState().theme === "dark",
  );

  if (import.meta.env.DEV && import.meta.env.VITE_USE_MSW === "1") {
    const { worker } = await import("../tests/msw/browser");
    await worker.start({ onUnhandledRequest: "bypass" });
  }

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </React.StrictMode>,
  );
}

void prepareApp();
