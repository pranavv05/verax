import { Navigate, useLocation } from "react-router-dom";
import { useClientPortalAuth } from "../../contexts/ClientPortalAuthContext";

const ProtectedClientRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useClientPortalAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-4">
        <div className="text-base font-semibold text-ink-700">Loading your portal...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/client-portal/login" replace state={{ from: location.pathname }} />;
  }

  return children;
};

export default ProtectedClientRoute;
