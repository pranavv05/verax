import { request } from "../lib/api-client";

export const documentVersionsApi = {
  list(documentId) {
    return request(`/api/documents/${documentId}/versions`);
  },

  get(documentId, versionId) {
    return request(`/api/documents/${documentId}/versions/${versionId}`);
  }
};
