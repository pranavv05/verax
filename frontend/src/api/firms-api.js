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
  }
};
