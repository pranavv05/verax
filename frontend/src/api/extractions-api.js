import { request } from "../lib/api-client";

export const extractionsApi = {
  getByDocumentId(docId) {
    return request(`/api/extractions/${docId}`);
  },
  update(docId, payload) {
    return request(`/api/extractions/${docId}`, {
      method: "PUT",
      body: payload
    });
  },
  approve(docId) {
    return request(`/api/extractions/${docId}/approve`, {
      method: "POST"
    });
  },
  reprocess(docId) {
    return request(`/api/extractions/${docId}/reprocess`, {
      method: "POST"
    });
  }
};
