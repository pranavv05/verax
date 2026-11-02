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

  // Whether a GSTR-2B snapshot has been uploaded for this client+period, so the
  // UI can prompt an upload before showing an empty reconciliation.
  getGstr2bSnapshot({ clientId, period }) {
    return request(`/api/compliance/gstr2b/snapshot${toQuery({ clientId, period })}`);
  },

  // Upload a GSTR-2B portal export (JSON or Excel) for a client+period.
  uploadGstr2b({ clientId, period, file }) {
    const formData = new FormData();
    formData.append("clientId", clientId);
    formData.append("period", period);
    formData.append("file", file);
    return request("/api/compliance/gstr2b/upload", {
      method: "POST",
      body: formData
    });
  },

  // ITC Desk — portfolio ITC-at-risk across all clients for a period.
  getItcDesk({ period }) {
    return request(`/api/compliance/itc-desk${toQuery({ period })}`);
  },

  // IMS action tracking for a client+period.
  getImsActions({ clientId, period }) {
    return request(`/api/compliance/ims${toQuery({ clientId, period })}`);
  },

  setImsAction({ clientId, actionId, action, note }) {
    return request("/api/compliance/ims/action", {
      method: "POST",
      body: { clientId, actionId, action, note }
    });
  },

  // GST taxpayer session (live GSTR-2B via GSP). The CA triggers an OTP to the
  // client, the client reads it back, the CA verifies it to connect the GSTIN.
  getGstSession({ clientId }) {
    return request(`/api/compliance/gstr2b/session${toQuery({ clientId })}`);
  },

  requestGstOtp({ clientId, gstUsername }) {
    return request("/api/compliance/gstr2b/session/otp", {
      method: "POST",
      body: { clientId, gstUsername }
    });
  },

  verifyGstOtp({ clientId, otp }) {
    return request("/api/compliance/gstr2b/session/verify", {
      method: "POST",
      body: { clientId, otp }
    });
  },

  disconnectGstSession({ clientId }) {
    return request(`/api/compliance/gstr2b/session${toQuery({ clientId })}`, { method: "DELETE" });
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
