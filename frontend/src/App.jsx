import { Suspense, lazy } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/layout/ProtectedRoute";
import ProtectedClientRoute from "./components/layout/ProtectedClientRoute";
import { ClientPortalAuthProvider } from "./contexts/ClientPortalAuthContext";
import AboutPage from "./pages/AboutPage";
import PricingPage from "./pages/PricingPage";
import SecurityPage from "./pages/SecurityPage";
import FeaturesPage from "./pages/FeaturesPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import NotFoundPage from "./pages/NotFoundPage";
import PublicUploadPage from "./pages/PublicUploadPage";
import PublicUploadStatusPage from "./pages/PublicUploadStatusPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import SignupPage from "./pages/SignupPage";

/*
 * Route-level code splitting.
 *
 * The public marketing pages stay in the main bundle — they are the first
 * thing most visitors load and must paint without waiting on a second
 * request. Everything behind a login is split out, so a visitor reading the
 * homepage no longer downloads the review screen, the export flow and the
 * client portal along with it.
 */
const AuditLogPage = lazy(() => import("./pages/AuditLogPage"));
const ClientDetailPage = lazy(() => import("./pages/ClientDetailPage"));
const ClientDocumentsPage = lazy(() => import("./pages/ClientDocumentsPage"));
const ClientsPage = lazy(() => import("./pages/ClientsPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const ExportPage = lazy(() => import("./pages/ExportPage"));
const GSTReconciliationPage = lazy(() => import("./pages/GSTReconciliationPage"));
const ReviewPage = lazy(() => import("./pages/ReviewPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const TeamPage = lazy(() => import("./pages/TeamPage"));
const ToolsPage = lazy(() => import("./pages/ToolsPage"));
const ClientPortalDashboardPage = lazy(() => import("./pages/ClientPortalDashboardPage"));
const ClientPortalDocumentsPage = lazy(() => import("./pages/ClientPortalDocumentsPage"));
const ClientPortalLoginPage = lazy(() => import("./pages/ClientPortalLoginPage"));
const ClientPortalReconciliationPage = lazy(() => import("./pages/ClientPortalReconciliationPage"));
const ClientPortalSettingsPage = lazy(() => import("./pages/ClientPortalSettingsPage"));

const Protected = ({ children }) => <ProtectedRoute>{children}</ProtectedRoute>;
const ProtectedClient = ({ children }) => <ProtectedClientRoute>{children}</ProtectedClientRoute>;

/**
 * Shown only while a split chunk is in flight — deliberately near-empty, so a
 * fast connection never flashes a spinner between the click and the page.
 */
const RouteFallback = () => (
  <div className="min-h-screen" role="status" aria-live="polite">
    <span className="sr-only">Loading…</span>
  </div>
);

const App = () => (
  <Suspense fallback={<RouteFallback />}>
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

      {/*
      Client portal — a separate world. The ClientPortalAuthProvider is mounted
      only under this branch, so the firm AuthContext and the client session
      never share state, and each portal's pages own their own shell.
    */}
      <Route
        path="/client-portal"
        element={
          <ClientPortalAuthProvider>
            <Outlet />
          </ClientPortalAuthProvider>
        }
      >
        <Route
          index
          element={<Navigate to="/client-portal/dashboard" replace />}
        />
        <Route path="login" element={<ClientPortalLoginPage />} />
        <Route
          path="dashboard"
          element={
            <ProtectedClient>
              <ClientPortalDashboardPage />
            </ProtectedClient>
          }
        />
        <Route
          path="documents"
          element={
            <ProtectedClient>
              <ClientPortalDocumentsPage />
            </ProtectedClient>
          }
        />
        <Route
          path="reconciliation"
          element={
            <ProtectedClient>
              <ClientPortalReconciliationPage />
            </ProtectedClient>
          }
        />
        <Route
          path="settings"
          element={
            <ProtectedClient>
              <ClientPortalSettingsPage />
            </ProtectedClient>
          }
        />
        <Route
          path="*"
          element={<Navigate to="/client-portal/dashboard" replace />}
        />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  </Suspense>
);

export default App;
