import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import PrivateRoute from "./components/PrivateRoute";
import LoginPage from "./pages/LoginPage";
import WorkoutListPage from "./pages/WorkoutListPage";
import WorkoutRunnerPage from "./pages/WorkoutRunnerPage";
import WorkoutCreatorPage from "./pages/WorkoutCreatorPage";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <WorkoutListPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/workout/:id"
            element={
              <PrivateRoute>
                <WorkoutRunnerPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/workout/create"
            element={
              <PrivateRoute>
                <WorkoutCreatorPage />
              </PrivateRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
