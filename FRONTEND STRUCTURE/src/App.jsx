import { Routes, Route, Navigate } from "react-router-dom";

/* AUTH */
import AuthPage from "./components/AuthPage";

/* PAGES */
import Dashboard from "./pages/Dashboard";
import IntakeStage from "./pages/IntakeStage";
import QuestionsStage from "./pages/QuestionsStage";
import MappingStage from "./pages/MappingStage";
import ArchitectureStage from "./pages/ArchitectureStage";
import ApproachStage from "./pages/ApproachStage";
import ScoreStage from "./pages/ScoreStage";
import FacultyDashboard from "./pages/FacultyDashboard";

function App() {

  return (

    <Routes>

      {/* LOGIN PAGE */}

      <Route
        path="/"
        element={<AuthPage />}
      />
      <Route
  path="/faculty-dashboard"
  element={<FacultyDashboard />}
/>
      {/* DASHBOARD */}

      <Route
        path="/dashboard"
        element={<Dashboard />}
      />

      {/* NEW OPPORTUNITY */}

      <Route
        path="/new"
        element={<IntakeStage />}
      />

      {/* DECISION QUESTIONS */}

      <Route
        path="/questions"
        element={<QuestionsStage />}
      />

      {/* COMPETENCY MAPPING */}

      <Route
        path="/mapping"
        element={<MappingStage />}
      />

      {/* PROGRAMME ARCHITECTURE */}

      <Route
        path="/architecture"
        element={<ArchitectureStage />}
      />

      {/* APPROACH NOTE */}

      <Route
        path="/approach"
        element={<ApproachStage />}
      />

      {/* PROPOSAL SCORE */}

      <Route
        path="/score"
        element={<ScoreStage />}
      />

      {/* FALLBACK */}

      <Route
        path="*"
        element={<Navigate to="/" replace />}
      />

    </Routes>

  );
}

export default App;
