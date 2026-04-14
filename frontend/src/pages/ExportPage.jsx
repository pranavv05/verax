import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import AppShell from "../components/layout/AppShell";
import EmptyState from "../components/ui/EmptyState";
import { ExportSkeleton } from "../components/ui/skeletons";
import StatusBadge from "../components/ui/StatusBadge";
import { clientsApi } from "../api/clients-api";
import { documentsApi } from "../api/documents-api";
import { exportsApi } from "../api/exports-api";
import { formatDateTime, parseApiError } from "../lib/utils";

const exportSchema = z
  .object({
    client_id: z.string().uuid("Select a client"),
    document_ids: z.array(z.string().uuid()).min(1, "Select at least one approved document"),
    date_from: z.string().optional(),
    date_to: z.string().optional()
  })
  .superRefine((value, ctx) => {
    if (value.date_from && value.date_to && value.date_from > value.date_to) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Date from must be before date to",
        path: ["date_from"]
      });
    }
  });

const DOC_TYPE_LABELS = {
  invoice: { label: "Invoice", className: "bg-indigo-100 text-indigo-700" },
  bank_statement: { label: "Bank Stmt", className: "bg-sky-100 text-sky-700" },
  bill: { label: "Bill", className: "bg-amber-100 text-amber-700" },
  other: { label: "Other", className: "bg-gray-100 text-gray-600" }
};

const DocTypeBadge = ({ docType }) => {
  const cfg = DOC_TYPE_LABELS[docType] || DOC_TYPE_LABELS.other;
  return (
    <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold ${cfg.className}`}>
      {cfg.label}
    </span>
  );
};

const ExportPage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedDocs, setSelectedDocs] = useState(new Set());
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [latestExport, setLatestExport] = useState(null);
  const [form, setForm] = useState({
    client_id: "",
    date_from: "",
    date_to: ""
  });

  const loadBaseData = async () => {
    setLoading(true);
    try {
      const [clientsResult, historyResult] = await Promise.allSettled([
        clientsApi.list({ page: 1, limit: 200, status: "active" }),
        exportsApi.history({ page: 1, limit: 20 })
      ]);

      if (clientsResult.status === "fulfilled") {
        setClients(clientsResult.value.data || []);
      }

      if (historyResult.status === "fulfilled") {
        setHistory(historyResult.value.data || []);
      }
    } catch (loadError) {
      setError(parseApiError(loadError, "Unable to load export data"));
    } finally {
      setLoading(false);
    }
  };

  const loadClientDocuments = async (clientId) => {
    if (!clientId) {
      setDocuments([]);
      setSelectedDocs(new Set());
      return;
    }

    try {
      const docsResult = await documentsApi.list({ client_id: clientId, status: "reviewed" });
      const rows = docsResult.data || [];
      setDocuments(rows);
      setSelectedDocs(new Set(rows.map((doc) => doc.id)));
    } catch (docsError) {
      setDocuments([]);
      setSelectedDocs(new Set());
      setError(parseApiError(docsError, "Document listing endpoint is unavailable for reviewed filter"));
    }
  };

  useEffect(() => {
    loadBaseData();
  }, []);

  useEffect(() => {
    loadClientDocuments(form.client_id);
  }, [form.client_id]);

  const onToggleDocument = (docId) => {
    setSelectedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
      }
      return next;
    });
  };

  const onGenerate = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setToast("");

    const payload = {
      client_id: form.client_id,
      document_ids: Array.from(selectedDocs),
      date_from: form.date_from || undefined,
      date_to: form.date_to || undefined
    };

    const validation = exportSchema.safeParse(payload);
    if (!validation.success) {
      setSaving(false);
      setError(validation.error.issues[0]?.message || "Invalid export request");
      return;
    }

    try {
      const result = await exportsApi.generateTally(validation.data);
      setLatestExport(result);
      setToast("Tally XML generated successfully.");
      const refreshedHistory = await exportsApi.history({ page: 1, limit: 20 });
      setHistory(refreshedHistory.data || []);
    } catch (generateError) {
      setError(parseApiError(generateError, "Unable to generate export"));
    } finally {
      setSaving(false);
    }
  };

  const onDownloadFromHistory = async (exportId) => {
    setError("");
    try {
      const result = await exportsApi.download(exportId);
      window.open(result.download_url, "_blank", "noopener,noreferrer");
    } catch (downloadError) {
      setError(parseApiError(downloadError, "Unable to create download link"));
    }
  };

  const selectedCount = useMemo(() => selectedDocs.size, [selectedDocs]);

  return (
    <AppShell title="Tally Export" subtitle="Select approved documents and generate TallyPrime-compatible XML.">
      {loading ? <ExportSkeleton /> : (
      <>
      {error ? (
        <div className="mb-4 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      ) : null}

      {toast ? (
        <div className="mb-4 rounded-lg border border-mint-300 bg-mint-500/10 px-4 py-3 text-sm font-semibold text-mint-700">
          {toast}
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <article className="panel p-5">
          <h2 className="text-lg font-bold text-ink-900">Generate XML</h2>

          <form className="mt-4 space-y-3" onSubmit={onGenerate}>
            <div>
              <label className="label">Client</label>
              <select
                className="field"
                value={form.client_id}
                onChange={(event) => setForm((prev) => ({ ...prev, client_id: event.target.value }))}
              >
                <option value="">Select client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Date from</label>
                <input
                  className="field"
                  type="date"
                  value={form.date_from}
                  onChange={(event) => setForm((prev) => ({ ...prev, date_from: event.target.value }))}
                />
              </div>
              <div>
                <label className="label">Date to</label>
                <input
                  className="field"
                  type="date"
                  value={form.date_to}
                  onChange={(event) => setForm((prev) => ({ ...prev, date_to: event.target.value }))}
                />
              </div>
            </div>

            <div className="rounded-xl border border-[#e4d8c4] bg-sand-50 p-3">
              <div className="mb-2 flex items-center justify-between text-sm font-semibold text-ink-800">
                <span>Approved documents</span>
                <span>{selectedCount} selected</span>
              </div>

              {documents.length === 0 ? (
                <p className="text-xs text-[#6f8097]">No reviewed documents available for this client.</p>
              ) : (
                <div className="max-h-48 space-y-2 overflow-auto pr-1">
                  {documents.map((doc) => (
                    <label key={doc.id} className="flex items-center gap-2 rounded-lg border border-[#e7dcc8] bg-white px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedDocs.has(doc.id)}
                        onChange={() => onToggleDocument(doc.id)}
                      />
                      <span className="flex-1 truncate">{doc.fileName || doc.file_name}</span>
                      <DocTypeBadge docType={doc.docType || doc.doc_type} />
                      <StatusBadge status={doc.status} />
                    </label>
                  ))}
                </div>
              )}
            </div>

            <button type="submit" className="btn-primary w-full" disabled={saving}>
              {saving ? "Generating..." : "Generate Tally XML"}
            </button>
          </form>
        </article>

        <article className="panel p-5">
          <h2 className="text-lg font-bold text-ink-900">Latest export</h2>
          {!latestExport ? (
            <p className="mt-3 text-sm text-[#6b7c92]">Generate an export to receive a download link.</p>
          ) : (
            <div className="mt-3 space-y-3 rounded-xl border border-[#e6dbc7] bg-sand-50 p-4">
              <p className="text-sm text-[#627289]">
                Export ID: <span className="font-mono">{latestExport.export_id}</span>
              </p>
              <p className="text-sm text-[#627289]">Documents: {latestExport.document_count}</p>
              <button
                type="button"
                className="btn-primary w-full"
                onClick={() => window.open(latestExport.download_url, "_blank", "noopener,noreferrer")}
              >
                Download XML
              </button>
            </div>
          )}
        </article>
      </section>

      <section className="panel mt-6 p-5">
        <h2 className="text-lg font-bold text-ink-900">Export history</h2>
        {history.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="No exports yet"
              description="Generated exports will appear here for quick re-download."
            />
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0">
              <thead>
                <tr className="bg-sand-100 text-left text-xs uppercase tracking-wide text-[#6d7e95]">
                  <th className="rounded-l-lg px-3 py-3">Export ID</th>
                  <th className="px-3 py-3">Client</th>
                  <th className="px-3 py-3">Docs</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Date</th>
                  <th className="rounded-r-lg px-3 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.id} className="border-t border-[#eadfcf]">
                    <td className="px-3 py-3 font-mono text-xs text-[#4e6078]">{row.id.slice(0, 12)}</td>
                    <td className="px-3 py-3 text-sm text-[#5f6f84]">{row.clientId}</td>
                    <td className="px-3 py-3 text-sm text-[#5f6f84]">{(row.documentIds || []).length}</td>
                    <td className="px-3 py-3"><StatusBadge status={row.status} /></td>
                    <td className="px-3 py-3 text-xs text-[#6f8097]">{formatDateTime(row.exportedAt || row.createdAt)}</td>
                    <td className="px-3 py-3 text-right">
                      <button
                        type="button"
                        className="btn-secondary px-2.5 py-1.5 text-xs"
                        disabled={row.status === "failed"}
                        onClick={() => onDownloadFromHistory(row.id)}
                      >
                        Download
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      </>)}
    </AppShell>
  );
};

export default ExportPage;
