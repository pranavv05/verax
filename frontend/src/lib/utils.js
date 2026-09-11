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

export const cn = (...parts) => parts.filter(Boolean).join(" ");

export const triggerFileDownload = (url, filename) => {
  if (!url) {
    return;
  }
  // Export URLs are cross-origin (S3 presigned URLs, or the backend's
  // localhost origin in LOCAL_STORAGE mode) — the `download` attribute on
  // an <a> tag is silently ignored by browsers for cross-origin links, so
  // setting a.href directly to the remote URL just navigates the tab to it
  // instead of downloading. Fetching the bytes and downloading from a same-
  // origin blob: URL forces a real download regardless of origin.
  fetch(url)
    .then((res) => res.blob())
    .then((blob) => {
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename || "download";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    });
};
