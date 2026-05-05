import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/layout/ProtectedRoute";
import AboutPage from "./pages/AboutPage";
import AuditLogPage from "./pages/AuditLogPage";
import PricingPage from "./pages/PricingPage";
import SecurityPage from "./pages/SecurityPage";
import ClientDetailPage from "./pages/ClientDetailPage";
import ClientDocumentsPage from "./pages/ClientDocumentsPage";
import ClientsPage from "./pages/ClientsPage";
import DashboardPage from "./pages/DashboardPage";
import ExportPage from "./pages/ExportPage";
import FeaturesPage from "./pages/FeaturesPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import GSTReconciliationPage from "./pages/GSTReconciliationPage";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import NotFoundPage from "./pages/NotFoundPage";
import PublicUploadPage from "./pages/PublicUploadPage";
import PublicUploadStatusPage from "./pages/PublicUploadStatusPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import ReviewPage from "./pages/ReviewPage";
import SettingsPage from "./pages/SettingsPage";
import SignupPage from "./pages/SignupPage";
import TeamPage from "./pages/TeamPage";
import ToolsPage from "./pages/ToolsPage";

const Protected = ({ children }) => <ProtectedRoute>{children}</ProtectedRoute>;

const App = () => (
  <Routes>
    {/* Public pages */}
    <Route path="/" element={<HomePage />} />
    <Route path="/features" element={<FeaturesPage />} />
    <Route path="/about" element={<AboutPage />} />
    <Route path="/pricing" element={<PricingPage />} />
    <Route path="/security" element={<SecurityPage />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/signup" element={<SignupPage />} />
    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
    <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
    <Route path="/upload/:token" element={<PublicUploadPage />} />
    <Route path="/upload/:token/status" element={<PublicUploadStatusPage />} />

    {/* Protected dashboard pages */}
    <Route
      path="/dashboard"
      element={
        <Protected>
          <DashboardPage />
        </Protected>
      }
    />

    <Route
      path="/clients"
      element={
        <Protected>
          <ClientsPage />
        </Protected>
      }
    />

    <Route
      path="/clients/:id"
      element={
        <Protected>
          <ClientDetailPage />
        </Protected>
      }
    />

    <Route
      path="/clients/:clientId/gst-reconciliation"
      element={
        <Protected>
          <GSTReconciliationPage />
        </Protected>
      }
    />

    <Route
      path="/clients/:id/documents"
      element={
        <Protected>
          <ClientDocumentsPage />
        </Protected>
      }
    />

    <Route
      path="/documents/:doc_id/review"
      element={
        <Protected>
          <ReviewPage />
        </Protected>
      }
    />

    <Route
      path="/review/:doc_id"
      element={
        <Protected>
          <ReviewPage />
        </Protected>
      }
    />

    <Route
      path="/export"
      element={
        <Protected>
          <ExportPage />
        </Protected>
      }
    />

    <Route
      path="/settings"
      element={
        <Protected>
          <SettingsPage />
        </Protected>
      }
    />

    <Route
      path="/team"
      element={
        <Protected>
          <TeamPage />
        </Protected>
      }
    />

    <Route
      path="/audit-logs"
      element={
        <Protected>
          <AuditLogPage />
        </Protected>
      }
    />

    <Route
      path="/tools"
      element={
        <Protected>
          <ToolsPage />
        </Protected>
      }
    />

    <Route path="*" element={<NotFoundPage />} />
  </Routes>
);

export default App;
