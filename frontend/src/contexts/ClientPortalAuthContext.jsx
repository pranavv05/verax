import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { clientPortalApi } from "../api/client-portal-api";
import { clientTokenStore, setClientUnauthorizedHandler } from "../lib/client-portal-client";

const ClientPortalAuthContext = createContext(null);

export const ClientPortalAuthProvider = ({ children }) => {
  const [client, setClient] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  // Token lives in module scope (never localStorage), so a state counter is what
  // makes isAuthenticated re-render when it changes.
  const [sessionVersion, setSessionVersion] = useState(0);

  const clearSession = useCallback(() => {
    clientTokenStore.clearAccessToken();
    setClient(null);
    setSessionVersion((version) => version + 1);
  }, []);

  const bootstrap = useCallback(async () => {
    try {
      const refreshed = await clientPortalApi.refresh();
      clientTokenStore.setAccessToken(refreshed.accessToken);
      setClient(refreshed.client || null);
      setSessionVersion((version) => version + 1);
    } catch {
      clearSession();
    } finally {
      setIsLoading(false);
    }
  }, [clearSession]);

  useEffect(() => {
    setClientUnauthorizedHandler(clearSession);
    bootstrap();
  }, [bootstrap, clearSession]);

  const login = useCallback(async (credentials) => {
    const result = await clientPortalApi.login(credentials);
    clientTokenStore.setAccessToken(result.accessToken);
    setClient(result.client || null);
    setSessionVersion((version) => version + 1);
    return result;
  }, []);

  const logout = useCallback(async () => {
    try {
      await clientPortalApi.logout();
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const value = useMemo(
    () => ({
      client,
      clientId: client?.id || null,
      // No firmId here on purpose: the client's firm is carried inside the JWT
      // and enforced server-side. The portal UI never needs it, so the API does
      // not ship it to the browser.
      clientName: client?.name || "",
      firmName: client?.firmName || "",
      isAuthenticated: Boolean(clientTokenStore.getAccessToken()),
      isLoading,
      login,
      logout,
      clearSession
    }),
    // sessionVersion is intentionally a dependency: it is the signal that the
    // module-scope token changed.
    [client, isLoading, login, logout, clearSession, sessionVersion]
  );

  return (
    <ClientPortalAuthContext.Provider value={value}>{children}</ClientPortalAuthContext.Provider>
  );
};

export const useClientPortalAuth = () => {
  const context = useContext(ClientPortalAuthContext);
  if (!context) {
    throw new Error("useClientPortalAuth must be used inside ClientPortalAuthProvider");
  }
  return context;
};
