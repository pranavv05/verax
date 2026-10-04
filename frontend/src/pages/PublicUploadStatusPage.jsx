import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { uploadApi } from "../api/upload-api";
import { linkErrorMessage } from "../lib/utils";
import PublicPageShell from "../components/public/PublicPageShell";
import FileTypeIcon, { fileExtension } from "../components/public/FileTypeIcon";
import { EASE } from "../components/public/motion";
import { HoverArrow } from "../components/marketing/Cta";

const DOC_TYPE_LABELS = {
  invoice: "Invoice",
  bill: "Bill",
  bank_statement: "Bank Statement",
  other: "Other"
};

/* Mirrors `mapClientStatus` in backend/src/routes/public-upload.routes.js */
const STATUS_ORDER = ["Received", "Processing", "Under Review", "Complete"];

const STATUS_STYLES = {
  Received: "bg-carbon-900/[0.05] text-carbon-600",
  Processing: "bg-amber-500/12 text-amber-700",
  "Under Review": "bg-brand-500/10 text-brand-700",
  Complete: "bg-verify-500/10 text-verify-700"
};

const STATUS_BAR = {
  Received: "bg-carbon-400",
  Processing: "bg-amber-500",
  "Under Review": "bg-brand-500",
  Complete: "bg-verify-500"
};

const STATUS_BLURB = {
  Received: "We have your file. It's queued for processing.",
  Processing: "Reading the document and pulling out the figures.",
  "Under Review": "Your accountant is checking this one.",
  Complete: "Done — your accountant has exported it for Tally."
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
        <div key={step} className="h-1 flex-1 overflow-hidden rounded-full bg-carbon-900/[0.07]">
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
    () => (data?.documents || []).some((document) => ["Received", "Processing"].includes(document.status)),
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
      setError(linkErrorMessage(statusError, "This upload link was not found. Please contact your CA firm."));
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
        initial={reduced ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE }}
      >
        <header>
          <h1 className="font-inter text-[clamp(1.75rem,4vw,2.375rem)] font-normal leading-[1.14] tracking-[-0.03em] text-carbon-900">
            Your document status
          </h1>
          <p className="mt-3 max-w-[34rem] text-[1rem] leading-[1.65] text-carbon-500">
            {data?.firmName
              ? `Everything you've sent to ${data.firmName}, and where each file has got to.`
              : "Everything you've sent to your CA firm, and where each file has got to."}
          </p>
          {data?.clientName ? (
            <span className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/70 px-3.5 py-1.5 text-[13px] font-medium text-carbon-700 shadow-[0_8px_24px_-18px_rgba(38,30,110,0.5)] backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-verify-500" />
              {data.clientName}
            </span>
          ) : null}
        </header>

        {/* ── loading skeleton ─────────────────────────────────────────── */}
        {loading ? (
          <div className="mt-8 space-y-2.5" role="status" aria-live="polite">
            {[0, 1, 2].map((index) => (
              <div key={index} className="rounded-2xl border border-carbon-900/[0.07] bg-white p-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-7 animate-pulse rounded-md bg-carbon-900/[0.06]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-2/5 animate-pulse rounded bg-carbon-900/[0.06]" />
                    <div className="h-3 w-1/4 animate-pulse rounded bg-carbon-900/[0.04]" />
                  </div>
                </div>
                <div className="mt-3 h-1 w-full animate-pulse rounded-full bg-carbon-900/[0.05]" />
              </div>
            ))}
            <span className="sr-only">Loading your document status…</span>
          </div>
        ) : null}

        {/* ── error ────────────────────────────────────────────────────── */}
        {!loading && error ? (
          <div className="mt-8 overflow-hidden rounded-[22px] border border-carbon-900/[0.07] bg-white text-center shadow-[0_1px_2px_rgba(14,16,19,0.04),0_30px_70px_-45px_rgba(38,30,110,0.35)]">
            <div className="px-7 py-9">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7.5v5.5M12 16.2v.3" />
                </svg>
              </span>
              <p className="mt-4 text-[0.9375rem] text-carbon-700">{error}</p>
              <button
                type="button"
                onClick={() => loadStatus({ showLoading: true })}
                className="mt-6 inline-flex h-10 items-center rounded-full border border-carbon-900/10 bg-white px-5 text-[14px] font-medium text-carbon-900 transition-colors hover:border-carbon-900/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                Try again
              </button>
            </div>
          </div>
        ) : null}

        {/* ── data ─────────────────────────────────────────────────────── */}
        {!loading && !error && data ? (
          <>
            {/* When every document is finished */}
            <AnimatePresence>
              {allComplete ? (
                <motion.div
                  initial={reduced ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5, ease: EASE }}
                  className="mt-8 overflow-hidden rounded-[22px] border border-verify-500/20 bg-white p-7 text-center shadow-[0_30px_70px_-45px_rgba(20,184,166,0.45)]"
                >
                  <motion.span
                    initial={reduced ? false : { opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, ease: EASE, delay: 0.12 }}
                    className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-verify-500 to-sky-500 text-white shadow-[0_12px_30px_-10px_rgba(20,184,166,0.8)]"
                  >
                    <svg
                      width="26"
                      height="26"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="m5 12.5 4.5 4.5L19 7.5" />
                    </svg>
                  </motion.span>
                  <h2 className="mt-4 font-inter text-[1.375rem] font-normal tracking-[-0.02em] text-carbon-900">
                    All done
                  </h2>
                  <p className="mx-auto mt-2 max-w-sm text-[0.9375rem] leading-[1.6] text-carbon-500">
                    Every document you sent has been processed and exported for Tally by your accountant. Nothing left
                    for you to do.
                  </p>
                </motion.div>
              ) : null}
            </AnimatePresence>

            {/* Summary strip */}
            {data.documents.length > 0 ? (
              <div className="mt-8 grid grid-cols-2 overflow-hidden rounded-2xl border border-carbon-900/[0.07] bg-white sm:grid-cols-4">
                {counts.map(({ status, count }, index) => (
                  <div
                    key={status}
                    className={`px-4 py-3.5 ${index % 2 === 1 ? "border-l" : ""} ${index >= 2 ? "border-t sm:border-t-0" : ""} ${
                      index === 2 ? "sm:border-l" : ""
                    } border-carbon-900/[0.06]`}
                  >
                    <p className="font-inter text-[1.5rem] font-semibold tabular-nums tracking-[-0.03em] text-carbon-900">
                      {count}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[12px] font-medium text-carbon-500">
                      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_BAR[status]}`} />
                      {status}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}

            {/* Documents */}
            {data.documents.length === 0 ? (
              <div className="mt-8 rounded-[22px] border border-dashed border-carbon-900/[0.12] bg-white/60 px-6 py-12 text-center">
                <p className="text-[1rem] font-medium text-carbon-900">No documents yet</p>
                <p className="mx-auto mt-2 max-w-sm text-[0.875rem] text-carbon-500">
                  Once you upload something through your link, it will show up here with its progress.
                </p>
                <Link
                  to={`/upload/${token}`}
                  className="group mt-6 inline-flex h-10 items-center rounded-full bg-brand-500 px-5 text-[14px] font-medium text-white shadow-[0_1px_2px_rgba(38,30,110,0.3),inset_0_1px_0_rgba(255,255,255,0.18)] transition-colors hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                >
                  Upload documents
                  <HoverArrow />
                </Link>
              </div>
            ) : (
              <ul className="mt-3 space-y-2">
                {data.documents.map((document, index) => (
                  <motion.li
                    key={document.id}
                    initial={reduced ? false : { opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: EASE, delay: Math.min(index * 0.06, 0.4) }}
                    className="rounded-2xl border border-carbon-900/[0.07] bg-white p-4 shadow-[0_1px_2px_rgba(14,16,19,0.03)]"
                  >
                    <div className="flex items-start gap-3">
                      <FileTypeIcon extension={fileExtension(document.fileName)} size={26} />

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
                          <h2 className="min-w-0 flex-1 truncate text-[0.875rem] font-medium text-carbon-900">
                            {document.fileName}
                          </h2>
                          <span
                            className={`inline-flex flex-none items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-medium ${
                              STATUS_STYLES[document.status] || STATUS_STYLES.Received
                            }`}
                          >
                            {document.status === "Processing" ? (
                              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                            ) : null}
                            {document.status === "Complete" ? (
                              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                                <path
                                  d="M2.5 6.2 4.8 8.5 9.5 3.8"
                                  stroke="currentColor"
                                  strokeWidth="2.2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            ) : null}
                            {document.status}
                          </span>
                        </div>

                        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-carbon-400">
                          <span className="font-medium text-carbon-600">
                            {DOC_TYPE_LABELS[document.documentType] || "Other"}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span title={new Date(document.uploadedAt).toLocaleString()}>
                            Uploaded {relativeTime(document.uploadedAt)}
                          </span>
                        </p>

                        <StatusTrack status={document.status} />

                        <p className="mt-2 text-[12px] text-carbon-500">
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
              <div className="mt-6 flex items-center justify-center gap-2 text-[12px] text-carbon-400">
                {hasActiveDocuments ? (
                  <>
                    <motion.span
                      aria-hidden="true"
                      className="h-3 w-3 rounded-full border-2 border-brand-500 border-t-transparent"
                      animate={reduced ? undefined : { rotate: 360 }}
                      transition={{ duration: 1, ease: "linear", repeat: Infinity }}
                    />
                    <span>
                      {refreshing ? "Checking for updates…" : "Updating automatically every 15 seconds"}
                      <span className="mx-1.5 text-carbon-300">·</span>
                      last checked {relativeTime(lastUpdatedAt)}
                    </span>
                  </>
                ) : (
                  <span>Last updated {relativeTime(lastUpdatedAt)}</span>
                )}
              </div>
            ) : null}

            <div className="mt-5 text-center">
              <Link
                to={`/upload/${token}`}
                className="group inline-flex items-center rounded text-[0.875rem] font-medium text-brand-600 transition-colors hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                Upload more documents
                <HoverArrow />
              </Link>
            </div>
          </>
        ) : null}
      </motion.div>
    </PublicPageShell>
  );
};

export default PublicUploadStatusPage;
