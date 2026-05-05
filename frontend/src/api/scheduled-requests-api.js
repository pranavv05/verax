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

export const scheduledRequestsApi = {
  list(params = {}) {
    return request(`/api/scheduled-requests${toQuery(params)}`);
  },
  create(payload) {
    return request("/api/scheduled-requests", {
      method: "POST",
      body: payload
    });
  },
  update(id, payload) {
    return request(`/api/scheduled-requests/${id}`, {
      method: "PATCH",
      body: payload
    });
  },
  remove(id) {
    return request(`/api/scheduled-requests/${id}`, {
      method: "DELETE"
    });
  }
};
