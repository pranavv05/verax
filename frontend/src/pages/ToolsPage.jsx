import { useRef, useState } from "react";
import AppShell from "../components/layout/AppShell";
import { Alert, Badge, Card, CardHeader, FormField, PageHeader } from "../components/app/primitives";
import { TableScroll } from "../components/app/TableKit";
import { IconBank, IconCheck, IconClose, IconEdit, IconExport, IconFile, IconSpark, IconTable, IconUpload } from "../components/app/icons";
import { request } from "../lib/api-client";
import { cn, parseApiError } from "../lib/utils";
import { useAuth } from "../contexts/AuthContext";
import { isAdmin } from "../utils/permissions";
import { narrationMappingsApi } from "../api/narration-mappings-api";

// ─── Shared file picker ─────────────────────────────────────────────────────
/**
 * Drop zone + chosen-file row. `inputRef` lets the parent clear the native
 * input after a successful run.
 */
const FilePicker = ({ file, onFile, onClear, accept, hint, inputRef, id }) => {
  const [dragActive, setDragActive] = useState(false);

  if (file) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-ui-line bg-ui-subtle px-3 py-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-ui-line bg-ui-surface text-ui-fg-3">
          <IconFile size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.8125rem] font-medium text-ui-fg">{file.name}</p>
          <p className="text-xs text-ui-fg-3">{(file.size / 1024).toFixed(1)} KB</p>
        </div>
        <button type="button" className="btn-icon h-7 w-7" aria-label="Remove file" onClick={onClear}>
          <IconClose size={13} />
        </button>
      </div>
    );
  }

  return (
    <label
      htmlFor={id}
      onDragOver={(event) => {
        event.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragActive(false);
        onFile(event.dataTransfer.files?.[0] || null);
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed px-4 py-7 text-center transition-colors",
        dragActive ? "border-ui-accent bg-ui-accent/[0.06]" : "border-ui-line-strong bg-ui-subtle hover:border-ui-accent/50"
      )}
    >
      <IconUpload size={18} className="text-ui-fg-3" />
      <span className="text-[0.8125rem] font-medium text-ui-fg">Drop a file, or click to browse</span>
      <span className="text-xs text-ui-fg-3">{hint}</span>
      <input
        id={id}
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(event) => onFile(event.target.files?.[0] || null)}
      />
    </label>
  );
};

const HowItWorks = ({ items }) => (
  <ul className="space-y-2 text-[0.8125rem] text-ui-fg-3">
    {items.map((item, index) => (
      <li key={index} className="flex gap-2.5">
        <IconCheck size={14} className="mt-0.5 text-ui-ok" />
        <span>{item}</span>
      </li>
    ))}
  </ul>
);

// ─── Register Cleaner card ───────────────────────────────────────────────────
const RegisterCleanerCard = () => {
  const [file, setFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const fileInputRef = useRef(null);

  const onFile = (selected) => {
    if (selected && !selected.name.match(/\.(xlsx|xls)$/i)) {
      setError("Only .xlsx and .xls files are supported.");
      setFile(null);
      return;
    }
    setError("");
    setFile(selected);
  };

  const onClear = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
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
      setToast("Register cleaned and downloaded.");
      onClear();
    } catch (err) {
      setError(parseApiError(err, "Unable to process the file"));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Card className="flex flex-col">
      <CardHeader
        icon={<IconTable size={14} />}
        title="Excel register cleaner"
        description="Cleans and standardises a messy purchase register. Downloads as a formatted .xlsx."
      />
      <div className="flex flex-1 flex-col gap-4 px-5 py-5">
        <FilePicker
          id="register-file"
          file={file}
          onFile={onFile}
          onClear={onClear}
          accept=".xlsx,.xls"
          hint=".xlsx or .xls"
          inputRef={fileInputRef}
        />
        {error ? <Alert tone="err">{error}</Alert> : null}
        {toast ? <Alert tone="ok">{toast}</Alert> : null}
        <button type="button" className="btn-primary w-full" disabled={processing || !file} onClick={onClean}>
          <IconExport size={14} />
          {processing ? "Cleaning register…" : "Clean and download"}
        </button>
        <div className="mt-auto border-t border-ui-line pt-4">
          <HowItWorks
            items={[
              "Multiple table blocks per sheet, separated by blank rows",
              "Two- and three-row headers merged automatically",
              "TOTAL, subtotal and cancelled rows skipped",
              "Dates and amounts normalised (₹, commas, dash placeholders)",
              "Colour-coded header, alternating rows and a grand total"
            ]}
          />
        </div>
      </div>
    </Card>
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

const formatAmount = (value) =>
  value ? `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—";

const confidenceTone = (confidence) => {
  if (confidence > ACCEPT_ALL_THRESHOLD) return "ok";
  if (confidence > HIGH_CONFIDENCE) return "warn";
  return "err";
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

  const onFile = (selected) => {
    if (selected && !selected.name.match(/\.pdf$/i)) {
      setError("Only PDF files are supported.");
      setFile(null);
      return;
    }
    setError("");
    setFile(selected);
  };

  const onClear = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onConvert = async () => {
    if (!file) {
      setError("Please choose a PDF file first.");
      return;
    }
    setProcessing(true);
    setError("");
    setToast("");
    setWarnings([]);
    setSkippedRows(0);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const params = new URLSearchParams();
      if (companyName.trim()) params.set("company_name", companyName.trim());
      if (bankLedger.trim()) params.set("bank_ledger", bankLedger.trim());
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
      setToast(
        `Parsed ${rows.length} transaction${rows.length === 1 ? "" : "s"}${result.isScanned ? " from OCR" : ""}. Review the suggested ledgers below before exporting.`
      );
      setHasResult(true);
      onClear();
      onProcessed(rows, matched);
    } catch (err) {
      setError(parseApiError(err, "Unable to convert the file"));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Card className="flex flex-col">
      <CardHeader
        icon={<IconBank size={14} />}
        title="Bank statement to Tally XML"
        description="Reads the statement's own tables, then suggests a ledger for every narration for you to confirm."
      />
      <div className="flex flex-1 flex-col gap-4 px-5 py-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Company name in Tally" htmlFor="tally-company">
            <input
              id="tally-company"
              type="text"
              className="field"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="My Company"
            />
          </FormField>
          <FormField label="Bank ledger in Tally" htmlFor="tally-bank-ledger">
            <input
              id="tally-bank-ledger"
              type="text"
              className="field"
              value={bankLedger}
              onChange={(e) => setBankLedger(e.target.value)}
              placeholder="Bank Account"
            />
          </FormField>
        </div>

        <FilePicker
          id="statement-file"
          file={file}
          onFile={onFile}
          onClear={onClear}
          accept=".pdf"
          hint="Bank statement PDF"
          inputRef={fileInputRef}
        />

        {error ? <Alert tone="err">{error}</Alert> : null}
        {toast ? <Alert tone="ok">{toast}</Alert> : null}
        {warnings.length > 0 ? (
          <Alert tone="warn" title={`${warnings.length} rows had data conflicts`}>
            <details>
              <summary className="cursor-pointer font-medium text-ui-warn">Show warning rows</summary>
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
          </Alert>
        ) : null}
        {skippedRows > 0 ? (
          <p className="text-xs text-ui-fg-3">
            {skippedRows} summary or invalid row{skippedRows === 1 ? "" : "s"} skipped.
          </p>
        ) : null}

        <button type="button" className="btn-primary w-full" disabled={processing || !file} onClick={onConvert}>
          <IconSpark size={14} />
          {processing ? "Processing…" : "Process statement"}
        </button>

        <div className="mt-auto border-t border-ui-line pt-4">
          {hasResult ? (
            <p className="text-[0.8125rem] text-ui-fg-3">The results are in the review panel below.</p>
          ) : (
            <HowItWorks
              items={[
                <>
                  Table extraction with <span className="font-medium text-ui-fg-2">pdfplumber</span> — figures are never guessed by a model
                </>,
                "Date, narration, withdrawal and deposit columns found automatically",
                "Each narration is classified into a likely ledger before you export",
                <>
                  Import the XML via <span className="font-medium text-ui-fg-2">Gateway of Tally → Import → Vouchers</span>
                </>
              ]}
            />
          )}
        </div>
      </div>
    </Card>
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
    setToast(`Saved: "${row.narration.slice(0, 20)}…" → ${row.ledger}`);
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
    setExporting(true);
    setError("");
    setToast("");
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
      setToast(
        `Final XML exported with ${result.voucherCount || 0} voucher${result.voucherCount === 1 ? "" : "s"} using your reviewed ledgers.`
      );
    } catch (err) {
      setError(parseApiError(err, "Unable to export the file"));
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card className="mt-5 overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-ui-line px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-[0.9375rem] font-semibold tracking-[-0.01em] text-ui-fg">Review ledger suggestions</h2>
          <p className="mt-0.5 text-[0.8125rem] text-ui-fg-3">Confirm or correct the ledger for each transaction, then export the final Tally XML.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone="ok" dot>
              {matchedCount} from saved mappings
            </Badge>
            <Badge tone="warn" dot>
              {needsReview} to review
            </Badge>
            {!canAdmin ? <Badge>Staff view — saved mappings and “Remember” need an admin</Badge> : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-secondary" onClick={onAcceptAllHighConfidence}>
            <IconCheck size={14} />
            Accept all above 75%
          </button>
          <button type="button" className="btn-primary" disabled={exporting} onClick={onExport}>
            <IconExport size={14} />
            {exporting ? "Exporting…" : `Export ${rows.length} to Tally`}
          </button>
        </div>
      </div>

      {error || toast ? (
        <div className="space-y-2 border-b border-ui-line px-5 py-3">
          {error ? <Alert tone="err">{error}</Alert> : null}
          {toast ? <Alert tone="ok">{toast}</Alert> : null}
        </div>
      ) : null}

      <TableScroll className="max-h-[70vh] overflow-y-auto">
        <table className="ui-table [&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10">
          <thead>
            <tr>
              <th>Date</th>
              <th>Narration</th>
              <th className="text-right">Amount</th>
              <th>Suggestion</th>
              <th>Your ledger</th>
              <th className="w-44">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={cn("align-top", row.matchedFromMapping && "bg-ui-ok/[0.04]")}>
                <td className="whitespace-nowrap tabular-nums text-ui-fg-3">{row.date}</td>
                <td className="max-w-md">
                  <p className="break-words text-ui-fg-2" title={row.narration}>
                    {row.narration}
                  </p>
                </td>
                <td className="whitespace-nowrap text-right">
                  <span className={cn("font-medium tabular-nums", row.credit > 0 ? "text-ui-ok" : "text-ui-fg")}>
                    {row.credit > 0 ? "+" : "−"}
                    {formatAmount(row.debit || row.credit)}
                  </span>
                </td>
                <td>
                  {row.matchedFromMapping ? (
                    <span className="text-xs text-ui-fg-3">Saved mapping</span>
                  ) : (
                    <div className="flex flex-wrap items-center gap-1.5" title={row.reason}>
                      <span className="text-ui-fg-2">{row.suggestedLedger}</span>
                      <Badge tone={confidenceTone(row.confidence)}>{Math.round(row.confidence * 100)}%</Badge>
                    </div>
                  )}
                </td>
                <td>
                  <div className="relative">
                    <input
                      type="text"
                      aria-label={`Ledger for ${row.narration}`}
                      className={cn("field h-8 min-w-[10rem] py-1 pr-7 text-xs", row.locked && "bg-ui-subtle")}
                      value={row.ledger}
                      readOnly={row.locked}
                      onChange={(e) => onLedgerChange(row, e.target.value)}
                      onBlur={() => !row.locked && onLedgerBlur(row)}
                    />
                    {row.accepted ? (
                      <IconCheck size={13} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-ui-ok" />
                    ) : null}
                  </div>
                </td>
                <td>
                  <div className="flex justify-end gap-1">
                    <button type="button" className="btn-ghost btn-sm" onClick={() => onAccept(row)} title="Use the suggestion">
                      <IconCheck size={12} />
                      Accept
                    </button>
                    <button type="button" className="btn-icon h-7 w-7" aria-label="Edit ledger" onClick={() => onEdit(row)}>
                      <IconEdit size={13} />
                    </button>
                    {canAdmin ? (
                      <button type="button" className="btn-ghost btn-sm" onClick={() => onRemember(row)} title="Save this narration → ledger mapping">
                        Remember
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
    </Card>
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
    <AppShell>
      <PageHeader
        title="Tools."
        tint="Quick fixes for messy files."
        description="Standalone utilities for the spreadsheets and statements that arrive outside the normal flow."
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <RegisterCleanerCard />
        <BankStatementXmlCard
          companyName={companyName}
          setCompanyName={setCompanyName}
          bankLedger={bankLedger}
          setBankLedger={setBankLedger}
          canAdmin={canAdmin}
          onProcessed={(rows, matched) => {
            setReviewRows(rows);
            setMatchedCount(matched);
          }}
        />
      </div>

      {reviewRows ? (
        <BankReviewPanel
          rows={reviewRows}
          setRows={setReviewRows}
          matchedCount={matchedCount}
          companyName={companyName}
          bankLedger={bankLedger}
          canAdmin={canAdmin}
        />
      ) : null}
    </AppShell>
  );
};

export default ToolsPage;
