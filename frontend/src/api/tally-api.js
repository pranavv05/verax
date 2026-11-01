import { request } from "../lib/api-client";

/**
 * Live Tally connector — firm-facing API (agent management + document push).
 * The agent-facing endpoints (claim/report/heartbeat) are used by the installed
 * Windows agent, not the web app, so they are not exposed here.
 */
export const tallyApi = {
  listAgents() {
    return request("/api/tally/agents");
  },

  registerAgent({ name, tallyCompany }) {
    return request("/api/tally/agents", {
      method: "POST",
      body: { name, tallyCompany }
    });
  },

  revokeAgent(agentId) {
    return request(`/api/tally/agents/${agentId}`, { method: "DELETE" });
  },

  pushDocument(documentId) {
    return request("/api/tally/sync", {
      method: "POST",
      body: { documentId }
    });
  },

  getSyncStatus(documentId) {
    return request(`/api/tally/sync/${documentId}`);
  }
};
