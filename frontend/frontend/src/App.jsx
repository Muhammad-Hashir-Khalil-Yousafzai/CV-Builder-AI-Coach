import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/common/ProtectedRoute";
import AppLayout from "./components/common/AppLayout";
import RouteFallback from "./components/common/RouteFallback";
import DashboardPage from "./pages/DashboardPage"; // landing page after login: loaded up front so the welcome splash shows instantly
const SignupPage = lazy(() => import("./pages/SignupPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const AtsPage = lazy(() => import("./pages/AtsPage"));
const VersionsPage = lazy(() => import("./pages/VersionsPage"));
const JobMatches = lazy(() => import("./pages/JobMatches"));
const TrackerPage = lazy(() => import("./pages/TrackerPage"));
const CoachPage = lazy(() => import("./pages/CoachPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-center" />
        <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} /> {/* <-- add this */}

          <Route path="/dashboard" element={
            <ProtectedRoute><AppLayout><DashboardPage /></AppLayout></ProtectedRoute>
          } />
          <Route path="/versions" element={
            <ProtectedRoute><AppLayout><VersionsPage /></AppLayout></ProtectedRoute>
          } />
          <Route path="/profile" element={
            <ProtectedRoute><AppLayout><ProfilePage /></AppLayout></ProtectedRoute>
          } />
          <Route path="/ats" element={
            <ProtectedRoute><AppLayout><AtsPage /></AppLayout></ProtectedRoute>
          } />
          <Route path="/job-matches" element={
            <ProtectedRoute><AppLayout><JobMatches /></AppLayout></ProtectedRoute>
          } />
          <Route path="/tracker" element={
            <ProtectedRoute><AppLayout><TrackerPage /></AppLayout></ProtectedRoute>
          } />
          <Route path="/coach" element={
            <ProtectedRoute><AppLayout><CoachPage /></AppLayout></ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute requireAdmin><AppLayout><AdminPage /></AppLayout></ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/signup" replace />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}