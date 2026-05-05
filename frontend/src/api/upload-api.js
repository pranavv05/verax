import { request } from "../lib/api-client";

const uploadWithProgress = (uploadUrl, file, onProgress) =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl, true);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && typeof onProgress === "function") {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      reject(new Error(`S3 upload failed with status ${xhr.status}`));
    };

    xhr.onerror = () =>
      reject(
        new Error(
          "Network error during upload. This usually means the S3 bucket is missing CORS configuration. " +
          "Add a CORS rule on your S3 bucket allowing PUT from your frontend origin."
        )
      );
    xhr.send(file);
  });

export const uploadApi = {
  createPublicUpload(token, payload) {
    return request(`/api/upload/${token}/documents/upload`, {
      method: "POST",
      body: payload,
      auth: false
    });
  },
  confirmPublicUpload(token, documentId) {
    return request(`/api/upload/${token}/documents/confirm`, {
      method: "POST",
      body: { document_id: documentId },
      auth: false
    });
  },
  getPublicUploadStatus(token) {
    return request(`/api/upload/${token}/status`, {
      auth: false
    });
  },
  uploadFileToSignedUrl(uploadUrl, file, onProgress) {
    return uploadWithProgress(uploadUrl, file, onProgress);
  }
};
