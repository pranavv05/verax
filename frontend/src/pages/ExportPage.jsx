import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import AppShell from "../components/layout/AppShell";
import EmptyState from "../components/ui/EmptyState";
import { ExportSkeleton } from "../components/ui/skeletons";
import StatusBadge from "../components/ui/StatusBadge";
import { clientsApi } from "../api/clients-api";
import { documentsApi } from "../api/documents-api";
import { exportsApi } from "../api/exports-api";
import { useAuth } from "../contexts/AuthContext";
import { formatDateTime, parseApiError, triggerFileDownload } from "../lib/utils";
import { isAdmin } from "../utils/permissions";

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

const formatCurrency = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

const ExportPage = () => {
  const { user } = useAuth();
  const canAdmin = isAdmin(user);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedDocs, setSelectedDocs] = useState(new Set());
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [latestExport, setLatestExport] = useState(null);
  const [exportPreview, setExportPreview] = useState(null);
  const [showExportPreview, setShowExportPreview] = useState(false);
  const [showPreviewWarnings, setShowPreviewWarnings] = useState(false);
  const [previewExportPayload, setPreviewExportPayload] = useState(null);
  const [confirmingExport, setConfirmingExport] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [form, setForm] = useState({
    client_id: "",
    date_from: "",
    date_to: ""
  });

  const loadBaseData = async () => {
    setLoading(true);
    setError("");
    try {
      const [clientsResult, historyResult] = await Promise.allSettled([
        clientsApi.list({ page: 1, limit: 200 }),
        exportsApi.history({ page: 1, limit: 20 })
      ]);

      if (clientsResult.status === "fulfilled") {
        setClients(clientsResult.value.data || []);
      } else {
        setError(parseApiError(clientsResult.reason, "Unable to load clients — check that you are logged in"));
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
      const preview = await exportsApi.preview({
        clientId: validation.data.client_id,
        documentIds: validation.data.document_ids,
        fromDate: validation.data.date_from,
        toDate: validation.data.date_to
      });
      setPreviewExportPayload(validation.data);
      setExportPreview(preview);
      setPreviewError("");
      setShowPreviewWarnings(false);
      setShowExportPreview(true);
    } catch (previewRequestError) {
      setError(parseApiError(previewRequestError, "Unable to preview export"));
    } finally {
      setSaving(false);
    }
  };

  const onConfirmExport = async () => {
    if (!previewExportPayload) return;
    setConfirmingExport(true);
    setPreviewError("");
    setToast("");
    try {
      const result = await exportsApi.generateTally(previewExportPayload);
      setLatestExport(result);
      setShowExportPreview(false);
      setExportPreview(null);
      setPreviewExportPayload(null);
      setToast("Tally XML generated successfully.");
      if (result.download_url) {
        triggerFileDownload(result.download_url, "tally-export.xml");
      }
      const refreshedHistory = await exportsApi.history({ page: 1, limit: 20 });
      setHistory(refreshedHistory.data || []);
      await loadClientDocuments(form.client_id);
    } catch (generateError) {
      setPreviewError(parseApiError(generateError, "Unable to generate export"));
    } finally {
      setConfirmingExport(false);
    }
  };

  const onDownloadFromHistory = async (exportId) => {
    setError("");
    try {
      const result = await exportsApi.download(exportId);
      triggerFileDownload(result.download_url, "tally-export.xml");
    } catch (downloadError) {
      setError(parseApiError(downloadError, "Unable to create download link"));
    }
  };

  const selectedCount = useMemo(() => selectedDocs.size, [selectedDocs]);

  return (
    <AppShell title="Tally Export" subtitle="Select approved documents and generate TallyPrime-compatible XML.">
      {canAdmin && showExportPreview && exportPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 px-4 py-6 backdrop-blur-sm">
          <div className="panel flex max-h-[90vh] w-full max-w-4xl flex-col p-0">
            <div className="border-b border-[#eadfcf] px-5 py-4">
              <h3 className="text-lg font-bold text-ink-900">
                Export Preview - {clients.find((client) => client.id === form.client_id)?.name || "Client"}
              </h3>
              <p className="mt-1 text-sm text-[#607086]">
                {exportPreview.documentCount} documents · {exportPreview.vouchers?.length || 0} vouchers will be sent to TallyPrime
              </p>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {exportPreview.hasWarnings ? (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <p className="font-semibold">
                      {exportPreview.warnings.length} line items have unresolved Tally item name mappings.
                      These items will export with their original names.
                    </p>
                    <button
                      type="button"
                      className="text-xs font-bold text-amber-900 underline"
                      onClick={() => setShowPreviewWarnings((prev) => !prev)}
                    >
                      {showPreviewWarnings ? "Hide details" : "Show details"}
                    </button>
                  </div>
                  <p className="mt-1 text-xs">Review mappings before exporting for best results.</p>
                  {showPreviewWarnings ? (
                    <div className="mt-3 max-h-40 overflow-auto rounded-lg border border-amber-200 bg-white">
                      <table className="min-w-full text-left text-xs">
                        <thead className="bg-amber-100 text-amber-900">
                          <tr>
                            <th className="px-3 py-2">Invoice No.</th>
                            <th className="px-3 py-2">Item Name</th>
                            <th className="px-3 py-2">Issue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {exportPreview.warnings.map((warning, index) => (
                            <tr key={`${warning.documentId}-${warning.itemName}-${index}`} className="border-t border-amber-100">
                              <td className="px-3 py-2">{warning.invoiceNumber || "-"}</td>
                              <td className="px-3 py-2">{warning.itemName}</td>
                              <td className="px-3 py-2">Unresolved mapping</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {previewError ? (
                <div className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {previewError}
                </div>
              ) : null}

              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-0">
                  <thead>
                    <tr className="bg-sand-100 text-left text-xs uppercase tracking-wide text-[#6d7e95]">
                      <th className="rounded-l-lg px-3 py-3">Voucher Type</th>
                      <th className="px-3 py-3">Date</th>
                      <th className="px-3 py-3">Party</th>
                      <th className="px-3 py-3">Line Items</th>
                      <th className="px-3 py-3 text-right">Amount</th>
                      <th className="rounded-r-lg px-3 py-3 text-right">GST</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(exportPreview.vouchers || []).slice(0, 20).map((voucher, index) => (
                      <tr key={`${voucher.voucherType}-${voucher.voucherDate}-${index}`} className="border-t border-[#eadfcf]">
                        <td className="px-3 py-3 text-sm font-semibold text-ink-800">{voucher.voucherType}</td>
                        <td className="px-3 py-3 text-sm text-[#5f6f84]">{voucher.voucherDate || "-"}</td>
                        <td className="px-3 py-3 text-sm text-[#5f6f84]">{voucher.partyName || "-"}</td>
                        <td className="px-3 py-3 text-sm text-[#5f6f84]">{voucher.lineItemCount || 0}</td>
                        <td className="px-3 py-3 text-right text-sm font-semibold text-ink-800">
                          {formatCurrency(voucher.totalAmount)}
                        </td>
                        <td className="px-3 py-3 text-right text-sm text-[#5f6f84]">
                          {formatCurrency(voucher.gstAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {(exportPreview.vouchers?.length || 0) > 20 ? (
                <p className="text-sm text-[#607086]">
                  ...and {exportPreview.vouchers.length - 20} more vouchers
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-3 border-t border-[#eadfcf] px-5 py-4">
              <button
                type="button"
                className="btn-secondary flex-1"
                disabled={confirmingExport}
                onClick={() => {
                  setShowExportPreview(false);
                  setPreviewError("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary flex-1"
                disabled={confirmingExport}
                onClick={onConfirmExport}
              >
                {confirmingExport
                  ? "Exporting..."
                  : exportPreview.hasWarnings
                  ? "Export Anyway"
                  : "Confirm Export"}
              </button>
            </div>
          </div>
        </div>
      )}

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

      <section className={`grid gap-4 ${canAdmin ? "lg:grid-cols-[1.15fr_0.85fr]" : ""}`}>
        {canAdmin ? (
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
              {saving ? "Preparing preview..." : "Preview Tally XML"}
            </button>
          </form>
        </article>
        ) : null}

        {canAdmin && (
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
                onClick={() => triggerFileDownload(latestExport.download_url, "tally-export.xml")}
              >
                Download XML
              </button>
            </div>
          )}
        </article>
        )}
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
                    <td className="px-3 py-3 text-sm text-[#5f6f84]">
                      {clients.find((c) => c.id === row.clientId)?.name || row.clientId?.slice(0, 8)}
                    </td>
                    <td className="px-3 py-3 text-sm text-[#5f6f84]">
                      <div className="flex items-center gap-2">
                        {row.exportType === "bulk" && (
                          <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-xs font-bold text-indigo-700">
                            BULK
                          </span>
                        )}
                        <span>
                          {row.documentCount ?? (row.documentIds || []).length}{" "}
                          {(row.documentCount ?? (row.documentIds || []).length) === 1
                            ? "document"
                            : "documents"}
                        </span>
                      </div>
                    </td>
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
