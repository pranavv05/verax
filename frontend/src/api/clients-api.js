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

export const clientsApi = {
  list(params) {
    return request(`/api/clients${toQuery(params)}`);
  },
  getById(id) {
    return request(`/api/clients/${id}`);
  },
  create(payload) {
    return request("/api/clients", {
      method: "POST",
      body: payload
    });
  },
  update(id, payload) {
    return request(`/api/clients/${id}`, {
      method: "PUT",
      body: payload
    });
  },
  remove(id) {
    return request(`/api/clients/${id}`, {
      method: "DELETE"
    });
  },
  requestDocuments(id, payload) {
    return request(`/api/clients/${id}/request-docs`, {
      method: "POST",
      body: payload
    });
  },
  enablePortal(id, payload) {
    return request(`/api/clients/${id}/enable-portal`, {
      method: "POST",
      body: payload
    });
  },

  async downloadImportTemplate() {
    const url = `${API_BASE_URL}/api/clients/import/template`;
    const fetchTemplate = () => {
      const token = tokenStore.getAccessToken();
      return fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include"
      });
    };

    let response = await fetchTemplate();
    if (response.status === 401) {
      await refreshAccessToken();
      response = await fetchTemplate();
    }

    if (!response.ok) {
      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      throw new Error(payload?.message || payload?.error || "Unable to download template");
    }

    const blob = await response.blob();
    const objectUrl = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = "verax-client-import-template.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(objectUrl);
  },

  previewImport(file) {
    const formData = new FormData();
    formData.append("file", file);
    return request("/api/clients/import/preview", {
      method: "POST",
      body: formData
    });
  },

  confirmImport(rows) {
    return request("/api/clients/import/confirm", {
      method: "POST",
      body: { rows }
    });
  }
};
