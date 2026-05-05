import { useRef, useState } from "react";
import AppShell from "../components/layout/AppShell";
import { API_BASE_URL } from "../lib/api-client";
import { tokenStore } from "../lib/token-store";
import { parseApiError } from "../lib/utils";

// ─── Shared file-info row ───────────────────────────────────────────────────
const FileInfo = ({ file }) => (
  <div className="flex items-center gap-2 rounded-lg border border-[#e7dcc8] bg-sand-50/60 px-3 py-2">
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 text-ink-500">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
    <span className="flex-1 truncate text-sm text-ink-700">{file.name}</span>
    <span className="text-xs text-ink-500">{(file.size / 1024).toFixed(1)} KB</span>
  </div>
);

// ─── Register Cleaner card ───────────────────────────────────────────────────
const RegisterCleanerCard = () => {
  const [file, setFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const fileInputRef = useRef(null);

  const onFileChange = (e) => {
    const selected = e.target.files?.[0] || null;
    if (selected && !selected.name.match(/\.(xlsx|xls)$/i)) {
      setError("Only .xlsx and .xls files are supported.");
      setFile(null);
      return;
    }
    setError("");
    setFile(selected);
  };

  const onClean = async () => {
    if (!file) { setError("Please choose an Excel file first."); return; }
    setProcessing(true); setError(""); setToast("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const token = tokenStore.getAccessToken();
      const response = await fetch(`${API_BASE_URL}/api/tools/register-clean`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
        credentials: "include",
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
    } catch (err) {
      setError(err.message || parseApiError(err, "Unable to process the file"));
    } finally {
      setProcessing(false);
    }
  };

  return (
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
            Excel Register Cleaner — cleans and standardizes your purchase register Excel file.
            Downloads as formatted .xlsx.
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

        {file && <FileInfo file={file} />}

        {error && <div className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</div>}
        {toast && <div className="rounded-lg border border-mint-300 bg-mint-500/10 px-3 py-2 text-sm font-semibold text-mint-700">{toast}</div>}

        <button type="button" className="btn-primary w-full" disabled={processing || !file} onClick={onClean}>
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
  );
};

// ─── Bank Statement → Tally XML card ────────────────────────────────────────
const BankStatementXmlCard = () => {
  const [file, setFile] = useState(null);
  const [companyName, setCompanyName] = useState("My Company");
  const [bankLedger, setBankLedger] = useState("Bank Account");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [warnings, setWarnings] = useState([]);
  const [skippedRows, setSkippedRows] = useState(0);
  const fileInputRef = useRef(null);

  const onFileChange = (e) => {
    const selected = e.target.files?.[0] || null;
    if (selected && !selected.name.match(/\.pdf$/i)) {
      setError("Only PDF files are supported.");
      setFile(null);
      return;
    }
    setError("");
    setFile(selected);
  };

  const onConvert = async () => {
    if (!file) { setError("Please choose a PDF file first."); return; }
    setProcessing(true); setError(""); setToast(""); setWarnings([]); setSkippedRows(0);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const token = tokenStore.getAccessToken();
      const params = new URLSearchParams();
      if (companyName.trim()) params.set("company_name", companyName.trim());
      if (bankLedger.trim())  params.set("bank_ledger",  bankLedger.trim());
      const response = await fetch(
        `${API_BASE_URL}/api/tools/bank-statement-xml?${params}`,
        {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
          credentials: "include",
        }
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: "Conversion failed" }));
        throw new Error(err.message || err.detail || "Conversion failed");
      }
      const result = await response.json();
      const blob = new Blob([result.xml || ""], { type: "text/xml" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "bank-statement-tally.xml";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setWarnings(result.warnings || []);
      setSkippedRows(result.skippedRows || 0);
      setToast(`XML generated with ${result.voucherCount || 0} voucher${result.voucherCount === 1 ? "" : "s"}${result.isScanned ? " from OCR" : ""}.`);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setError(err.message || parseApiError(err, "Unable to convert the file"));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <article className="panel p-6">
      <div className="mb-4 flex items-start gap-4">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-mint-500/10 to-mint-500/20 text-mint-700">
          <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-bold text-ink-900">Bank Statement → Tally XML</h2>
          <p className="mt-1 text-sm text-ink-500">
            Upload a bank statement PDF. The tool uses direct table extraction (no AI) to identify
            transactions and generates a TallyPrime-compatible XML of Payment and Receipt vouchers.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Company name in Tally</label>
            <input
              type="text"
              className="field"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="My Company"
            />
          </div>
          <div>
            <label className="label">Bank ledger name in Tally</label>
            <input
              type="text"
              className="field"
              value={bankLedger}
              onChange={(e) => setBankLedger(e.target.value)}
              placeholder="Bank Account"
            />
          </div>
        </div>

        <div>
          <label className="label">Select bank statement PDF</label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="field cursor-pointer file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-sand-100 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-ink-700 hover:file:bg-sand-200"
            onChange={onFileChange}
          />
        </div>

        {file && <FileInfo file={file} />}

        {error && <div className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</div>}
        {toast && <div className="rounded-lg border border-mint-300 bg-mint-500/10 px-3 py-2 text-sm font-semibold text-mint-700">{toast}</div>}
        {warnings.length > 0 && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <p className="font-semibold">{warnings.length} rows had data conflicts. Review the warnings below.</p>
            <details className="mt-2">
              <summary className="cursor-pointer font-semibold">Show warning rows</summary>
              <ul className="mt-2 space-y-1 text-xs">
                {warnings.map((warning, index) => (
                  <li key={`${warning.row || "row"}-${index}`}>
                    Row {warning.row || "?"}: {warning.issue}
                    {warning.originalDebit !== undefined && warning.originalCredit !== undefined
                      ? ` (debit ${warning.originalDebit}, credit ${warning.originalCredit})`
                      : ""}
                  </li>
                ))}
              </ul>
            </details>
          </div>
        )}
        {skippedRows > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs font-semibold text-amber-800">
            {skippedRows} summary or invalid row{skippedRows === 1 ? "" : "s"} skipped.
          </div>
        )}

        <button type="button" className="btn-primary w-full" disabled={processing || !file} onClick={onConvert}>
          {processing ? "Converting..." : "Convert & Download XML"}
        </button>
      </div>

      <div className="mt-5 rounded-xl border border-[#e7dcc8] bg-sand-50/50 px-4 py-3">
        <p className="text-xs font-semibold text-ink-700">How it works</p>
        <ul className="mt-2 space-y-1 text-xs text-ink-500">
          <li>• Uses <span className="font-semibold text-ink-700">pdfplumber</span> table extraction — no LLM, no hallucinations on figures</li>
          <li>• Auto-detects Date, Narration, Withdrawal, and Deposit columns</li>
          <li>• Deposits become <span className="font-semibold text-ink-700">Receipt</span> vouchers; withdrawals become <span className="font-semibold text-ink-700">Payment</span> vouchers</li>
          <li>• Counterpart ledger set to "Suspense A/c" — reassign in Tally after import</li>
          <li>• Import the XML via <span className="font-semibold text-ink-700">Gateway of Tally → Import → Vouchers</span></li>
        </ul>
      </div>
    </article>
  );
};

// ─── Page ────────────────────────────────────────────────────────────────────
const ToolsPage = () => (
  <AppShell
    title="Data Tools"
    subtitle="Standalone utilities to help clean and prepare financial data for review."
  >
    <div className="grid gap-6 lg:grid-cols-2">
      <RegisterCleanerCard />
      <BankStatementXmlCard />
    </div>
  </AppShell>
);

export default ToolsPage;
