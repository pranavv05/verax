import { request } from "../lib/api-client";

export const authApi = {
  login(payload) {
    return request("/api/auth/login", {
      method: "POST",
      body: payload,
      auth: false
    });
  },
  refresh() {
    return request("/api/auth/refresh", {
      method: "POST",
      auth: false
    });
  },
  logout() {
    return request("/api/auth/logout", {
      method: "POST",
      auth: false
    });
  },
  validateMagicToken(token) {
    return request(`/api/auth/magic/${token}`, {
      method: "GET",
      auth: false
    });
  }
};
