import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { AppThemeRoot } from "../../contexts/ThemeContext";
import LoadingState from "../ui/LoadingState";

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isBootstrapping } = useAuth();
  const location = useLocation();

  if (isBootstrapping) {
    return (
      <AppThemeRoot className="flex items-center justify-center">
        <LoadingState message="Loading workspace…" />
      </AppThemeRoot>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
};

export default ProtectedRoute;
