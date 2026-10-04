export const formatDateTime = (value) => {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
};

export const formatDate = (value) => {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
};

export const parseApiError = (error, fallback = "Something went wrong") => {
  if (!error) {
    return fallback;
  }
  if (typeof error === "string") {
    return error;
  }
  return error.message || fallback;
};

/**
 * What to tell someone whose link (upload, status, password reset) failed to
 * open. These pages are seen by clients, so the server's own message is never
 * shown: for a malformed token it is a raw validation error ("token" fails to
 * match the required pattern: /^[a-zA-Z0-9]{32,128}$/).
 */
export const linkErrorMessage = (error, invalidMessage) => {
  const status = error?.statusCode;
  if (status === 429) {
    return "Too many attempts. Wait a minute, then try the link again.";
  }
  if (status >= 400 && status < 500) {
    return invalidMessage;
  }
  return "We couldn't check this link right now. Check your connection and try again.";
};

export const cn = (...parts) => parts.filter(Boolean).join(" ");

export const triggerFileDownload = async (url, filename) => {
  if (!url) {
    return;
  }
  // Export URLs are cross-origin (S3 presigned URLs, or the backend's
  // localhost origin in LOCAL_STORAGE mode) — the `download` attribute on
  // an <a> tag is silently ignored by browsers for cross-origin links, so
  // setting a.href directly to the remote URL just navigates the tab to it
  // instead of downloading. Fetching the bytes and downloading from a same-
  // origin blob: URL forces a real download regardless of origin.
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Download failed with status ${res.status}`);
  }
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename || "download";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(blobUrl);
};
