import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/layout/ProtectedRoute";
import AboutPage from "./pages/AboutPage";
import ClientDetailPage from "./pages/ClientDetailPage";
import ClientDocumentsPage from "./pages/ClientDocumentsPage";
import ClientsPage from "./pages/ClientsPage";
import DashboardPage from "./pages/DashboardPage";
import ExportPage from "./pages/ExportPage";
import FeaturesPage from "./pages/FeaturesPage";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import NotFoundPage from "./pages/NotFoundPage";
import PublicUploadPage from "./pages/PublicUploadPage";
import ReviewPage from "./pages/ReviewPage";
import SignupPage from "./pages/SignupPage";

const Protected = ({ children }) => <ProtectedRoute>{children}</ProtectedRoute>;

const App = () => (
  <Routes>
    {/* Public pages */}
    <Route path="/" element={<HomePage />} />
    <Route path="/features" element={<FeaturesPage />} />
    <Route path="/about" element={<AboutPage />} />
    <Route path="/signup" element={<SignupPage />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/upload/:token" element={<PublicUploadPage />} />

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
