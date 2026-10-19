import { Route, Routes, useLocation } from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AppShell } from "./components/AppShell";
import { DashboardPage } from "./pages/DashboardPage";
import { PersonasPage } from "./pages/PersonasPage";
import { PersonaStepPage } from "./pages/PersonaStepPage";
import { ContentStepPage } from "./pages/ContentStepPage";
import { RunningPage } from "./pages/RunningPage";
import { ResultsPage } from "./pages/ResultsPage";
import { SharedResultsPage } from "./features/results/SharedResultsPage";

function PageCrashed({ error }: { error: Error }) {
  return (
    <div role="alert" className="mx-auto max-w-xl px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold text-foreground">Something broke on this page</h1>
      <p className="mt-3 text-sm text-muted-foreground">{error.message}</p>
      <a href="/" className="mt-6 inline-block text-sm font-medium underline">
        Back to Dashboard
      </a>
    </div>
  );
}

export function App() {
  const location = useLocation();
  return (
    <AppShell>
      {/* Keyed on the path so navigating away from a crashed page recovers. */}
      <ErrorBoundary resetKey={location.pathname} fallback={(error) => <PageCrashed error={error} />}>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/personas" element={<PersonasPage />} />
        <Route path="/analysis/new" element={<PersonaStepPage />} />
        <Route path="/analysis/new/content" element={<ContentStepPage />} />
        <Route path="/analysis/:jobId/running" element={<RunningPage />} />
        <Route path="/analysis/:jobId/results" element={<ResultsPage />} />
        <Route path="/results/:jobId" element={<SharedResultsPage />} />
      </Routes>
      </ErrorBoundary>
    </AppShell>
  );
}
