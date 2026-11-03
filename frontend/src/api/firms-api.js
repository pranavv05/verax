import { request } from "../lib/api-client";

export const firmsApi = {
  async getSettings() {
    const res = await request("/api/firms/settings");
    return res.firm;
  },
  async updateSettings(payload) {
    const res = await request("/api/firms/settings", { method: "PUT", body: payload });
    return res.firm;
  },
  async getMe() {
    const res = await request("/api/firms/me");
    return res.user;
  },
  // Returns { path } — a short-lived signed download link for the full export.
  requestExportLink() {
    return request("/api/firms/export-link", { method: "POST" });
  },
  deleteFirm({ confirmFirmName, password }) {
    return request("/api/firms/delete", { method: "POST", body: { confirmFirmName, password } });
  }
};
