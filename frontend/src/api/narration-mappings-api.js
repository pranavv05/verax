import { request } from "../lib/api-client";

export const narrationMappingsApi = {
  list() {
    return request("/api/narration-mappings");
  },
  create(payload) {
    return request("/api/narration-mappings", {
      method: "POST",
      body: payload
    });
  },
  remove(id) {
    return request(`/api/narration-mappings/${id}`, {
      method: "DELETE"
    });
  },
  apply(transactions) {
    return request("/api/narration-mappings/apply", {
      method: "POST",
      body: { transactions }
    });
  }
};
