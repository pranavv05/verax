import { useRef, useState } from "react";
import AppShell from "../components/layout/AppShell";
import { API_BASE_URL } from "../lib/api-client";
import { tokenStore } from "../lib/token-store";
import { parseApiError } from "../lib/utils";

const ToolsPage = () => {
  const [file, setFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const fileInputRef = useRef(null);

  const onFileChange = (event) => {
    const selected = event.target.files?.[0] || null;
    if (selected && !selected.name.match(/\.(xlsx|xls)$/i)) {
      setError("Only .xlsx and .xls files are supported.");
      setFile(null);
      return;
    }
    setError("");
    setFile(selected);
  };

  const onClean = async () => {
    if (!file) {
      setError("Please choose an Excel file first.");
      return;
    }
    setProcessing(true);
    setError("");
    setToast("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const token = tokenStore.getAccessToken();
      const response = await fetch(`${API_BASE_URL}/api/tools/register-clean`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
        credentials: "include"
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: "Processing failed" }));
        throw new Error(err.message || err.detail || "Processing failed");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.name.replace(/\.[^.]+$/, "") + "_cleaned.xlsx";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setToast("Register cleaned and downloaded successfully.");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (cleanError) {
      setError(cleanError.message || parseApiError(cleanError, "Unable to process the file"));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <AppShell
      title="Data Tools"
      subtitle="Standalone utilities to help clean and prepare financial data for review."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Register Cleaner */}
        <article className="panel p-6">
          <div className="mb-4 flex items-start gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/10 to-indigo-500/20 text-indigo-600">
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0118 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-3.75 0v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 8.25 6 8.754 6 9.375v1.5m0-5.25v5.25m0-5.25C6 5.004 6.504 4.5 7.125 4.5h9.75c.621 0 1.125.504 1.125 1.125m1.125 2.625h1.5m-1.5 0A1.125 1.125 0 0118 7.875v1.5m1.125-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125M18 5.625v5.25M7.125 12h9.75m-9.75 0A1.125 1.125 0 016 10.875M7.125 12C6.504 12 6 12.504 6 13.125m0-2.25C6 11.496 5.496 12 4.875 12M18 10.875c0 .621-.504 1.125-1.125 1.125M18 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m2.25-2.625H9.75m3.75 0v1.5m0-1.5a1.125 1.125 0 00-1.125-1.125H9.75m3.75 1.5V12m-3.75 0h7.5" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-ink-900">Excel Register Cleaner</h2>
              <p className="mt-1 text-sm text-ink-500">
                Upload a purchase or sales register Excel file. The tool merges multi-page tables,
                removes totals and cancelled rows, standardises dates and amounts, and returns a
                neatly formatted workbook ready for review.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div>
              <label className="label">Select Excel file (.xlsx or .xls)</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="field cursor-pointer file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-sand-100 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-ink-700 hover:file:bg-sand-200"
                onChange={onFileChange}
              />
            </div>

            {file && (
              <div className="flex items-center gap-2 rounded-lg border border-[#e7dcc8] bg-sand-50/60 px-3 py-2">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 text-ink-500">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                <span className="flex-1 truncate text-sm text-ink-700">{file.name}</span>
                <span className="text-xs text-ink-500">{(file.size / 1024).toFixed(1)} KB</span>
              </div>
            )}

            {error ? (
              <div className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</div>
            ) : null}
            {toast ? (
              <div className="rounded-lg border border-mint-300 bg-mint-500/10 px-3 py-2 text-sm font-semibold text-mint-700">{toast}</div>
            ) : null}

            <button
              type="button"
              className="btn-primary w-full"
              disabled={processing || !file}
              onClick={onClean}
            >
              {processing ? "Cleaning register..." : "Clean & Download"}
            </button>
          </div>

          <div className="mt-5 rounded-xl border border-[#e7dcc8] bg-sand-50/50 px-4 py-3">
            <p className="text-xs font-semibold text-ink-700">What this tool handles</p>
            <ul className="mt-2 space-y-1 text-xs text-ink-500">
              <li>• Multiple table blocks per sheet separated by blank rows</li>
              <li>• Split two-row or three-row column headers (merged automatically)</li>
              <li>• Skips TOTAL, subtotal, and Cancelled rows</li>
              <li>• Normalises dates and amounts (₹, commas, dash placeholders)</li>
              <li>• Adds colour-coded header and alternating rows with Grand Total</li>
            </ul>
          </div>
        </article>

        {/* Placeholder for future tools */}
        <article className="panel flex flex-col items-center justify-center p-8 text-center opacity-60">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-dashed border-[#c8bda8] bg-sand-100 text-ink-400">
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>
          <p className="mt-3 text-sm font-semibold text-ink-700">More tools coming soon</p>
          <p className="mt-2 max-w-xs text-xs text-ink-500">
            PDF bank statement extractor, GST reconciliation checker, and TDS computation sheet are on the roadmap.
          </p>
        </article>
      </div>
    </AppShell>
  );
};

export default ToolsPage;
