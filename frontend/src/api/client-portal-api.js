import { clientRequest } from "../lib/client-portal-client";

const toQuery = (params = {}) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, String(value));
    }
  });
  const query = searchParams.toString();
  return query ? `?${query}` : "";
};

export const clientPortalApi = {
  login(payload) {
    return clientRequest("/api/client-portal/auth/login", {
      method: "POST",
      body: payload,
      auth: false
    });
  },
  refresh() {
    return clientRequest("/api/client-portal/auth/refresh", {
      method: "POST",
      auth: false,
      skipRefresh: true
    });
  },
  logout() {
    return clientRequest("/api/client-portal/auth/logout", {
      method: "POST",
      auth: false
    });
  },
  changePassword(payload) {
    return clientRequest("/api/client-portal/auth/change-password", {
      method: "POST",
      body: payload
    });
  },
  me() {
    return clientRequest("/api/client-portal/me");
  },
  stats() {
    return clientRequest("/api/client-portal/stats");
  },
  documents(params) {
    return clientRequest(`/api/client-portal/documents${toQuery(params)}`);
  },
  document(id) {
    return clientRequest(`/api/client-portal/documents/${id}`);
  },
  documentDownload(id) {
    return clientRequest(`/api/client-portal/documents/${id}/download`);
  },
  reconciliation(params) {
    return clientRequest(`/api/client-portal/reconciliation${toQuery(params)}`);
  },
  reconciliationExport(params) {
    return clientRequest(`/api/client-portal/reconciliation/export${toQuery(params)}`, {
      responseType: "blob"
    });
  },
  exports() {
    return clientRequest("/api/client-portal/exports");
  }
};
