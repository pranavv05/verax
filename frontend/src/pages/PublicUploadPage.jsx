import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { z } from "zod";
import { authApi } from "../api/auth-api";
import { uploadApi } from "../api/upload-api";
import { linkErrorMessage, parseApiError } from "../lib/utils";
import PublicPageShell from "../components/public/PublicPageShell";
import FileTypeIcon, { fileExtension } from "../components/public/FileTypeIcon";
import { EASE } from "../components/public/motion";
import { HoverArrow } from "../components/marketing/Cta";

const allowedExtensions = ["pdf", "jpg", "jpeg", "png", "xlsx"];
const maxFileSizeMb = 50;

const uploadRequestSchema = z.object({
  file_name: z.string().min(1),
  file_type: z.string().min(1),
  file_size: z
    .number()
    .int()
    .positive()
    .max(maxFileSizeMb * 1024 * 1024),
  doc_type: z.enum(["invoice", "bank_statement", "bill", "other"])
});

const docTypes = [
  { value: "invoice", label: "Invoice" },
  { value: "bill", label: "Bill" },
  { value: "bank_statement", label: "Bank statement" },
  { value: "other", label: "Other" }
];

const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const STATUS_META = {
  pending: { label: "Ready", className: "bg-carbon-900/[0.05] text-carbon-600" },
  preparing: { label: "Preparing", className: "bg-brand-500/10 text-brand-700" },
  uploading: { label: "Uploading", className: "bg-brand-500/10 text-brand-700" },
  confirming: { label: "Confirming", className: "bg-brand-500/10 text-brand-700" },
  success: { label: "Uploaded", className: "bg-verify-500/10 text-verify-700" },
  error: { label: "Failed", className: "bg-red-500/10 text-red-700" }
};

const PublicUploadPage = () => {
  const { token } = useParams();
  const reduced = useReducedMotion();

  const [clientInfo, setClientInfo] = useState(null);
  const [firmName, setFirmName] = useState("");
  const [activeUploadToken, setActiveUploadToken] = useState(token);
  const [tokenLoading, setTokenLoading] = useState(true);
  const [tokenError, setTokenError] = useState("");

  const [docType, setDocType] = useState("other");
  const [items, setItems] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [globalError, setGlobalError] = useState("");
  const [dragging, setDragging] = useState(false);

  const dragDepth = useRef(0);
  const fileInputRef = useRef(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setTokenLoading(true);
      setTokenError("");
      try {
        const result = await authApi.validateMagicToken(token);
        if (active) {
          setClientInfo(result.client);
          setActiveUploadToken(token);
        }
      } catch (error) {
        if (active) {
          setTokenError(
            linkErrorMessage(error, "This link is invalid or has expired. Check you opened the full link from your CA firm.")
          );
        }
      } finally {
        if (active) {
          setTokenLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [token]);

  /**
   * The magic-token endpoint returns the client but not the firm. The public
   * status endpoint (same token, already public) does, so we read the firm name
   * from there purely to personalise the heading. Best-effort: any failure is
   * swallowed and the heading falls back to generic copy.
   */
  useEffect(() => {
    if (tokenError) return undefined;
    let active = true;
    uploadApi
      .getPublicUploadStatus(token)
      .then((result) => {
        if (active && result?.firmName) setFirmName(result.firmName);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [token, tokenError]);

  const addFiles = useCallback((files) => {
    setGlobalError("");
    const incoming = Array.from(files || []);
    if (incoming.length === 0) {
      return;
    }

    const validItems = [];
    for (const file of incoming) {
      const ext = fileExtension(file.name);
      if (!allowedExtensions.includes(ext)) {
        setGlobalError(`Unsupported file extension for ${file.name}`);
        continue;
      }
      if (file.size > maxFileSizeMb * 1024 * 1024) {
        setGlobalError(`File ${file.name} exceeds ${maxFileSizeMb}MB`);
        continue;
      }

      validItems.push({
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
        file,
        status: "pending",
        progress: 0,
        message: "Ready"
      });
    }

    setItems((prev) => [...prev, ...validItems]);
  }, []);

  const onDrop = (event) => {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    addFiles(event.dataTransfer.files);
  };

  const onFileInputChange = (event) => {
    addFiles(event.target.files);
    event.target.value = "";
  };

  const removeItem = (id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const updateItem = (id, patch) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const processUploadQueue = async () => {
    if (uploading || items.length === 0) {
      return;
    }

    setUploading(true);
    setGlobalError("");
    let queueToken = activeUploadToken || token;

    for (const item of items) {
      if (item.status === "success") {
        continue;
      }

      try {
        updateItem(item.id, { status: "preparing", message: "Requesting upload URL...", progress: 0 });

        const payload = {
          file_name: item.file.name,
          file_type: item.file.type || "application/octet-stream",
          file_size: item.file.size,
          doc_type: docType
        };

        const validation = uploadRequestSchema.safeParse(payload);
        if (!validation.success) {
          throw new Error(validation.error.issues[0]?.message || "Invalid upload payload");
        }

        const initResult = await uploadApi.createPublicUpload(queueToken, validation.data);

        updateItem(item.id, { status: "uploading", message: "Uploading to secure storage..." });

        await uploadApi.uploadFileToSignedUrl(initResult.upload_url, item.file, (progress) => {
          updateItem(item.id, { progress });
        });

        updateItem(item.id, { status: "confirming", message: "Confirming and queueing OCR...", progress: 100 });

        const confirmResult = await uploadApi.confirmPublicUpload(queueToken, initResult.document_id);
        if (confirmResult?.token_rotation?.uploadToken) {
          queueToken = confirmResult.token_rotation.uploadToken;
          setActiveUploadToken(queueToken);
        }

        updateItem(item.id, { status: "success", message: "Upload completed", progress: 100 });
      } catch (error) {
        updateItem(item.id, {
          status: "error",
          message: parseApiError(error, "Upload failed")
        });
      }
    }

    setUploading(false);
  };

  const successCount = useMemo(() => items.filter((item) => item.status === "success").length, [items]);

  const pendingCount = useMemo(() => items.filter((item) => item.status !== "success").length, [items]);

  const statusHref = `/upload/${activeUploadToken || token}/status`;

  /* ── loading / error states ─────────────────────────────────────────── */

  if (tokenLoading) {
    return (
      <PublicPageShell badge="Secure upload">
        <div className="space-y-4" role="status" aria-live="polite">
          <div className="h-9 w-3/5 animate-pulse rounded-lg bg-carbon-900/[0.06]" />
          <div className="h-4 w-4/5 animate-pulse rounded-lg bg-carbon-900/[0.04]" />
          <div className="h-[26rem] w-full animate-pulse rounded-[22px] bg-carbon-900/[0.04]" />
          <span className="sr-only">Validating your upload link…</span>
        </div>
      </PublicPageShell>
    );
  }

  if (tokenError) {
    return (
      <PublicPageShell badge="Secure upload">
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="mx-auto max-w-lg overflow-hidden rounded-[22px] border border-carbon-900/[0.07] bg-white text-center shadow-[0_1px_2px_rgba(14,16,19,0.04),0_30px_70px_-45px_rgba(38,30,110,0.35)]"
        >
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
            <h1 className="mt-5 font-inter text-[1.375rem] font-normal tracking-[-0.02em] text-carbon-900">
              This upload link isn&apos;t working
            </h1>
            <p className="mt-2 text-[0.9375rem] leading-[1.6] text-carbon-500">{tokenError}</p>
          </div>
          <p className="border-t border-carbon-900/[0.06] bg-[#FAFAFB] px-7 py-4 text-[0.875rem] text-carbon-500">
            Upload links expire for your security. Ask your CA firm to send you a fresh one.
          </p>
        </motion.div>
      </PublicPageShell>
    );
  }

  /* ── main ───────────────────────────────────────────────────────────── */

  return (
    <PublicPageShell badge="Secure upload">
      <motion.div
        initial={reduced ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE }}
      >
        <header>
          <h1 className="font-inter text-[clamp(1.75rem,4vw,2.375rem)] font-normal leading-[1.14] tracking-[-0.03em] text-carbon-900">
            Upload documents
            {firmName ? (
              <>
                {" "}
                <span className="text-carbon-400">for {firmName}</span>
              </>
            ) : null}
          </h1>
          <p className="mt-3 max-w-[34rem] text-[1rem] leading-[1.65] text-carbon-500">
            Drop in your invoices, bills or bank statements. They go straight to your accountant — no account needed.
          </p>

          {clientInfo?.name ? (
            <span className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/70 px-3.5 py-1.5 text-[13px] font-medium text-carbon-700 shadow-[0_8px_24px_-18px_rgba(38,30,110,0.5)] backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-verify-500" />
              Uploading as {clientInfo.name}
            </span>
          ) : null}
        </header>

        <div className="mt-8 overflow-hidden rounded-[22px] border border-carbon-900/[0.07] bg-white shadow-[0_1px_2px_rgba(14,16,19,0.04),0_30px_70px_-45px_rgba(38,30,110,0.35)]">
          {/* 1 · Document type */}
          <section className="px-5 pb-5 pt-6 sm:px-7">
            <p className="text-[13px] font-medium text-carbon-500">
              <span className="mr-2 tabular-nums text-carbon-400">01</span>What are you sending?
            </p>
            <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Document type">
              {docTypes.map((type) => {
                const active = docType === type.value;
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setDocType(type.value)}
                    aria-pressed={active}
                    className={`relative rounded-full px-4 py-2 text-[13.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                      active
                        ? "text-white"
                        : "border border-carbon-900/10 text-carbon-600 hover:border-carbon-900/20 hover:text-carbon-900"
                    }`}
                  >
                    {active ? (
                      <motion.span
                        layoutId="vx-doctype-pill"
                        aria-hidden="true"
                        className="absolute inset-0 rounded-full bg-carbon-900"
                        transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 36 }}
                      />
                    ) : null}
                    <span className="relative">{type.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 2 · Dropzone */}
          <section
            className="px-5 sm:px-7"
            onDragEnter={(event) => {
              event.preventDefault();
              dragDepth.current += 1;
              setDragging(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => {
              event.preventDefault();
              dragDepth.current = Math.max(0, dragDepth.current - 1);
              if (dragDepth.current === 0) setDragging(false);
            }}
            onDrop={onDrop}
          >
            <p className="text-[13px] font-medium text-carbon-500">
              <span className="mr-2 tabular-nums text-carbon-400">02</span>Add your files
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`relative mt-3 w-full overflow-hidden rounded-[16px] border-2 border-dashed px-5 py-9 text-center transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:py-11 ${
                dragging
                  ? "border-brand-500 bg-brand-500/[0.05]"
                  : "border-carbon-900/[0.12] bg-[#F5F5F7] hover:border-brand-500/50 hover:bg-brand-500/[0.03]"
              }`}
            >
              <motion.div
                animate={dragging ? { scale: 1.03 } : { scale: 1 }}
                transition={{ duration: 0.25, ease: EASE }}
              >
                <div className="flex items-end justify-center gap-2">
                  {["pdf", "jpg", "png", "xlsx"].map((ext, index) => (
                    <motion.span
                      key={ext}
                      animate={dragging ? { y: -6, rotate: (index - 1.5) * 5 } : { y: 0, rotate: (index - 1.5) * 3 }}
                      transition={{ duration: 0.3, ease: EASE, delay: index * 0.03 }}
                      className="drop-shadow-sm"
                    >
                      <FileTypeIcon extension={ext} size={30} />
                    </motion.span>
                  ))}
                </div>

                <p className="mt-5 text-[1rem] font-medium text-carbon-900 sm:text-[1.0625rem]">
                  {dragging ? "Drop your files here" : "Drag and drop your files"}
                </p>
                <p className="mt-1 text-[0.875rem] text-carbon-500">
                  or <span className="font-medium text-brand-600 underline underline-offset-2">click to browse</span>
                </p>
                <p className="mt-3 text-[12px] text-carbon-400">PDF, JPG, PNG or XLSX · up to {maxFileSizeMb}MB each</p>
              </motion.div>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.xlsx"
              onChange={onFileInputChange}
            />

            <AnimatePresence>
              {globalError ? (
                <motion.p
                  initial={reduced ? false : { opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, ease: EASE }}
                  role="alert"
                  className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[0.875rem] text-red-700"
                >
                  {globalError}
                </motion.p>
              ) : null}
            </AnimatePresence>
          </section>

          {/* 3 · Queue */}
          <section className="px-5 pb-6 pt-6 sm:px-7">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[13px] font-medium text-carbon-500">
                <span className="mr-2 tabular-nums text-carbon-400">03</span>Your files
              </h2>
              <p className="text-[13px] text-carbon-400">
                {items.length === 0 ? "Nothing selected yet" : `${successCount} of ${items.length} uploaded`}
              </p>
            </div>

            {items.length === 0 ? (
              <div className="mt-3 rounded-xl border border-dashed border-carbon-900/10 px-4 py-7 text-center">
                <p className="text-[0.875rem] text-carbon-400">
                  Files you choose will appear here before they&apos;re sent.
                </p>
              </div>
            ) : (
              <ul className="mt-3 space-y-2">
                <AnimatePresence initial={false}>
                  {items.map((item) => {
                    const meta = STATUS_META[item.status] || STATUS_META.pending;
                    const busy = ["preparing", "uploading", "confirming"].includes(item.status);

                    return (
                      <motion.li
                        key={item.id}
                        layout={!reduced}
                        initial={reduced ? false : { opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -12 }}
                        transition={{ duration: 0.28, ease: EASE }}
                        className="rounded-xl border border-carbon-900/[0.07] bg-[#FAFAFB] p-3.5"
                      >
                        <div className="flex items-start gap-3">
                          <FileTypeIcon extension={fileExtension(item.file.name)} size={26} />

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="min-w-0 flex-1 truncate text-[0.875rem] font-medium text-carbon-900">
                                {item.file.name}
                              </p>
                              <span
                                className={`inline-flex flex-none items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-medium ${meta.className}`}
                              >
                                {busy ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" /> : null}
                                {item.status === "success" ? (
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
                                {meta.label}
                              </span>
                            </div>

                            <p
                              className={`mt-0.5 truncate text-[12px] ${
                                item.status === "error" ? "text-red-600" : "text-carbon-400"
                              }`}
                            >
                              {formatBytes(item.file.size)} · {item.message}
                            </p>

                            <div className="mt-2 h-1 overflow-hidden rounded-full bg-carbon-900/[0.07]">
                              <motion.div
                                className={`h-full rounded-full ${
                                  item.status === "error"
                                    ? "bg-red-500"
                                    : item.status === "success"
                                      ? "bg-verify-500"
                                      : "bg-gradient-to-r from-brand-500 to-sky-500"
                                }`}
                                initial={false}
                                animate={{ width: `${item.progress}%` }}
                                transition={{ duration: 0.3, ease: EASE }}
                              />
                            </div>
                          </div>

                          {!uploading && item.status !== "success" ? (
                            <button
                              type="button"
                              onClick={() => removeItem(item.id)}
                              aria-label={`Remove ${item.file.name}`}
                              className="-mr-1 -mt-1 flex-none rounded-lg p-1.5 text-carbon-400 transition hover:bg-carbon-900/[0.05] hover:text-carbon-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                            >
                              <svg
                                width="15"
                                height="15"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                aria-hidden="true"
                              >
                                <path d="M6 18 18 6M6 6l12 12" />
                              </svg>
                            </button>
                          ) : null}
                        </div>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            )}

            <button
              type="button"
              className="group mt-5 inline-flex h-12 w-full items-center justify-center rounded-full bg-brand-500 text-[15px] font-medium text-white shadow-[0_1px_2px_rgba(38,30,110,0.3),inset_0_1px_0_rgba(255,255,255,0.18)] transition-[background-color,opacity] duration-200 hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-brand-500"
              disabled={uploading || pendingCount === 0}
              onClick={processUploadQueue}
            >
              {uploading ? (
                <>
                  <span
                    aria-hidden="true"
                    className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                  />
                  Uploading files…
                </>
              ) : (
                <>
                  {`Upload ${pendingCount > 0 ? pendingCount : ""} ${pendingCount === 1 ? "file" : "files"}`
                    .replace(/\s+/g, " ")
                    .trim()}
                  <HoverArrow />
                </>
              )}
            </button>
          </section>

          <AnimatePresence>
            {successCount > 0 ? (
              <motion.div
                initial={reduced ? false : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.35, ease: EASE }}
                className="overflow-hidden"
              >
                <div className="flex flex-col items-start gap-3 border-t border-verify-500/20 bg-verify-500/[0.06] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
                  <p className="flex items-start gap-2 text-[0.875rem] font-medium text-verify-700">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      className="mt-[2px] flex-none"
                      aria-hidden="true"
                    >
                      <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {successCount} {successCount === 1 ? "file is" : "files are"} with your accountant. You can close
                    this page.
                  </p>
                  <Link
                    to={statusHref}
                    className="group inline-flex h-9 flex-none items-center rounded-full border border-carbon-900/10 bg-white px-4 text-[13.5px] font-medium text-carbon-900 transition-colors hover:border-carbon-900/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  >
                    View upload status
                    <HoverArrow />
                  </Link>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </motion.div>
    </PublicPageShell>
  );
};

export default PublicUploadPage;
