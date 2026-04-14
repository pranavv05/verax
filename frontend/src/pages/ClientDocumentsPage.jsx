import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import EmptyState from "../components/ui/EmptyState";
import LoadingState from "../components/ui/LoadingState";
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

const ClientDocumentsPage = () => {
  const { id } = useParams();
  const [clientName, setClientName] = useState("Client documents");
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState("other");
  const [selectedFile, setSelectedFile] = useState(null);
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

  const onUpload = async () => {
    if (!selectedFile) {
      setError("Choose a file to upload.");
      return;
    }

    setUploading(true);
    setError("");
    setToast("");

    try {
      const uploadInit = await documentsApi.requestUpload({
        client_id: id,
        file_name: selectedFile.name,
        file_type: selectedFile.type || "application/octet-stream",
        file_size: selectedFile.size,
        doc_type: docType
      });

      await uploadApi.uploadFileToSignedUrl(uploadInit.upload_url, selectedFile);
      await documentsApi.confirmUpload(uploadInit.document_id);

      setToast("Upload completed. Document has been queued for OCR processing.");
      setSelectedFile(null);
      await loadDocuments();
    } catch (uploadError) {
      setError(parseApiError(uploadError, "Unable to upload document"));
    } finally {
      setUploading(false);
    }
  };

  const rows = useMemo(() => docs || [], [docs]);

  return (
    <AppShell title={clientName} subtitle="Track every document for this client, from upload to export.">
      <section className="mb-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <article className="panel p-4">
          <h2 className="text-lg font-bold text-ink-900">Upload new document</h2>
          <p className="mt-1 text-sm text-[#6b7c92]">Direct browser-to-S3 upload with queue confirmation.</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_220px_140px]">
            <input
              className="field"
              type="file"
              onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
              accept=".pdf,.jpg,.jpeg,.png,.xlsx"
            />
            <select className="field" value={docType} onChange={(event) => setDocType(event.target.value)}>
              <option value="invoice">Invoice</option>
              <option value="bank_statement">Bank statement</option>
              <option value="bill">Bill</option>
              <option value="other">Other</option>
            </select>
            <button type="button" className="btn-primary" disabled={uploading} onClick={onUpload}>
              {uploading ? "Uploading..." : "Upload"}
            </button>
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

      {loading ? <LoadingState message="Loading documents..." /> : null}

      <section className="panel overflow-hidden p-4">
        <h2 className="text-lg font-bold text-ink-900">Document inbox</h2>
        {rows.length === 0 ? (
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
