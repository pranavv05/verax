import { useEffect, useRef, useState } from "react";
import { clientsApi } from "../../api/clients-api";
import { parseApiError } from "../../lib/utils";

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const ALLOWED_EXTENSIONS = ["csv", "xlsx"];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const WARNING_MESSAGES = new Set([
  "Email missing — client reminders won't work",
  "Phone missing — WhatsApp won't work"
]);

const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const fileExtension = (filename) => (filename.split(".").pop() || "").toLowerCase();

const classifyIssues = (issues) => {
  const hasWarningOnly = issues.length > 0 && issues.every((issue) => WARNING_MESSAGES.has(issue));
  if (issues.length === 0) return "valid";
  if (hasWarningOnly) return "warning";
  return "error";
};

const revalidateGstinLocally = (rawValue, otherGstins) => {
  const gstin = String(rawValue || "").trim().toUpperCase();
  if (!gstin) {
    return { gstin: null, issue: null };
  }
  if (gstin.length !== 15 || !GSTIN_PATTERN.test(gstin)) {
    return { gstin: null, issue: "Invalid GSTIN format" };
  }
  if (otherGstins.has(gstin)) {
    return { gstin, issue: "Duplicate GSTIN in this file" };
  }
  return { gstin, issue: null };
};

const CheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" className="opacity-10" fill="currentColor" stroke="none" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75l2.25 2.25 4.5-4.5" />
  </svg>
);

const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"
    />
  </svg>
);

const UploadIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 8.25L12 3.75m0 0L7.5 8.25M12 3.75v12"
    />
  </svg>
);

const ChevronIcon = ({ open }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className={`transition-transform ${open ? "rotate-180" : ""}`}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
  </svg>
);

const initialState = {
  view: "upload",
  dragActive: false,
  selectedFile: null,
  uploading: false,
  uploadError: "",
  previewData: null,
  rows: [],
  editingRowNumber: null,
  editValue: "",
  confirmLoading: false,
  confirmError: "",
  successResult: null
};

const ClientImportModal = ({ open, onClose, onImported }) => {
  const [state, setState] = useState(initialState);
  const [readyCollapsed, setReadyCollapsed] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setState(initialState);
      setReadyCollapsed(false);
    }
  }, [open]);

  if (!open) return null;

  const patch = (partial) => setState((prev) => ({ ...prev, ...partial }));

  const validateFileClientSide = (file) => {
    if (!ALLOWED_EXTENSIONS.includes(fileExtension(file.name))) {
      return "Only CSV and XLSX files are supported";
    }
    if (file.size === 0) {
      return "The file is empty";
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return "File exceeds 5MB limit";
    }
    return null;
  };

  const handleFile = async (file) => {
    if (!file) return;
    const clientError = validateFileClientSide(file);
    patch({
      selectedFile: { name: file.name, size: file.size },
      uploadError: clientError || "",
      uploading: !clientError
    });
    if (clientError) return;

    try {
      const result = await clientsApi.previewImport(file);
      const rows = (result.rows || []).map((row) => ({ ...row }));
      setState((prev) => ({
        ...prev,
        uploading: false,
        previewData: result,
        rows,
        view: "preview"
      }));
      setReadyCollapsed(rows.filter((r) => r.status === "valid").length > 10);
    } catch (error) {
      patch({ uploading: false, uploadError: parseApiError(error, "Unable to process file") });
    }
  };

  const onDrop = (event) => {
    event.preventDefault();
    patch({ dragActive: false });
    const file = event.dataTransfer.files?.[0];
    handleFile(file);
  };

  const onBrowseChange = (event) => {
    const file = event.target.files?.[0];
    handleFile(file);
    event.target.value = "";
  };

  const startEditGstin = (row) => {
    patch({ editingRowNumber: row.rowNumber, editValue: row.data.gstin || "" });
  };

  const cancelEditGstin = () => patch({ editingRowNumber: null, editValue: "" });

  const saveEditGstin = (rowNumber) => {
    setState((prev) => {
      const otherGstins = new Set(
        prev.rows
          .filter((r) => r.rowNumber !== rowNumber && r.data.gstin)
          .map((r) => r.data.gstin)
      );
      const { gstin, issue } = revalidateGstinLocally(prev.editValue, otherGstins);

      const rows = prev.rows.map((row) => {
        if (row.rowNumber !== rowNumber) return row;
        const nonGstinIssues = row.issues.filter(
          (existingIssue) =>
            existingIssue !== "Invalid GSTIN format" && existingIssue !== "Duplicate GSTIN in this file"
        );
        const issues = issue ? [...nonGstinIssues, issue] : nonGstinIssues;
        return {
          ...row,
          data: { ...row.data, gstin },
          issues,
          status: classifyIssues(issues)
        };
      });

      return { ...prev, rows, editingRowNumber: null, editValue: "" };
    });
  };

  const goBackToUpload = () => {
    setState(initialState);
  };

  const summary = state.rows.reduce(
    (acc, row) => {
      acc[row.status] = (acc[row.status] || 0) + 1;
      return acc;
    },
    { valid: 0, warning: 0, error: 0 }
  );

  const importableCount = summary.valid + summary.warning;

  const onConfirmImport = async () => {
    patch({ confirmLoading: true, confirmError: "" });
    const rowsToSend = state.rows
      .filter((row) => row.status === "valid" || row.status === "warning")
      .map((row) => ({ data: row.data }));
    try {
      const result = await clientsApi.confirmImport(rowsToSend);
      setState((prev) => ({ ...prev, confirmLoading: false, view: "success", successResult: result }));
    } catch (error) {
      patch({ confirmLoading: false, confirmError: parseApiError(error, "Unable to import clients") });
    }
  };

  const onViewAllClients = () => {
    onImported?.();
    onClose();
  };

  const validRows = state.rows.filter((r) => r.status === "valid");
  const warningRows = state.rows.filter((r) => r.status === "warning");
  const errorRows = state.rows.filter((r) => r.status === "error");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-sm p-4">
      <div className="panel flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-[#eadfcf] px-6 py-5">
          <div>
            <h3 className="text-lg font-bold text-ink-900">
              {state.view === "upload" && "Import Clients"}
              {state.view === "preview" && "Review Import"}
              {state.view === "success" && "Import Complete"}
            </h3>
            {state.view === "upload" && (
              <p className="mt-1 text-sm text-[#66778f]">
                Upload a CSV or Excel file to import multiple clients at once.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-ink-500 transition-colors hover:bg-sand-100 hover:text-ink-900"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {state.view === "upload" && (
            <div>
              <div className="rounded-lg border border-[#e7dcc8] bg-sand-50 px-4 py-3 text-sm">
                <span className="font-semibold text-ink-900">Don&apos;t have a template? </span>
                <button
                  type="button"
                  className="btn-secondary ml-2 px-3 py-1.5 text-xs"
                  onClick={async () => {
                    try {
                      await clientsApi.downloadImportTemplate();
                    } catch (error) {
                      patch({ uploadError: parseApiError(error, "Unable to download template") });
                    }
                  }}
                >
                  Download Template
                </button>
              </div>

              <label
                className={`mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
                  state.dragActive ? "border-ink-700 bg-sand-100" : "border-[#d9c9a8] bg-white"
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  patch({ dragActive: true });
                }}
                onDragLeave={() => patch({ dragActive: false })}
                onDrop={onDrop}
              >
                <span className="text-ink-400">
                  <UploadIcon />
                </span>
                <span className="text-sm font-semibold text-ink-900">Drag your CSV or Excel file here</span>
                <span className="text-xs text-ink-500">or click to browse</span>
                <span className="text-xs text-ink-400">CSV or XLSX · Maximum 500 clients · 5MB limit</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx"
                  className="hidden"
                  onChange={onBrowseChange}
                />
              </label>

              {state.selectedFile && (
                <div className="mt-4 flex items-center gap-3 rounded-lg border border-[#e7dcc8] bg-white px-4 py-3 text-sm">
                  <span className="flex-1 truncate font-medium text-ink-900">{state.selectedFile.name}</span>
                  <span className="text-xs text-ink-400">{formatFileSize(state.selectedFile.size)}</span>
                  {state.uploading && (
                    <span className="h-4 w-4 flex-shrink-0 animate-spin rounded-full border-2 border-ink-300 border-t-ink-800" />
                  )}
                </div>
              )}

              {state.uploadError && (
                <div className="mt-3 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {state.uploadError}
                </div>
              )}
            </div>
          )}

          {state.view === "preview" && (
            <div>
              <div className="mb-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  {summary.valid} Ready
                </span>
                <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                  {summary.warning} Warnings
                </span>
                <span className="rounded-full border border-rose-300 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                  {summary.error} Errors
                </span>
              </div>

              {validRows.length > 0 && (
                <div className="mb-4 overflow-hidden rounded-lg border border-emerald-200">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between bg-emerald-50 px-4 py-2 text-left text-sm font-semibold text-emerald-800"
                    onClick={() => setReadyCollapsed((prev) => !prev)}
                  >
                    Ready to import ({validRows.length})
                    <ChevronIcon open={!readyCollapsed} />
                  </button>
                  {!readyCollapsed && (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="border-b border-emerald-100 text-left text-xs uppercase text-emerald-700/70">
                            <th className="px-4 py-2">Name</th>
                            <th className="px-4 py-2">GSTIN</th>
                            <th className="px-4 py-2">Email</th>
                            <th className="px-4 py-2">Phone</th>
                          </tr>
                        </thead>
                        <tbody>
                          {validRows.slice(0, 50).map((row) => (
                            <tr key={row.rowNumber} className="border-b border-emerald-50 last:border-0">
                              <td className="px-4 py-2 font-medium text-ink-900">{row.data.clientName}</td>
                              <td className="px-4 py-2 font-mono text-xs text-ink-500">{row.data.gstin || "-"}</td>
                              <td className="px-4 py-2 text-ink-600">{row.data.email || "-"}</td>
                              <td className="px-4 py-2 text-ink-600">{row.data.phone || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {validRows.length > 50 && (
                        <p className="bg-emerald-50/50 px-4 py-2 text-xs text-emerald-700">
                          and {validRows.length - 50} more...
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {warningRows.length > 0 && (
                <div className="mb-4 overflow-hidden rounded-lg border border-amber-200">
                  <div className="bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800">
                    Warnings ({warningRows.length}) — these will be imported but have issues:
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-amber-100 text-left text-xs uppercase text-amber-700/70">
                          <th className="px-4 py-2">Name</th>
                          <th className="px-4 py-2">GSTIN</th>
                          <th className="px-4 py-2">Issue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {warningRows.map((row) => (
                          <tr key={row.rowNumber} className="border-b border-amber-50 last:border-0">
                            <td className="px-4 py-2 font-medium text-ink-900">{row.data.clientName}</td>
                            <td className="px-4 py-2 font-mono text-xs text-ink-500">{row.data.gstin || "-"}</td>
                            <td className="px-4 py-2 text-amber-700">{row.issues.join("; ")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {errorRows.length > 0 && (
                <div className="mb-4 overflow-hidden rounded-lg border border-rose-200">
                  <div className="bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-800">
                    Errors ({errorRows.length}) — these will NOT be imported:
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-rose-100 text-left text-xs uppercase text-rose-700/70">
                          <th className="px-4 py-2">Row</th>
                          <th className="px-4 py-2">Name</th>
                          <th className="px-4 py-2">GSTIN</th>
                          <th className="px-4 py-2">Error</th>
                        </tr>
                      </thead>
                      <tbody>
                        {errorRows.map((row) => (
                          <tr key={row.rowNumber} className="border-b border-rose-50 last:border-0">
                            <td className="px-4 py-2 text-ink-500">{row.rowNumber}</td>
                            <td className="px-4 py-2 font-medium text-ink-900">{row.data.clientName || "-"}</td>
                            <td className="px-4 py-2">
                              {state.editingRowNumber === row.rowNumber ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    autoFocus
                                    className="field w-32 px-2 py-1 font-mono text-xs uppercase"
                                    value={state.editValue}
                                    maxLength={15}
                                    onChange={(e) => patch({ editValue: e.target.value.toUpperCase() })}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") saveEditGstin(row.rowNumber);
                                      if (e.key === "Escape") cancelEditGstin();
                                    }}
                                  />
                                  <button
                                    type="button"
                                    className="text-xs font-semibold text-emerald-700"
                                    onClick={() => saveEditGstin(row.rowNumber)}
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    className="text-xs text-ink-400"
                                    onClick={cancelEditGstin}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  className="flex items-center gap-1.5 font-mono text-xs text-ink-500 hover:text-ink-900"
                                  onClick={() => startEditGstin(row)}
                                >
                                  {row.data.gstin || "-"}
                                  <EditIcon />
                                </button>
                              )}
                            </td>
                            <td className="px-4 py-2 text-rose-700">{row.issues.join("; ")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {state.confirmError && (
                <div className="mb-4 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {state.confirmError}
                </div>
              )}
            </div>
          )}

          {state.view === "success" && (
            <div className="flex flex-col items-center py-8 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckIcon />
              </span>
              <h4 className="mt-4 text-lg font-bold text-ink-900">Import Complete</h4>
              <p className="mt-1 text-sm text-ink-600">
                {state.successResult?.imported || 0} client{state.successResult?.imported === 1 ? "" : "s"} imported
                successfully
              </p>
              {state.successResult?.skipped > 0 && (
                <p className="mt-1 text-sm text-ink-500">
                  {state.successResult.skipped} client{state.successResult.skipped === 1 ? "" : "s"} already existed
                  and were skipped
                </p>
              )}
              <button type="button" className="btn-primary mt-6" onClick={onViewAllClients}>
                View All Clients
              </button>
            </div>
          )}
        </div>

        {state.view === "preview" && (
          <div className="border-t border-[#eadfcf] px-6 py-4">
            <div className="flex items-center justify-between gap-3">
              <button type="button" className="btn-secondary" onClick={goBackToUpload}>
                ← Back
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={importableCount === 0 || state.confirmLoading}
                onClick={onConfirmImport}
              >
                {state.confirmLoading ? "Importing..." : `Import ${importableCount} Clients`}
              </button>
            </div>
            {importableCount === 0 ? (
              <p className="mt-2 text-right text-xs text-rose-600">Fix errors above to import</p>
            ) : errorRows.length > 0 ? (
              <p className="mt-2 text-right text-xs text-ink-500">
                {errorRows.length} client{errorRows.length === 1 ? "" : "s"} with errors will be skipped.
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientImportModal;
