import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import EmptyState from "../components/ui/EmptyState";
import { ClientDocumentsSkeleton } from "../components/ui/skeletons";
import StatusBadge from "../components/ui/StatusBadge";
import { documentsApi } from "../api/documents-api";
import { clientsApi } from "../api/clients-api";
import { uploadApi } from "../api/upload-api";
import { formatDateTime, parseApiError } from "../lib/utils";

const DOC_TYPE_META = {
  invoice:       { label: "Invoice",      cls: "bg-indigo-100 text-indigo-700" },
  bank_statement:{ label: "Bank Stmt",    cls: "bg-sky-100 text-sky-700" },
  bill:          { label: "Bill",         cls: "bg-amber-100 text-amber-700" },
  other:         { label: "Other",        cls: "bg-gray-100 text-gray-600" }
};

const DocTypeBadge = ({ docType }) => {
  const meta = DOC_TYPE_META[docType] || DOC_TYPE_META.other;
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${meta.cls}`}>{meta.label}</span>
  );
};

const allowedExtensions = ["pdf", "jpg", "jpeg", "png", "xlsx"];
const maxFileSizeMb = 50;

const fileExtension = (name = "") => name.split(".").pop()?.toLowerCase() || "";

const ClientDocumentsPage = () => {
  const { id } = useParams();
  const [clientName, setClientName] = useState("Client documents");
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState("other");
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

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
    if (uploading || uploadable.length === 0) {
      return;
    }

    setUploading(true);
    setError("");
    setToast("");

    for (const item of uploadable) {
      try {
        updateItem(item.id, { status: "preparing", message: "Requesting upload URL...", progress: 0 });

        const uploadInit = await documentsApi.requestUpload({
          client_id: id,
          file_name: item.file.name,
          file_type: item.file.type || "application/octet-stream",
          file_size: item.file.size,
          doc_type: docType
        });

        updateItem(item.id, { status: "uploading", message: "Uploading to secure storage..." });

        await uploadApi.uploadFileToSignedUrl(uploadInit.upload_url, item.file, (progress) => {
          updateItem(item.id, { progress });
        });

        updateItem(item.id, { status: "confirming", message: "Confirming and queueing OCR...", progress: 100 });

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

  return (
    <AppShell title={clientName} subtitle="Track every document for this client, from upload to export.">
      <section className="mb-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <article className="panel p-4">
          <h2 className="text-lg font-bold text-ink-900">Upload new documents</h2>
          <p className="mt-1 text-sm text-[#6b7c92]">
            Direct browser-to-S3 upload with queue confirmation. PDF, JPG, PNG, XLSX up to {maxFileSizeMb}MB each.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_220px]">
            <input
              className="field"
              type="file"
              multiple
              onChange={onFileInputChange}
              accept=".pdf,.jpg,.jpeg,.png,.xlsx"
            />
            <select className="field" value={docType} onChange={(event) => setDocType(event.target.value)}>
              <option value="invoice">Invoice</option>
              <option value="bank_statement">Bank statement</option>
              <option value="bill">Bill</option>
              <option value="other">Other</option>
            </select>
          </div>

          {error ? (
            <div className="mt-3 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          {toast ? (
            <div className="mt-3 rounded-lg border border-mint-300 bg-mint-500/10 px-3 py-2 text-sm text-mint-700">
              {toast}
            </div>
          ) : null}

          {items.length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#6c7d93]">
                  Queue — {successCount} successful / {items.length} total
                </p>
              </div>
              <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {items.map((item) => (
                  <div key={item.id} className="rounded-xl border border-[#e4d8c5] bg-sand-50 p-3">
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-ink-900">{item.file.name}</p>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
                            item.status === "success"
                              ? "bg-mint-500/15 text-mint-700"
                              : item.status === "error" || item.status === "invalid"
                                ? "bg-rose-500/15 text-rose-700"
                                : "bg-ink-900/10 text-ink-700"
                          }`}
                        >
                          {item.status}
                        </span>
                        {(item.status === "pending" || item.status === "invalid") && (
                          <button
                            type="button"
                            className="text-xs font-semibold text-[#8b7757] underline"
                            onClick={() => removeItem(item.id)}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                    <p
                      className={`text-xs ${
                        item.status === "invalid" || item.status === "error" ? "text-rose-600" : "text-[#6c7d93]"
                      }`}
                    >
                      {item.message}
                    </p>
                    {item.status !== "invalid" && (
                      <div className="mt-2 h-2 rounded-full bg-[#eadfcf]">
                        <div
                          className="h-2 rounded-full bg-ink-800 transition-all"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            className="btn-primary mt-4 w-full"
            disabled={uploading || uploadableCount === 0}
            onClick={processUploadQueue}
          >
            {uploading ? "Uploading files..." : `Upload ${uploadableCount > 0 ? uploadableCount : ""} file${uploadableCount === 1 ? "" : "s"}`}
          </button>
        </article>

        <article className="panel p-4">
          <h2 className="text-lg font-bold text-ink-900">Navigation</h2>
          <div className="mt-4 space-y-2">
            <Link className="btn-secondary block text-center" to={`/clients/${id}`}>
              Open client profile
            </Link>
            <Link className="btn-secondary block text-center" to="/clients">
              Back to clients
            </Link>
          </div>
        </article>
      </section>

      <section className="panel overflow-hidden p-4">
        <h2 className="text-lg font-bold text-ink-900">Document inbox</h2>
        {loading ? (
          <div className="mt-4">
            <ClientDocumentsSkeleton rows={5} />
          </div>
        ) : rows.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="No documents yet"
              description="After uploads are confirmed, documents will appear here with processing status."
            />
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0">
              <thead>
                <tr className="bg-sand-100 text-left text-xs uppercase tracking-wide text-[#6c7d93]">
                  <th className="rounded-l-lg px-3 py-3">File</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Uploaded</th>
                  <th className="rounded-r-lg px-3 py-3 text-right">Review</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((doc) => (
                  <tr key={doc.id} className="border-t border-[#eadfcf]">
                    <td className="px-3 py-3 text-sm font-semibold text-ink-900">{doc.fileName || doc.file_name}</td>
                    <td className="px-3 py-3"><DocTypeBadge docType={doc.docType || doc.doc_type} /></td>
                    <td className="px-3 py-3 text-sm">
                      <StatusBadge status={doc.status} />
                    </td>
                    <td className="px-3 py-3 text-xs text-[#697a90]">{formatDateTime(doc.uploadedAt || doc.uploaded_at)}</td>
                    <td className="px-3 py-3 text-right text-sm">
                      <Link className="btn-secondary px-2.5 py-1.5 text-xs" to={`/review/${doc.id}`}>
                        Open review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppShell>
  );
};

export default ClientDocumentsPage;
