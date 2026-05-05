import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { uploadApi } from "../api/upload-api";
import { parseApiError } from "../lib/utils";

const DOC_TYPE_LABELS = {
  invoice: "Invoice",
  bill: "Bill",
  bank_statement: "Bank Statement",
  other: "Other"
};

const STATUS_STYLES = {
  Received: "bg-slate-100 text-slate-600",
  Processing: "bg-amber-100 text-amber-700",
  "Under Review": "bg-indigo-100 text-indigo-700",
  Complete: "bg-mint-500/10 text-mint-700"
};

const relativeTime = (value) => {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
};

const PublicUploadStatusPage = () => {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  const hasActiveDocuments = useMemo(
    () =>
      (data?.documents || []).some((document) =>
        ["Received", "Processing"].includes(document.status)
      ),
    [data]
  );

  const loadStatus = async ({ showLoading = false } = {}) => {
    if (showLoading) setLoading(true);
    setError("");
    try {
      const result = await uploadApi.getPublicUploadStatus(token);
      setData(result);
      setLastUpdatedAt(new Date());
    } catch (statusError) {
      setData(null);
      if (statusError.statusCode === 404) {
        setError("This upload link was not found. Please contact your CA firm.");
      } else {
        setError(parseApiError(statusError, "Unable to load upload status"));
      }
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus({ showLoading: true });
  }, [token]);

  useEffect(() => {
    if (!hasActiveDocuments) return undefined;

    const intervalId = window.setInterval(() => {
      loadStatus();
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, [hasActiveDocuments, token]);

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 py-10 sm:px-6">
      <header className="mb-6">
        <div className="inline-flex rounded-full border border-[#d5c7a9] bg-sand-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#5b6b80]">
          {data?.firmName || "Verax"}
        </div>
        <h1 className="mt-3 text-3xl font-extrabold text-ink-900">Your Uploaded Documents</h1>
        <p className="mt-1 text-sm text-[#66778f]">
          Here's a summary of the files you've sent to {data?.firmName || "your CA firm"}.
        </p>
      </header>

      {loading ? (
        <div className="panel px-4 py-3 text-sm font-semibold text-ink-700">
          Loading upload status...
        </div>
      ) : null}

      {!loading && error ? (
        <div className="panel border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      ) : null}

      {!loading && !error && data ? (
        <section className="panel p-4">
          <div className="mb-4">
            <p className="text-xs uppercase tracking-wide text-[#6a7b90]">Client</p>
            <p className="text-lg font-bold text-ink-900">{data.clientName}</p>
          </div>

          {data.documents.length === 0 ? (
            <p className="rounded-xl border border-[#e4d8c5] bg-sand-50 p-4 text-sm text-[#6b7d93]">
              No documents uploaded yet.
            </p>
          ) : (
            <div className="space-y-3">
              {data.documents.map((document) => (
                <article
                  key={document.id}
                  className="rounded-xl border border-[#e4d8c5] bg-sand-50 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-bold text-ink-900">{document.fileName}</h2>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#607086]">
                          {DOC_TYPE_LABELS[document.documentType] || "Other"}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                            STATUS_STYLES[document.status] || STATUS_STYLES.Received
                          }`}
                        >
                          {document.status === "Processing" && (
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                          )}
                          {document.status}
                        </span>
                      </div>
                    </div>
                    <p
                      className="text-xs font-medium text-[#6f8097]"
                      title={new Date(document.uploadedAt).toLocaleString()}
                    >
                      Uploaded {relativeTime(document.uploadedAt)}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}

          {lastUpdatedAt ? (
            <p className="mt-4 text-center text-xs text-[#79889a]">
              Last updated {relativeTime(lastUpdatedAt)}
            </p>
          ) : null}
        </section>
      ) : null}

      <footer className="py-6 text-center text-xs font-medium text-[#8a98a9]">
        Powered by Verax TallyOCR
      </footer>
    </div>
  );
};

export default PublicUploadStatusPage;
