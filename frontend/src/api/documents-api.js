import { request } from "../lib/api-client";

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

export const documentsApi = {
  list(params) {
    return request(`/api/documents${toQuery(params)}`);
  },
  getById(id) {
    return request(`/api/documents/${id}`);
  },
  requestUpload(payload) {
    return request("/api/documents/upload", {
      method: "POST",
      body: payload
    });
  },
  confirmUpload(documentId) {
    return request("/api/documents/confirm", {
      method: "POST",
      body: { document_id: documentId }
    });
  },
  remove(id) {
    return request(`/api/documents/${id}`, {
      method: "DELETE"
    });
  }
};
