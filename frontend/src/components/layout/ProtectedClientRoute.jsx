import { Navigate, useLocation } from "react-router-dom";
import { useClientPortalAuth } from "../../contexts/ClientPortalAuthContext";
import { AppThemeRoot } from "../../contexts/ThemeContext";
import LoadingState from "../ui/LoadingState";

const ProtectedClientRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useClientPortalAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <AppThemeRoot className="flex items-center justify-center px-4">
        <LoadingState message="Loading your portal…" />
      </AppThemeRoot>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/client-portal/login" replace state={{ from: location.pathname }} />;
  }

  return children;
};

export default ProtectedClientRoute;
