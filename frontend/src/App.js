import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import LandingPage from "@/pages/LandingPage";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import Dashboard from "@/pages/Dashboard";
import PatientRegistration from "@/pages/PatientRegistration";
import PatientRecords from "@/pages/PatientRecords";
import PatientDetail from "@/pages/PatientDetail";
import Screening from "@/pages/Screening";
import ScreeningResult from "@/pages/ScreeningResult";
import MovementAssessment from "@/pages/MovementAssessment";
import DoctorReview from "@/pages/DoctorReview";
import AwarenessHub from "@/pages/AwarenessHub";
import Settings from "@/pages/Settings";

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route
              path="/app"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/app/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="patients" element={<PatientRecords />} />
              <Route path="patients/new" element={<PatientRegistration />} />
              <Route path="patients/:id" element={<PatientDetail />} />
              <Route path="screening" element={<Screening />} />
              <Route path="screening/:patientId" element={<Screening />} />
              <Route path="movement" element={<MovementAssessment />} />
              <Route path="movement/:patientId" element={<MovementAssessment />} />
              <Route path="result/:screeningId" element={<ScreeningResult />} />
              <Route
                path="doctor-review"
                element={
                  <ProtectedRoute roles={["doctor", "admin"]}>
                    <DoctorReview />
                  </ProtectedRoute>
                }
              />
              <Route path="awareness" element={<AwarenessHub />} />
              <Route path="settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </div>
  );
}

export default App;
