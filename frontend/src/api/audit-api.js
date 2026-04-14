import { request } from "../lib/api-client";

export const auditApi = {
  list(params = {}) {
    const q = new URLSearchParams();
    if (params.page) q.set("page", params.page);
    if (params.limit) q.set("limit", params.limit);
    if (params.action) q.set("action", params.action);
    if (params.entityType) q.set("entityType", params.entityType);
    return request(`/api/audit-logs?${q.toString()}`);
  }
};
