import { Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { DashboardPage } from "./pages/DashboardPage";
import { PersonasPage } from "./pages/PersonasPage";
import { PersonaStepPage } from "./pages/PersonaStepPage";
import { ContentStepPage } from "./pages/ContentStepPage";
import { RunningPage } from "./pages/RunningPage";
import { ResultsPage } from "./pages/ResultsPage";
import { SharedResultsPage } from "./features/results/SharedResultsPage";

export function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/personas" element={<PersonasPage />} />
        <Route path="/analysis/new" element={<PersonaStepPage />} />
        <Route path="/analysis/new/content" element={<ContentStepPage />} />
        <Route path="/analysis/:jobId/running" element={<RunningPage />} />
        <Route path="/analysis/:jobId/results" element={<ResultsPage />} />
        <Route path="/results/:jobId" element={<SharedResultsPage />} />
      </Routes>
    </AppShell>
  );
}
