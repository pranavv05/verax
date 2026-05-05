import { request } from "../lib/api-client";

export const notificationsApi = {
  list({ unreadOnly = false } = {}) {
    const q = new URLSearchParams();
    if (unreadOnly) q.set("unreadOnly", "true");
    const query = q.toString();
    return request(`/api/notifications${query ? `?${query}` : ""}`);
  },

  markRead(id) {
    return request(`/api/notifications/${id}/read`, {
      method: "PATCH"
    });
  },

  markAllRead() {
    return request("/api/notifications/read-all", {
      method: "PATCH"
    });
  }
};
