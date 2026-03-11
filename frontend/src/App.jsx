import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/layout/ProtectedRoute";
import ClientDetailPage from "./pages/ClientDetailPage";
import ClientDocumentsPage from "./pages/ClientDocumentsPage";
import ClientsPage from "./pages/ClientsPage";
import DashboardPage from "./pages/DashboardPage";
import ExportPage from "./pages/ExportPage";
import LoginPage from "./pages/LoginPage";
import NotFoundPage from "./pages/NotFoundPage";
import PublicUploadPage from "./pages/PublicUploadPage";
import ReviewPage from "./pages/ReviewPage";

const Protected = ({ children }) => <ProtectedRoute>{children}</ProtectedRoute>;

const App = () => (
  <Routes>
    <Route path="/" element={<Navigate to="/dashboard" replace />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/upload/:token" element={<PublicUploadPage />} />

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
      path="/clients/:id/documents"
      element={
        <Protected>
          <ClientDocumentsPage />
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

    <Route path="*" element={<NotFoundPage />} />
  </Routes>
);

export default App;
