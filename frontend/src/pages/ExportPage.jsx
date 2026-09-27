import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import AppShell from "../components/layout/AppShell";
import EmptyState from "../components/ui/EmptyState";
import { ExportSkeleton } from "../components/ui/skeletons";
import StatusBadge from "../components/ui/StatusBadge";
import ExportPreviewModal from "../components/app/ExportPreviewModal";
import { TableScroll } from "../components/app/TableKit";
import { Alert, Badge, Card, CardHeader, FormField, PageHeader } from "../components/app/primitives";
import { IconCheck, IconExport, IconEye, IconFile, IconHistory } from "../components/app/icons";
import ClientSearchSelect from "../components/ui/ClientSearchSelect";
import { clientsApi } from "../api/clients-api";
import { documentsApi } from "../api/documents-api";
import { exportsApi } from "../api/exports-api";
import { useAuth } from "../contexts/AuthContext";
import { cn, formatDateTime, parseApiError, triggerFileDownload } from "../lib/utils";
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

const DOC_TYPE_LABEL = { invoice: "Invoice", bank_statement: "Bank statement", bill: "Bill", other: "Other" };

const Step = ({ n, title, done, children }) => (
  <li className="relative pl-10">
    <span
      className={cn(
        "absolute left-0 top-0 flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold",
        done ? "border-ui-ok/30 bg-ui-ok/10 text-ui-ok" : "border-ui-line-strong bg-ui-surface text-ui-fg-3"
      )}
    >
      {done ? <IconCheck size={12} /> : n}
    </span>
    <p className="text-[0.8125rem] font-medium text-ui-fg">{title}</p>
    <div className="mt-2.5">{children}</div>
  </li>
);

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
        try {
          await triggerFileDownload(result.download_url, "tally-export.xml");
        } catch (downloadError) {
          setError(parseApiError(downloadError, "Export was generated but the download failed"));
        }
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
      await triggerFileDownload(result.download_url, "tally-export.xml");
    } catch (downloadError) {
      setError(parseApiError(downloadError, "Unable to create download link"));
    }
  };

  const selectedCount = useMemo(() => selectedDocs.size, [selectedDocs]);
  const selectedClient = clients.find((client) => client.id === form.client_id);
  const allSelected = documents.length > 0 && selectedCount === documents.length;
  const clientNameById = (id) => clients.find((c) => c.id === id)?.name;

  const toggleAll = () => setSelectedDocs(allSelected ? new Set() : new Set(documents.map((doc) => doc.id)));


  return (
    <AppShell>
      <ExportPreviewModal
        open={canAdmin && showExportPreview}
        preview={exportPreview}
        clientName={selectedClient?.name}
        error={previewError}
        confirming={confirmingExport}
        onCancel={() => {
          setShowExportPreview(false);
          setPreviewError("");
        }}
        onConfirm={onConfirmExport}
      />

      <PageHeader
        kicker="TallyPrime XML"
        title="Export."
        tint="Approved documents, straight into Tally."
        description="Pick a client and the approved documents to send. You'll see every voucher before anything is generated."
      />

      {loading ? (
        <ExportSkeleton />
      ) : (
        <>
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

          {canAdmin ? (
            <form onSubmit={onGenerate} className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              <Card>
                <CardHeader title="New export" icon={<IconExport size={14} />} />
                <ol className="space-y-7 px-5 py-6">
                  <Step n={1} title="Client" done={Boolean(form.client_id)}>
                    <ClientSearchSelect
                      clients={clients}
                      value={form.client_id}
                      onChange={(clientId) => setForm((prev) => ({ ...prev, client_id: clientId }))}
                    />
                  </Step>

                  <Step n={2} title="Period (optional)" done={Boolean(form.date_from || form.date_to)}>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <FormField label="From" htmlFor="export-from">
                        <input
                          id="export-from"
                          className="field"
                          type="date"
                          value={form.date_from}
                          onChange={(event) => setForm((prev) => ({ ...prev, date_from: event.target.value }))}
                        />
                      </FormField>
                      <FormField label="To" htmlFor="export-to">
                        <input
                          id="export-to"
                          className="field"
                          type="date"
                          value={form.date_to}
                          onChange={(event) => setForm((prev) => ({ ...prev, date_to: event.target.value }))}
                        />
                      </FormField>
                    </div>
                  </Step>

                  <Step n={3} title="Approved documents" done={selectedCount > 0}>
                    <div className="overflow-hidden rounded-xl border border-ui-line">
                      <div className="flex items-center justify-between gap-3 border-b border-ui-line bg-ui-subtle px-3 py-2">
                        <label className="flex items-center gap-2 text-xs font-medium text-ui-fg-2">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-[rgb(var(--ui-accent))]"
                            checked={allSelected}
                            disabled={documents.length === 0}
                            onChange={toggleAll}
                          />
                          Select all
                        </label>
                        <span className="text-xs tabular-nums text-ui-fg-3">
                          {selectedCount} of {documents.length} selected
                        </span>
                      </div>
                      {documents.length === 0 ? (
                        <p className="px-4 py-8 text-center text-[0.8125rem] text-ui-fg-3">
                          {form.client_id ? "No approved documents waiting for this client." : "Choose a client to see their approved documents."}
                        </p>
                      ) : (
                        <ul className="max-h-72 divide-y divide-ui-line overflow-auto">
                          {documents.map((doc) => (
                            <li key={doc.id}>
                              <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-[0.8125rem] transition-colors hover:bg-ui-subtle">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 accent-[rgb(var(--ui-accent))]"
                                  checked={selectedDocs.has(doc.id)}
                                  onChange={() => onToggleDocument(doc.id)}
                                />
                                <IconFile size={14} className="text-ui-fg-4" />
                                <span className="min-w-0 flex-1 truncate text-ui-fg">{doc.fileName || doc.file_name}</span>
                                <span className="text-xs text-ui-fg-3">{DOC_TYPE_LABEL[doc.docType || doc.doc_type] || "Other"}</span>
                              </label>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </Step>
                </ol>
              </Card>

              <div className="grid grid-cols-1 content-start gap-5 lg:sticky lg:top-20 lg:self-start">
                <Card className="relative overflow-hidden">
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background:
                        "radial-gradient(60% 80% at 100% 0%, rgb(102 87 217 / 0.09), transparent 70%), radial-gradient(50% 70% at 0% 100%, rgb(20 184 166 / 0.07), transparent 70%)"
                    }}
                  />
                  <div className="relative px-5 py-5">
                    <p className="text-[0.8125rem] font-medium text-ui-fg-3">Ready to send</p>
                    <p className="mt-1 text-[2.25rem] font-semibold leading-none tracking-[-0.04em] text-ui-fg">{selectedCount}</p>
                    <p className="mt-2 text-xs text-ui-fg-3">
                      {selectedClient ? `documents from ${selectedClient.name}` : "Choose a client to begin"}
                    </p>
                    <button type="submit" className="btn-primary mt-5 w-full" disabled={saving || selectedCount === 0}>
                      <IconEye size={14} />
                      {saving ? "Preparing preview…" : "Preview vouchers"}
                    </button>
                    <p className="mt-2.5 text-center text-[11px] text-ui-fg-4">Nothing is generated until you confirm.</p>
                  </div>
                </Card>

                <Card>
                  <CardHeader title="Latest export" />
                  <div className="px-5 py-4">
                    {!latestExport ? (
                      <p className="text-[0.8125rem] text-ui-fg-3">Your newest XML file will be ready to download here.</p>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-ui-ok/20 bg-ui-ok/[0.08] text-ui-ok">
                            <IconCheck size={16} />
                          </span>
                          <div className="min-w-0">
                            <p className="text-[0.8125rem] font-medium text-ui-fg">
                              {latestExport.document_count} document{latestExport.document_count === 1 ? "" : "s"} exported
                            </p>
                            <p className="ui-mono truncate text-[0.7rem] text-ui-fg-3">{latestExport.export_id}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn-secondary w-full"
                          onClick={() =>
                            triggerFileDownload(latestExport.download_url, "tally-export.xml").catch((downloadError) =>
                              setError(parseApiError(downloadError, "Unable to download export"))
                            )
                          }
                        >
                          <IconExport size={14} />
                          Download XML
                        </button>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            </form>
          ) : null}

          <Card className={cn("overflow-hidden", canAdmin && "mt-5")}>
            <CardHeader title="History" description="Every Tally file your firm has generated. Re-download any time." icon={<IconHistory size={14} />} />
            {history.length === 0 ? (
              <div className="p-4">
                <EmptyState compact title="No exports yet" description="Generated exports will appear here for quick re-download." />
              </div>
            ) : (
              <TableScroll>
                <table className="ui-table">
                  <thead>
                    <tr>
                      <th>Client</th>
                      <th>Documents</th>
                      <th>Status</th>
                      <th>Date</th>
                      <th>Export ID</th>
                      <th className="w-24">
                        <span className="sr-only">Download</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((row) => {
                      const count = row.documentCount ?? (row.documentIds || []).length;
                      return (
                        <tr key={row.id}>
                          <td className="font-medium text-ui-fg">{clientNameById(row.clientId) || <span className="ui-mono">{row.clientId?.slice(0, 8)}</span>}</td>
                          <td>
                            <span className="inline-flex items-center gap-2">
                              <span className="tabular-nums">{count}</span>
                              {row.exportType === "bulk" ? <Badge tone="accent">Bulk</Badge> : null}
                            </span>
                          </td>
                          <td>
                            <StatusBadge status={row.status} />
                          </td>
                          <td className="whitespace-nowrap text-xs text-ui-fg-3">{formatDateTime(row.exportedAt || row.createdAt)}</td>
                          <td className="ui-mono text-[0.72rem] text-ui-fg-4">{row.id.slice(0, 8)}</td>
                          <td className="text-right">
                            <button
                              type="button"
                              className="btn-ghost btn-sm"
                              disabled={row.status === "failed"}
                              onClick={() => onDownloadFromHistory(row.id)}
                            >
                              <IconExport size={13} />
                              XML
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TableScroll>
            )}
          </Card>
        </>
      )}
    </AppShell>
  );
};

export default ExportPage;
