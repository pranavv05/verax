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
  }
};
