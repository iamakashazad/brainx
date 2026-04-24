import { Route, Routes } from "react-router-dom";
import { WizardShell } from "./features/wizard/WizardShell";

export function App() {
  return (
    <Routes>
      <Route path="*" element={<WizardShell />} />
    </Routes>
  );
}
