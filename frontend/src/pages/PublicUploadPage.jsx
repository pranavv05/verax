import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { z } from "zod";
import { authApi } from "../api/auth-api";
import { uploadApi } from "../api/upload-api";
import { parseApiError } from "../lib/utils";
import PublicPageShell from "../components/public/PublicPageShell";
import FileTypeIcon, { fileExtension } from "../components/public/FileTypeIcon";
import { EASE } from "../components/public/motion";

const allowedExtensions = ["pdf", "jpg", "jpeg", "png", "xlsx"];
const maxFileSizeMb = 50;

const uploadRequestSchema = z.object({
  file_name: z.string().min(1),
  file_type: z.string().min(1),
  file_size: z.number().int().positive().max(maxFileSizeMb * 1024 * 1024),
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
  pending: { label: "Ready", className: "bg-white/10 text-zinc-300" },
  preparing: { label: "Preparing", className: "bg-indigo-500/15 text-indigo-300" },
  uploading: { label: "Uploading", className: "bg-indigo-500/15 text-indigo-300" },
  confirming: { label: "Confirming", className: "bg-indigo-500/15 text-indigo-300" },
  success: { label: "Uploaded", className: "bg-verify-500/15 text-verify-300" },
  error: { label: "Failed", className: "bg-red-500/15 text-red-300" }
};

const PublicUploadPage = () => {
  const { token } = useParams();

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
          setTokenError(parseApiError(error, "Magic link is invalid or expired"));
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
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
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

  const successCount = useMemo(
    () => items.filter((item) => item.status === "success").length,
    [items]
  );

  const pendingCount = useMemo(
    () => items.filter((item) => item.status !== "success").length,
    [items]
  );

  const statusHref = `/upload/${activeUploadToken || token}/status`;

  /* ── loading / error states ─────────────────────────────────────────── */

  if (tokenLoading) {
    return (
      <PublicPageShell badge="Secure upload">
        <div className="space-y-4">
          <div className="h-8 w-3/5 animate-pulse rounded-lg bg-white/10" />
          <div className="h-4 w-4/5 animate-pulse rounded-lg bg-white/5" />
          <div className="h-40 w-full animate-pulse rounded-2xl bg-white/5" />
          <div className="h-56 w-full animate-pulse rounded-2xl bg-white/5" />
          <span className="sr-only">Validating your upload link…</span>
        </div>
      </PublicPageShell>
    );
  }

  if (tokenError) {
    return (
      <PublicPageShell badge="Secure upload">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EASE }}
          className="mx-auto max-w-lg rounded-2xl border border-red-500/20 bg-surface p-8 text-center"
        >
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/15 text-red-400">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7.5v5.5M12 16.2v.3" />
            </svg>
          </span>
          <h1 className="mt-5 text-xl font-bold tracking-[-0.02em] text-zinc-100">
            This upload link isn't working
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">{tokenError}</p>
          <p className="mt-5 rounded-xl bg-white/[0.04] px-4 py-3 text-sm text-zinc-400">
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
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
      >
        <header>
          <h1 className="text-2xl font-bold leading-tight tracking-[-0.03em] text-zinc-100 sm:text-3xl">
            Upload documents{firmName ? ` for ${firmName}` : ""}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400 sm:text-base">
            Drop in your invoices, bills or bank statements. They go straight to your
            accountant — no account needed.
          </p>

          {clientInfo?.name ? (
            <span className="mt-4 inline-flex items-center gap-2 rounded-full border border-hairline bg-surface px-3 py-1.5 text-xs font-semibold text-zinc-300">
              <span className="h-1.5 w-1.5 rounded-full bg-verify-500" />
              Uploading as {clientInfo.name}
            </span>
          ) : null}
        </header>

        {/* Document type */}
        <section className="mt-7 rounded-2xl border border-hairline bg-surface p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
            What are you sending?
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {docTypes.map((type) => {
              const active = docType === type.value;
              return (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setDocType(type.value)}
                  aria-pressed={active}
                  className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                    active
                      ? "border-indigo-500 bg-indigo-500/15 text-indigo-300"
                      : "border-hairline bg-transparent text-zinc-400 hover:border-white/20 hover:bg-white/5"
                  }`}
                >
                  {type.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Dropzone */}
        <motion.section
          className="mt-4"
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
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`relative w-full overflow-hidden rounded-2xl border-2 border-dashed px-5 py-9 text-center transition-colors duration-200 sm:py-12 ${
              dragging
                ? "border-indigo-500 bg-indigo-500/[0.07]"
                : "border-white/[0.12] bg-surface hover:border-indigo-500/50 hover:bg-white/[0.03]"
            }`}
          >
            <motion.div
              animate={dragging ? { scale: 1.04 } : { scale: 1 }}
              transition={{ duration: 0.25, ease: EASE }}
            >
              <div className="flex items-end justify-center gap-2">
                {["pdf", "jpg", "png", "xlsx"].map((ext, index) => (
                  <motion.span
                    key={ext}
                    animate={
                      dragging
                        ? { y: -6, rotate: (index - 1.5) * 5 }
                        : { y: 0, rotate: (index - 1.5) * 3 }
                    }
                    transition={{ duration: 0.3, ease: EASE, delay: index * 0.03 }}
                    className="drop-shadow-sm"
                  >
                    <FileTypeIcon extension={ext} size={30} />
                  </motion.span>
                ))}
              </div>

              <p className="mt-5 text-base font-semibold text-zinc-100 sm:text-lg">
                {dragging ? "Drop your files here" : "Drag and drop your files"}
              </p>
              <p className="mt-1 text-sm text-zinc-400">
                or <span className="font-semibold text-indigo-400 underline underline-offset-2">click to browse</span>
              </p>
              <p className="mt-3 text-xs text-zinc-600">
                PDF, JPG, PNG or XLSX · up to {maxFileSizeMb}MB each
              </p>
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
        </motion.section>

        <AnimatePresence>
          {globalError ? (
            <motion.p
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: EASE }}
              role="alert"
              className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300"
            >
              {globalError}
            </motion.p>
          ) : null}
        </AnimatePresence>

        {/* Queue */}
        <section className="mt-4 rounded-2xl border border-hairline bg-surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold tracking-[-0.02em] text-zinc-100">
              Your files
            </h2>
            <p className="text-sm text-zinc-500">
              {items.length === 0
                ? "Nothing selected yet"
                : `${successCount} of ${items.length} uploaded`}
            </p>
          </div>

          {items.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-hairline bg-white/[0.02] px-4 py-8 text-center">
              <p className="text-sm text-zinc-500">
                Files you choose will appear here before they're sent.
              </p>
            </div>
          ) : (
            <ul className="mt-4 space-y-2.5">
              <AnimatePresence initial={false}>
                {items.map((item) => {
                  const meta = STATUS_META[item.status] || STATUS_META.pending;
                  const busy = ["preparing", "uploading", "confirming"].includes(item.status);

                  return (
                    <motion.li
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -12 }}
                      transition={{ duration: 0.28, ease: EASE }}
                      className="rounded-xl border border-hairline bg-white/[0.02] p-3.5"
                    >
                      <div className="flex items-start gap-3">
                        <FileTypeIcon extension={fileExtension(item.file.name)} size={26} />

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-100">
                              {item.file.name}
                            </p>
                            <span
                              className={`inline-flex flex-none items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.7rem] font-semibold ${meta.className}`}
                            >
                              {busy ? (
                                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                              ) : null}
                              {item.status === "success" ? (
                                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                                  <path d="M2.5 6.2 4.8 8.5 9.5 3.8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              ) : null}
                              {meta.label}
                            </span>
                          </div>

                          <p
                            className={`mt-0.5 truncate text-xs ${
                              item.status === "error" ? "text-red-400" : "text-zinc-500"
                            }`}
                          >
                            {formatBytes(item.file.size)} · {item.message}
                          </p>

                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                            <motion.div
                              className={`h-full rounded-full ${
                                item.status === "error"
                                  ? "bg-red-500"
                                  : item.status === "success"
                                    ? "bg-verify-500"
                                    : "bg-indigo-500"
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
                            className="-mr-1 -mt-1 flex-none rounded-lg p-1.5 text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200"
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
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

          <motion.button
            type="button"
            className="vx-btn-primary mt-5 w-full py-3.5 text-[0.95rem]"
            disabled={uploading || pendingCount === 0}
            onClick={processUploadQueue}
            whileHover={uploading || pendingCount === 0 ? undefined : { opacity: 0.82 }}
            transition={{ duration: 0.15, ease: EASE }}
          >
            {uploading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Uploading files…
              </>
            ) : (
              `Upload ${pendingCount > 0 ? pendingCount : ""} ${pendingCount === 1 ? "file" : "files"}`.replace(/\s+/g, " ").trim()
            )}
          </motion.button>

          <AnimatePresence>
            {successCount > 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: EASE }}
                className="mt-4 flex flex-col items-start gap-3 rounded-xl border border-verify-200 bg-verify-50 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <p className="text-sm font-medium text-verify-700">
                  {successCount} {successCount === 1 ? "file is" : "files are"} with your
                  accountant. You can close this page.
                </p>
                <Link
                  to={statusHref}
                  className="vx-btn-secondary flex-none px-4 py-2.5 text-sm"
                >
                  View upload status
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m9 6 6 6-6 6" />
                  </svg>
                </Link>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </section>
      </motion.div>
    </PublicPageShell>
  );
};

export default PublicUploadPage;
