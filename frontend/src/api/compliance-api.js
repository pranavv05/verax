import { API_BASE_URL, refreshAccessToken, request } from "../lib/api-client";
import { tokenStore } from "../lib/token-store";

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

export const complianceApi = {
  verifyGstin(gstin) {
    return request("/api/compliance/gstin/verify", {
      method: "POST",
      body: { gstin }
    });
  },

  matchGstr2b({ gstin, period, documentIds }) {
    return request("/api/compliance/gstr2b/match", {
      method: "POST",
      body: { gstin, period, documentIds }
    });
  },

  getReconciliation({ clientId, period }) {
    return request(`/api/compliance/gstr2b/reconciliation${toQuery({ clientId, period })}`);
  },

  async downloadReconciliationExcel({ clientId, period }) {
    const url = `${API_BASE_URL}/api/compliance/gstr2b/reconciliation/export${toQuery({ clientId, period })}`;
    const fetchWorkbook = () => {
      const token = tokenStore.getAccessToken();
      return fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include"
      });
    };

    let response = await fetchWorkbook();
    if (response.status === 401) {
      await refreshAccessToken();
      response = await fetchWorkbook();
    }

    if (!response.ok) {
      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      throw new Error(payload?.message || payload?.error || "Unable to export reconciliation");
    }

    const blob = await response.blob();
    const objectUrl = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = `gst-reconciliation-${period}.xlsx`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(objectUrl);
  }
};
