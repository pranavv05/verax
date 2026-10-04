import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authApi } from "../api/auth-api";
import { setUnauthorizedHandler } from "../lib/api-client";
import { tokenStore, userStore } from "../lib/token-store";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => userStore.getUser());
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  const clearSession = useCallback(() => {
    tokenStore.clearAccessToken();
    userStore.clearUser();
    setUser(null);
  }, []);

  const bootstrap = useCallback(async () => {
    try {
      const refreshed = await authApi.refresh();
      tokenStore.setAccessToken(refreshed.accessToken);
      if (refreshed.user) {
        userStore.setUser(refreshed.user);
        setUser(refreshed.user);
      }
    } catch {
      clearSession();
    } finally {
      setIsBootstrapping(false);
    }
  }, [clearSession]);

  useEffect(() => {
    setUnauthorizedHandler(clearSession);
    bootstrap();
  }, [bootstrap, clearSession]);

  const login = useCallback(async (credentials) => {
    const result = await authApi.login(credentials);
    tokenStore.setAccessToken(result.accessToken);
    if (result.user) {
      userStore.setUser(result.user);
      setUser(result.user);
    }
    return result;
  }, []);

  // Same session hand-off as login. Writing the token store directly is not
  // enough: isAuthenticated only recomputes when `user` changes, so the
  // dashboard route still saw a signed-out user and bounced to /login.
  const signup = useCallback(async (payload) => {
    const result = await authApi.signup(payload);
    tokenStore.setAccessToken(result.accessToken);
    if (result.user) {
      userStore.setUser(result.user);
      setUser(result.user);
    }
    return result;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(tokenStore.getAccessToken()),
      isBootstrapping,
      login,
      signup,
      logout,
      clearSession
    }),
    [user, isBootstrapping, login, signup, logout, clearSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
};
