import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { uploadApi } from "../api/upload-api";
import { parseApiError } from "../lib/utils";
import PublicPageShell from "../components/public/PublicPageShell";
import FileTypeIcon, { fileExtension } from "../components/public/FileTypeIcon";
import { EASE } from "../components/public/motion";

const DOC_TYPE_LABELS = {
  invoice: "Invoice",
  bill: "Bill",
  bank_statement: "Bank Statement",
  other: "Other"
};

/* Mirrors `mapClientStatus` in backend/src/routes/public-upload.routes.js */
const STATUS_ORDER = ["Received", "Processing", "Under Review", "Complete"];

const STATUS_STYLES = {
  Received: "bg-well text-zinc-300",
  Processing: "bg-amber-500/15 text-amber-300",
  "Under Review": "bg-indigo-500/15 text-indigo-300",
  Complete: "bg-verify-500/15 text-verify-300"
};

const STATUS_BAR = {
  Received: "bg-zinc-500",
  Processing: "bg-amber-500",
  "Under Review": "bg-indigo-500",
  Complete: "bg-verify-500"
};

const STATUS_BLURB = {
  Received: "We have your file. It's queued for processing.",
  Processing: "Reading the document and pulling out the figures.",
  "Under Review": "Your accountant is checking this one.",
  Complete: "Done and posted to your accounts."
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

const StatusTrack = ({ status }) => {
  const activeIndex = Math.max(0, STATUS_ORDER.indexOf(status));

  return (
    <div className="mt-3 flex items-center gap-1.5" aria-hidden="true">
      {STATUS_ORDER.map((step, index) => (
        <div key={step} className="h-1 flex-1 overflow-hidden rounded-full bg-hairline-strong">
          <motion.div
            className={`h-full rounded-full ${STATUS_BAR[status] || STATUS_BAR.Received}`}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: index <= activeIndex ? 1 : 0 }}
            transition={{ duration: 0.45, ease: EASE, delay: index * 0.06 }}
            style={{ originX: 0 }}
          />
        </div>
      ))}
    </div>
  );
};

const PublicUploadStatusPage = () => {
  const { token } = useParams();
  const reduced = useReducedMotion();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const hasActiveDocuments = useMemo(
    () =>
      (data?.documents || []).some((document) =>
        ["Received", "Processing"].includes(document.status)
      ),
    [data]
  );

  const allComplete = useMemo(() => {
    const documents = data?.documents || [];
    return documents.length > 0 && documents.every((document) => document.status === "Complete");
  }, [data]);

  const counts = useMemo(() => {
    const documents = data?.documents || [];
    return STATUS_ORDER.map((status) => ({
      status,
      count: documents.filter((document) => document.status === status).length
    }));
  }, [data]);

  const loadStatus = async ({ showLoading = false } = {}) => {
    if (showLoading) setLoading(true);
    else setRefreshing(true);
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
      setRefreshing(false);
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
    <PublicPageShell badge={data?.firmName || "Document status"}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
      >
        <header>
          <h1 className="text-2xl font-bold leading-tight tracking-[-0.03em] text-zinc-100 sm:text-3xl">
            Your document status
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500 sm:text-base">
            {data?.firmName
              ? `Everything you've sent to ${data.firmName}, and where each file has got to.`
              : "Everything you've sent to your CA firm, and where each file has got to."}
          </p>
          {data?.clientName ? (
            <span className="mt-4 inline-flex items-center gap-2 rounded-full border border-hairline bg-well px-3 py-1.5 text-xs font-semibold text-zinc-300">
              {data.clientName}
            </span>
          ) : null}
        </header>

        {/* ── loading skeleton ─────────────────────────────────────────── */}
        {loading ? (
          <div className="mt-7 space-y-3">
            {[0, 1, 2].map((index) => (
              <div key={index} className="rounded-2xl border border-hairline bg-surface p-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-7 animate-pulse rounded-md bg-hairline-strong" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-2/5 animate-pulse rounded bg-hairline-strong" />
                    <div className="h-3 w-1/4 animate-pulse rounded bg-hairline-strong" />
                  </div>
                </div>
                <div className="mt-3 h-1 w-full animate-pulse rounded-full bg-hairline-strong" />
              </div>
            ))}
            <span className="sr-only">Loading your document status…</span>
          </div>
        ) : null}

        {/* ── error ────────────────────────────────────────────────────── */}
        {!loading && error ? (
          <div className="mt-7 rounded-2xl border border-red-500/20 bg-surface p-7 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/15 text-red-400">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7.5v5.5M12 16.2v.3" />
              </svg>
            </span>
            <p className="mt-4 text-sm font-medium text-zinc-200">{error}</p>
            <button
              type="button"
              onClick={() => loadStatus({ showLoading: true })}
              className="vx-btn-secondary mt-5 px-5 py-2.5 text-sm"
            >
              Try again
            </button>
          </div>
        ) : null}

        {/* ── data ─────────────────────────────────────────────────────── */}
        {!loading && !error && data ? (
          <>
            {/* Celebration when every document is finished */}
            <AnimatePresence>
              {allComplete ? (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5, ease: EASE }}
                  className="mt-7 overflow-hidden rounded-2xl border border-verify-500/20 bg-verify-500/[0.06] p-6 text-center"
                >
                  <motion.span
                    initial={reduced ? false : { opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, ease: EASE, delay: 0.12 }}
                    className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-verify-500 text-[#04231F] shadow-[0_12px_30px_-10px_rgba(20,184,166,0.8)]"
                  >
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m5 12.5 4.5 4.5L19 7.5" />
                    </svg>
                  </motion.span>
                  <h2 className="mt-4 text-xl font-bold tracking-[-0.02em] text-zinc-100">
                    All done
                  </h2>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-zinc-500">
                    Every document you sent has been processed and posted. Nothing left for
                    you to do.
                  </p>
                </motion.div>
              ) : null}
            </AnimatePresence>

            {/* Summary strip */}
            {data.documents.length > 0 ? (
              <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {counts.map(({ status, count }) => (
                  <div
                    key={status}
                    className="rounded-xl border border-hairline bg-surface px-3.5 py-3"
                  >
                    <p className="text-xl font-bold tracking-[-0.03em] text-zinc-100">
                      {count}
                    </p>
                    <p className="mt-0.5 text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-zinc-600">
                      {status}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}

            {/* Documents */}
            {data.documents.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-hairline bg-surface px-6 py-12 text-center">
                <p className="text-base font-semibold text-zinc-200">No documents yet</p>
                <p className="mx-auto mt-2 max-w-sm text-sm text-zinc-500">
                  Once you upload something through your link, it will show up here with its
                  progress.
                </p>
                <Link to={`/upload/${token}`} className="vx-btn-primary mt-5 px-5 py-2.5 text-sm">
                  Upload documents
                </Link>
              </div>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {data.documents.map((document, index) => (
                  <motion.li
                    key={document.id}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: EASE, delay: Math.min(index * 0.06, 0.4) }}
                    className="rounded-2xl border border-hairline bg-surface p-4"
                  >
                    <div className="flex items-start gap-3">
                      <FileTypeIcon extension={fileExtension(document.fileName)} size={26} />

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
                          <h2 className="min-w-0 flex-1 truncate text-sm font-bold text-zinc-100">
                            {document.fileName}
                          </h2>
                          <span
                            className={`inline-flex flex-none items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.7rem] font-semibold ${
                              STATUS_STYLES[document.status] || STATUS_STYLES.Received
                            }`}
                          >
                            {document.status === "Processing" ? (
                              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                            ) : null}
                            {document.status === "Complete" ? (
                              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                                <path d="M2.5 6.2 4.8 8.5 9.5 3.8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            ) : null}
                            {document.status}
                          </span>
                        </div>

                        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-600">
                          <span className="font-medium text-zinc-400">
                            {DOC_TYPE_LABELS[document.documentType] || "Other"}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span title={new Date(document.uploadedAt).toLocaleString()}>
                            Uploaded {relativeTime(document.uploadedAt)}
                          </span>
                        </p>

                        <StatusTrack status={document.status} />

                        <p className="mt-2 text-xs text-zinc-500">
                          {STATUS_BLURB[document.status] || STATUS_BLURB.Received}
                        </p>
                      </div>
                    </div>
                  </motion.li>
                ))}
              </ul>
            )}

            {/* Auto-refresh indicator */}
            {lastUpdatedAt ? (
              <div className="mt-6 flex items-center justify-center gap-2 text-xs text-zinc-600">
                {hasActiveDocuments ? (
                  <>
                    <motion.span
                      className="h-3 w-3 rounded-full border-2 border-indigo-500 border-t-transparent"
                      animate={reduced ? undefined : { rotate: 360 }}
                      transition={{ duration: 1, ease: "linear", repeat: Infinity }}
                    />
                    <span>
                      {refreshing ? "Checking for updates…" : "Updating automatically every 15 seconds"}
                      <span className="mx-1.5 text-zinc-700">·</span>
                      last checked {relativeTime(lastUpdatedAt)}
                    </span>
                  </>
                ) : (
                  <span>Last updated {relativeTime(lastUpdatedAt)}</span>
                )}
              </div>
            ) : null}

            <div className="mt-4 text-center">
              <Link
                to={`/upload/${token}`}
                className="text-sm font-semibold text-indigo-400 underline-offset-4 transition hover:text-indigo-300 hover:underline"
              >
                Upload more documents
              </Link>
            </div>
          </>
        ) : null}
      </motion.div>
    </PublicPageShell>
  );
};

export default PublicUploadStatusPage;
