import { useRef, useState } from "react";
import AppShell from "../components/layout/AppShell";
import { request } from "../lib/api-client";
import { parseApiError } from "../lib/utils";
import { useAuth } from "../contexts/AuthContext";
import { isAdmin } from "../utils/permissions";
import { narrationMappingsApi } from "../api/narration-mappings-api";

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

const CheckIcon = ({ className = "h-3.5 w-3.5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
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
      const blob = await request("/api/tools/register-clean", {
        method: "POST",
        body: formData,
        responseType: "blob"
      });
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
      setError(parseApiError(err, "Unable to process the file"));
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

// ─── Narration review helpers ────────────────────────────────────────────────
const HIGH_CONFIDENCE = 0.7;
const ACCEPT_ALL_THRESHOLD = 0.75;

const buildReviewRows = (transactions, mappingResults) =>
  transactions.map((txn, index) => {
    const mapping = mappingResults[index];
    const confidence = txn.classificationConfidence ?? 0;
    let ledger;
    let matchedFromMapping = false;

    if (mapping?.matched && mapping.ledgerName) {
      ledger = mapping.ledgerName;
      matchedFromMapping = true;
    } else if (confidence > HIGH_CONFIDENCE) {
      ledger = txn.suggestedLedger || "Suspense A/c";
    } else {
      ledger = "Suspense A/c";
    }

    return {
      id: index,
      date: txn.date,
      tallyDate: txn.tallyDate,
      narration: txn.narration,
      debit: txn.debit || 0,
      credit: txn.credit || 0,
      suggestedLedger: txn.suggestedLedger || "Miscellaneous",
      confidence,
      reason: txn.classificationReason || "",
      matchedFromMapping,
      ledger,
      locked: true,
      accepted: matchedFromMapping || confidence > HIGH_CONFIDENCE
    };
  });

const formatAmount = (value) => (value ? `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—");

const confidenceTone = (confidence) => {
  if (confidence > ACCEPT_ALL_THRESHOLD) return "bg-mint-500/10 text-mint-700 border-mint-300/70";
  if (confidence > HIGH_CONFIDENCE) return "bg-amber-500/10 text-amber-700 border-amber-300/70";
  return "bg-rose-500/10 text-rose-700 border-rose-300/70";
};

// ─── Bank Statement → Tally XML upload card ─────────────────────────────────
const BankStatementXmlCard = ({ companyName, setCompanyName, bankLedger, setBankLedger, canAdmin, onProcessed }) => {
  const [file, setFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [warnings, setWarnings] = useState([]);
  const [skippedRows, setSkippedRows] = useState(0);
  const [hasResult, setHasResult] = useState(false);
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
      const params = new URLSearchParams();
      if (companyName.trim()) params.set("company_name", companyName.trim());
      if (bankLedger.trim())  params.set("bank_ledger",  bankLedger.trim());
      const result = await request(`/api/tools/bank-statement-xml?${params}`, {
        method: "POST",
        body: formData
      });

      const transactions = result.transactions || [];
      let mappingResults = transactions.map(() => ({ matched: false, ledgerName: null }));
      if (canAdmin && transactions.length > 0) {
        try {
          const applied = await narrationMappingsApi.apply(transactions.map((t) => t.narration));
          mappingResults = applied.transactions || mappingResults;
        } catch {
          // Saved-mapping lookup is a convenience, not a requirement — fall back to AI suggestions.
        }
      }

      const rows = buildReviewRows(transactions, mappingResults);
      const matched = rows.filter((row) => row.matchedFromMapping).length;
      setWarnings(result.warnings || []);
      setSkippedRows(result.skippedRows || 0);
      setToast(`Parsed ${rows.length} transaction${rows.length === 1 ? "" : "s"}${result.isScanned ? " from OCR" : ""}. Review the suggested ledgers below before exporting.`);
      setHasResult(true);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      onProcessed(rows, matched);
    } catch (err) {
      setError(parseApiError(err, "Unable to convert the file"));
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
            Upload a bank statement PDF. Transactions are extracted directly from the PDF's table
            structure, then each narration is classified into a likely ledger for you to review.
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
          {processing ? "Processing..." : "Process Statement"}
        </button>
      </div>

      {!hasResult && (
        <div className="mt-5 rounded-xl border border-[#e7dcc8] bg-sand-50/50 px-4 py-3">
          <p className="text-xs font-semibold text-ink-700">How it works</p>
          <ul className="mt-2 space-y-1 text-xs text-ink-500">
            <li>• Uses <span className="font-semibold text-ink-700">pdfplumber</span> table extraction — no LLM, no hallucinations on figures</li>
            <li>• Auto-detects Date, Narration, Withdrawal, and Deposit columns</li>
            <li>• Groq classifies each narration into a likely ledger category before you export</li>
            <li>• Review and correct suggestions below, then export the final Tally XML with real ledger names</li>
            <li>• Import the XML via <span className="font-semibold text-ink-700">Gateway of Tally → Import → Vouchers</span></li>
          </ul>
        </div>
      )}
      {hasResult && (
        <p className="mt-5 text-xs text-ink-500">
          Results are shown in the full-width review panel below.
        </p>
      )}
    </article>
  );
};

// ─── Full-width review panel (rendered below the two tool cards) ───────────
const BankReviewPanel = ({ rows, setRows, matchedCount, companyName, bankLedger, canAdmin }) => {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const needsReview = rows.length - matchedCount;

  const setRow = (id, updates) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...updates } : row)));
  };

  const rememberMapping = async (row) => {
    if (!canAdmin || !row.narration) return;
    try {
      await narrationMappingsApi.create({
        narrationPattern: row.narration.slice(0, 20),
        ledgerName: row.ledger,
        matchType: "contains"
      });
    } catch (err) {
      setError(parseApiError(err, "Could not save this mapping"));
    }
  };

  const onAccept = (row) => setRow(row.id, { ledger: row.suggestedLedger, accepted: true, locked: true });
  const onEdit = (row) => setRow(row.id, { locked: false });
  const onLedgerChange = (row, value) => setRow(row.id, { ledger: value });
  const onLedgerBlur = async (row) => {
    setRow(row.id, { locked: true, accepted: row.ledger === row.suggestedLedger });
    await rememberMapping(row);
  };
  const onRemember = async (row) => {
    await rememberMapping(row);
    setToast(`Saved: "${row.narration.slice(0, 20)}..." → ${row.ledger}`);
  };

  const onAcceptAllHighConfidence = () => {
    setRows((prev) =>
      prev.map((row) =>
        !row.matchedFromMapping && row.confidence > ACCEPT_ALL_THRESHOLD
          ? { ...row, ledger: row.suggestedLedger, accepted: true, locked: true }
          : row
      )
    );
  };

  const onExport = async () => {
    if (!rows || rows.length === 0) return;
    setExporting(true); setError(""); setToast("");
    try {
      const payload = rows.map((row) => ({
        narration: row.narration,
        debit: row.debit,
        credit: row.credit,
        tallyDate: row.tallyDate,
        ledgerName: row.ledger || "Suspense A/c"
      }));
      const result = await request("/api/tools/bank-statement-xml/export", {
        method: "POST",
        body: { transactions: payload, companyName: companyName.trim(), bankLedger: bankLedger.trim() }
      });
      const blob = new Blob([result.xml || ""], { type: "text/xml" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "bank-statement-tally.xml";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setToast(`Final XML exported with ${result.voucherCount || 0} voucher${result.voucherCount === 1 ? "" : "s"} using your reviewed ledgers.`);
    } catch (err) {
      setError(parseApiError(err, "Unable to export the file"));
    } finally {
      setExporting(false);
    }
  };

  return (
    <article className="panel mt-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-ink-900">Review AI Suggestions</h2>
          <p className="mt-1 text-sm text-ink-500">
            Confirm or correct the ledger for each transaction below, then export the final Tally XML.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-secondary text-xs" onClick={onAcceptAllHighConfidence}>
            Accept all high-confidence (&gt;75%)
          </button>
          <button type="button" className="btn-primary text-xs" disabled={exporting} onClick={onExport}>
            {exporting ? "Exporting…" : `Export to Tally (${rows.length})`}
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-mint-300/70 bg-mint-500/10 px-3 py-1 text-xs font-semibold text-mint-700">
          <CheckIcon />
          {matchedCount} matched from saved mappings
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/70 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700">
          {needsReview} need review
        </span>
        {!canAdmin && (
          <span className="inline-flex items-center rounded-full border border-[#e7dcc8] bg-sand-50 px-3 py-1 text-xs text-ink-500">
            Staff view — saved-mapping lookup and "Remember" require an admin role
          </span>
        )}
      </div>

      {error && <div className="mt-3 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</div>}
      {toast && <div className="mt-3 rounded-lg border border-mint-300 bg-mint-500/10 px-3 py-2 text-sm font-semibold text-mint-700">{toast}</div>}

      <div className="mt-4 max-h-[70vh] overflow-auto rounded-xl border border-[#e7dcc8]">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-sand-100">
            <tr className="text-[11px] uppercase tracking-wide text-ink-600">
              <th className="whitespace-nowrap px-4 py-3 text-left font-semibold">Date</th>
              <th className="px-4 py-3 text-left font-semibold">Narration</th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">Amount</th>
              <th className="whitespace-nowrap px-4 py-3 text-left font-semibold">Type</th>
              <th className="px-4 py-3 text-left font-semibold">AI suggestion</th>
              <th className="px-4 py-3 text-left font-semibold">Your ledger</th>
              <th className="whitespace-nowrap px-4 py-3 text-left font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#efe7d8]">
            {rows.map((row, i) => (
              <tr
                key={row.id}
                className={`${row.matchedFromMapping ? "bg-mint-500/5" : i % 2 === 1 ? "bg-sand-50/50" : "bg-white"} transition-colors hover:bg-indigo-500/5`}
              >
                <td className="whitespace-nowrap px-4 py-3 align-top text-ink-600">{row.date}</td>
                <td className="px-4 py-3 align-top text-ink-700">
                  <p className="max-w-md break-words" title={row.narration}>{row.narration}</p>
                </td>
                <td className="whitespace-nowrap px-4 py-3 align-top text-right font-mono tabular-nums text-ink-800">
                  {formatAmount(row.debit || row.credit)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 align-top">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${row.credit > 0 ? "bg-mint-500/10 text-mint-700" : "bg-rose-500/10 text-rose-700"}`}>
                    {row.credit > 0 ? "Credit" : "Debit"}
                  </span>
                </td>
                <td className="px-4 py-3 align-top">
                  {row.matchedFromMapping ? (
                    <span className="text-xs italic text-ink-400">saved mapping</span>
                  ) : (
                    <div className="flex flex-wrap items-center gap-1.5" title={row.reason}>
                      <span className="text-ink-700">{row.suggestedLedger}</span>
                      <span className={`inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${confidenceTone(row.confidence)}`}>
                        {Math.round(row.confidence * 100)}%
                      </span>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="relative">
                    <input
                      type="text"
                      className={`field !py-1.5 !pr-7 !text-xs w-full min-w-[150px] ${row.locked ? "bg-sand-50/70" : "bg-white"}`}
                      value={row.ledger}
                      readOnly={row.locked}
                      onChange={(e) => onLedgerChange(row, e.target.value)}
                      onBlur={() => !row.locked && onLedgerBlur(row)}
                    />
                    {row.accepted && (
                      <CheckIcon className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-mint-600" />
                    )}
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 align-top">
                  <div className="flex gap-1.5">
                    <button type="button" className="rounded-md border border-mint-300 px-2.5 py-1 text-[11px] font-semibold text-mint-700 hover:bg-mint-500/10" onClick={() => onAccept(row)}>
                      Accept
                    </button>
                    <button type="button" className="rounded-md border border-indigo-300 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-500/10" onClick={() => onEdit(row)}>
                      Edit
                    </button>
                    {canAdmin && (
                      <button type="button" className="rounded-md border border-amber-300 px-2.5 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-500/10" onClick={() => onRemember(row)}>
                        Remember
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
};

// ─── Page ────────────────────────────────────────────────────────────────────
const ToolsPage = () => {
  const { user } = useAuth();
  const canAdmin = isAdmin(user);

  const [companyName, setCompanyName] = useState("My Company");
  const [bankLedger, setBankLedger] = useState("Bank Account");
  const [reviewRows, setReviewRows] = useState(null);
  const [matchedCount, setMatchedCount] = useState(0);

  return (
    <AppShell
      title="Data Tools"
      subtitle="Standalone utilities to help clean and prepare financial data for review."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <RegisterCleanerCard />
        <BankStatementXmlCard
          companyName={companyName}
          setCompanyName={setCompanyName}
          bankLedger={bankLedger}
          setBankLedger={setBankLedger}
          canAdmin={canAdmin}
          onProcessed={(rows, matched) => { setReviewRows(rows); setMatchedCount(matched); }}
        />
      </div>

      {reviewRows && (
        <BankReviewPanel
          rows={reviewRows}
          setRows={setReviewRows}
          matchedCount={matchedCount}
          companyName={companyName}
          bankLedger={bankLedger}
          canAdmin={canAdmin}
        />
      )}
    </AppShell>
  );
};

export default ToolsPage;
