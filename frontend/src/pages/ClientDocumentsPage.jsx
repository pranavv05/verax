import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import EmptyState from "../components/ui/EmptyState";
import { ClientDocumentsSkeleton } from "../components/ui/skeletons";
import StatusBadge from "../components/ui/StatusBadge";
import { TableScroll } from "../components/app/TableKit";
import { Alert, Badge, Breadcrumbs, Card, CardHeader, Progress, Segmented } from "../components/app/primitives";
import { IconChevronRight, IconClose, IconFile, IconUpload, IconUser } from "../components/app/icons";
import { documentsApi } from "../api/documents-api";
import { clientsApi } from "../api/clients-api";
import { uploadApi } from "../api/upload-api";
import { cn, formatDateTime, parseApiError } from "../lib/utils";

const DOC_TYPE_LABEL = {
  invoice: "Invoice",
  bank_statement: "Bank statement",
  bill: "Bill",
  other: "Other"
};

const INBOX_FILTERS = [
  { value: "all", label: "All" },
  { value: "review", label: "To review", statuses: ["extracted", "review_required"] },
  { value: "processing", label: "Processing", statuses: ["uploaded", "processing"] },
  { value: "done", label: "Done", statuses: ["reviewed", "exported"] }
];

const QUEUE_TONE = { success: "ok", error: "err", invalid: "err", pending: "neutral" };

const allowedExtensions = ["pdf", "jpg", "jpeg", "png", "xlsx"];
const maxFileSizeMb = 50;

const fileExtension = (name = "") => name.split(".").pop()?.toLowerCase() || "";

const ClientDocumentsPage = () => {
  const { id } = useParams();
  const [clientName, setClientName] = useState("Client documents");
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  // Nothing preselected — see PublicUploadPage: a default type sent bank
  // statements down the invoice extraction path.
  const [docType, setDocType] = useState("");
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [inboxFilter, setInboxFilter] = useState("all");
  const fileInputRef = useRef(null);

  const loadDocuments = async () => {
    setLoading(true);
    setError("");
    try {
      const [clientResult, docsResult] = await Promise.allSettled([
        clientsApi.getById(id),
        documentsApi.list({ client_id: id })
      ]);

      if (clientResult.status === "fulfilled") {
        setClientName(clientResult.value.name || "Client documents");
      }

      if (docsResult.status === "fulfilled") {
        setDocs(docsResult.value.data || []);
      } else {
        setDocs([]);
        setError(parseApiError(docsResult.reason, "Document listing endpoint is not available yet"));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [id]);

  const addFiles = useCallback((files) => {
    const incoming = Array.from(files || []);
    if (incoming.length === 0) {
      return;
    }

    const nextItems = incoming.map((file) => {
      const ext = fileExtension(file.name);
      if (!allowedExtensions.includes(ext)) {
        return {
          id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
          file,
          status: "invalid",
          progress: 0,
          message: `Unsupported file type ".${ext || "unknown"}" — allowed: ${allowedExtensions.join(", ")}`
        };
      }
      if (file.size > maxFileSizeMb * 1024 * 1024) {
        return {
          id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
          file,
          status: "invalid",
          progress: 0,
          message: `File exceeds ${maxFileSizeMb}MB limit`
        };
      }

      return {
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
        file,
        status: "pending",
        progress: 0,
        message: "Ready"
      };
    });

    setItems((prev) => [...prev, ...nextItems]);
  }, []);

  const onFileInputChange = (event) => {
    addFiles(event.target.files);
    event.target.value = "";
  };

  const updateItem = (itemId, patch) => {
    setItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, ...patch } : item)));
  };

  const removeItem = (itemId) => {
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const processUploadQueue = async () => {
    const uploadable = items.filter((item) => item.status === "pending" || item.status === "error");
    if (uploading || uploadable.length === 0 || !docType) {
      return;
    }

    setUploading(true);
    setError("");
    setToast("");

    for (const item of uploadable) {
      try {
        updateItem(item.id, { status: "preparing", message: "Requesting upload URL…", progress: 0 });

        const uploadInit = await documentsApi.requestUpload({
          client_id: id,
          file_name: item.file.name,
          file_type: item.file.type || "application/octet-stream",
          file_size: item.file.size,
          doc_type: docType
        });

        updateItem(item.id, { status: "uploading", message: "Uploading to secure storage…" });

        await uploadApi.uploadFileToSignedUrl(uploadInit.upload_url, item.file, (progress) => {
          updateItem(item.id, { progress });
        });

        updateItem(item.id, { status: "confirming", message: "Confirming and queueing for reading…", progress: 100 });

        await documentsApi.confirmUpload(uploadInit.document_id);

        updateItem(item.id, { status: "success", message: "Upload completed", progress: 100 });
      } catch (uploadError) {
        updateItem(item.id, {
          status: "error",
          message: parseApiError(uploadError, "Upload failed")
        });
      }
    }

    setUploading(false);
    setToast("Upload queue finished. Documents have been queued for OCR processing.");
    await loadDocuments();
  };

  const successCount = useMemo(() => items.filter((item) => item.status === "success").length, [items]);
  const uploadableCount = useMemo(
    () => items.filter((item) => item.status === "pending" || item.status === "error").length,
    [items]
  );

  const rows = useMemo(() => docs || [], [docs]);

  const counts = useMemo(() => {
    const result = { all: rows.length };
    INBOX_FILTERS.slice(1).forEach((filter) => {
      result[filter.value] = rows.filter((doc) => filter.statuses.includes(doc.status)).length;
    });
    return result;
  }, [rows]);

  const visibleRows = useMemo(() => {
    const filter = INBOX_FILTERS.find((item) => item.value === inboxFilter);
    return filter?.statuses ? rows.filter((doc) => filter.statuses.includes(doc.status)) : rows;
  }, [rows, inboxFilter]);

  const onDrop = (event) => {
    event.preventDefault();
    setDragActive(false);
    addFiles(event.dataTransfer.files);
  };

  return (
    <AppShell>
      <header className="mb-7 sm:mb-8">
        <Breadcrumbs
          items={[
            { label: "Clients", to: "/clients" },
            { label: clientName, to: `/clients/${id}` },
            { label: "Documents" }
          ]}
          className="mb-3"
        />
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-[1.625rem] font-semibold leading-[1.15] tracking-[-0.03em] text-ui-fg sm:text-[1.875rem]">
              Documents. <span className="font-normal text-ui-fg-3">From upload to Tally.</span>
            </h1>
            <p className="mt-2 text-[0.9375rem] text-ui-fg-3">Everything {clientName} has sent, and where it is now.</p>
          </div>
          <Link className="btn-secondary self-start md:self-auto" to={`/clients/${id}`}>
            <IconUser size={14} />
            Client profile
          </Link>
        </div>
      </header>

      {error ? (
        <Alert tone="err" className="mb-5" onDismiss={() => setError("")}>
          {error}
        </Alert>
      ) : null}
      {toast ? (
        <Alert tone="ok" className="mb-5" onDismiss={() => setToast("")}>
          {toast}
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.9fr)]">
        <Card className="self-start">
          <CardHeader title="Upload" description={`PDF, JPG, PNG or XLSX, up to ${maxFileSizeMb} MB each.`} icon={<IconUpload size={14} />} />
          <div className="space-y-4 px-5 py-5">
            <div>
              <p className="label">Document type</p>
              <Segmented
                ariaLabel="Document type"
                layoutId="upload-doc-type"
                size="sm"
                value={docType}
                onChange={setDocType}
                options={[
                  { value: "invoice", label: "Invoice" },
                  { value: "bill", label: "Bill" },
                  { value: "bank_statement", label: "Statement" },
                  { value: "other", label: "Other" }
                ]}
              />
            </div>

            <label
              onDragOver={(event) => {
                event.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={onDrop}
              className={cn(
                "relative flex cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-dashed px-4 py-9 text-center transition-colors",
                dragActive ? "border-ui-accent bg-ui-accent/[0.06]" : "border-ui-line-strong bg-ui-subtle hover:border-ui-accent/50"
              )}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-ui-line bg-ui-surface text-ui-fg-3 shadow-ui-card">
                <IconUpload size={17} />
              </span>
              <span className="text-[0.8125rem] font-medium text-ui-fg">Drop files here, or click to browse</span>
              <span className="text-xs text-ui-fg-3">They go straight to secure storage, then Verax reads them.</span>
              <input
                ref={fileInputRef}
                className="sr-only"
                type="file"
                multiple
                onChange={onFileInputChange}
                accept=".pdf,.jpg,.jpeg,.png,.xlsx"
              />
            </label>

            {items.length > 0 ? (
              <div>
                <p className="mb-2 text-xs text-ui-fg-3">
                  <span className="font-medium text-ui-fg-2">{successCount}</span> of {items.length} uploaded
                </p>
                <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {items.map((item) => (
                    <li key={item.id} className="rounded-lg border border-ui-line bg-ui-surface px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <IconFile size={14} className="text-ui-fg-4" />
                        <p className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium text-ui-fg">{item.file.name}</p>
                        <Badge tone={QUEUE_TONE[item.status] || "info"} className="capitalize">
                          {item.status}
                        </Badge>
                        {item.status === "pending" || item.status === "invalid" ? (
                          <button
                            type="button"
                            className="btn-icon h-6 w-6"
                            aria-label={`Remove ${item.file.name}`}
                            onClick={() => removeItem(item.id)}
                          >
                            <IconClose size={12} />
                          </button>
                        ) : null}
                      </div>
                      <p className={cn("mt-1 text-xs", item.status === "invalid" || item.status === "error" ? "text-ui-err" : "text-ui-fg-3")}>
                        {item.message}
                      </p>
                      {item.status !== "invalid" && item.status !== "pending" ? (
                        <Progress value={item.progress} className="mt-2 h-1" tone={item.status === "success" ? "ok" : "brand"} />
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <button type="button" className="btn-primary w-full" disabled={uploading || uploadableCount === 0 || !docType} onClick={processUploadQueue}>
              <IconUpload size={14} />
              {uploading
                ? "Uploading…"
                : uploadableCount > 0
                  ? `Upload ${uploadableCount} file${uploadableCount === 1 ? "" : "s"}`
                  : "Upload files"}
            </button>
            {!docType && uploadableCount > 0 ? (
              <p className="text-center text-xs text-ui-fg-3">Choose a document type above to upload.</p>
            ) : null}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-ui-line px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-[0.9375rem] font-semibold tracking-[-0.01em] text-ui-fg">Inbox</h2>
              <p className="mt-0.5 text-[0.8125rem] text-ui-fg-3">Open a document to check and approve what Verax read.</p>
            </div>
            <Segmented
              ariaLabel="Filter documents"
              layoutId="inbox-filter"
              size="sm"
              value={inboxFilter}
              onChange={setInboxFilter}
              options={INBOX_FILTERS.map((filter) => ({ ...filter, count: counts[filter.value] }))}
            />
          </div>

          {loading ? (
            <div className="p-2">
              <ClientDocumentsSkeleton rows={5} />
            </div>
          ) : visibleRows.length === 0 ? (
            <div className="p-4">
              <EmptyState
                compact
                title={rows.length === 0 ? "No documents yet" : "Nothing in this view"}
                description={
                  rows.length === 0
                    ? "Upload files here, or send the client their upload link from their profile."
                    : "Try another filter."
                }
              />
            </div>
          ) : (
            <TableScroll>
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>File</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Uploaded</th>
                    <th className="w-10">
                      <span className="sr-only">Open</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((doc) => (
                    <tr key={doc.id} className="group">
                      <td className="max-w-[18rem]">
                        <Link to={`/review/${doc.id}`} className="flex items-center gap-2.5 font-medium text-ui-fg hover:text-ui-accent-text">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-ui-line bg-ui-subtle text-ui-fg-3">
                            <IconFile size={13} />
                          </span>
                          <span className="truncate">{doc.fileName || doc.file_name}</span>
                        </Link>
                      </td>
                      <td className="whitespace-nowrap text-ui-fg-3">{DOC_TYPE_LABEL[doc.docType || doc.doc_type] || "Other"}</td>
                      <td>
                        <StatusBadge status={doc.status} />
                      </td>
                      <td className="whitespace-nowrap text-xs text-ui-fg-3">{formatDateTime(doc.uploadedAt || doc.uploaded_at)}</td>
                      <td className="text-right">
                        <Link to={`/review/${doc.id}`} className="btn-icon" aria-label={`Open ${doc.fileName || doc.file_name}`}>
                          <IconChevronRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          )}
        </Card>
      </div>
    </AppShell>
  );
};

export default ClientDocumentsPage;
