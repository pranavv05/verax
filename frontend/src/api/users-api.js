import { request } from "../lib/api-client";

export const usersApi = {
  list() { return request("/api/users"); },
  invite(payload) { return request("/api/users", { method: "POST", body: payload }); },
  remove(id) { return request(`/api/users/${id}`, { method: "DELETE" }); }
};
