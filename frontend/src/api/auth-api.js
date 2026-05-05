import { request } from "../lib/api-client";

export const authApi = {
  signup(payload) {
    return request("/api/auth/signup", {
      method: "POST",
      body: payload,
      auth: false
    });
  },
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
  forgotPassword(payload) {
    return request("/api/auth/forgot-password", {
      method: "POST",
      body: payload,
      auth: false
    });
  },
  validatePasswordResetToken(token) {
    return request(`/api/auth/reset-password/${token}`, {
      method: "GET",
      auth: false
    });
  },
  resetPassword(payload) {
    return request("/api/auth/reset-password", {
      method: "POST",
      body: payload,
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
