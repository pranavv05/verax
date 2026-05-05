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

export const exportsApi = {
  generateTally(payload) {
    return request("/api/export/tally", {
      method: "POST",
      body: payload
    });
  },
  generateBulk(payload) {
    return request("/api/export/bulk", {
      method: "POST",
      body: payload
    });
  },
  preview(payload) {
    return request("/api/export/preview", {
      method: "POST",
      body: payload
    });
  },
  history(params) {
    return request(`/api/export/history${toQuery(params)}`);
  },
  download(exportId) {
    return request(`/api/export/${exportId}/download`);
  }
};
