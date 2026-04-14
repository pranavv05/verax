import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import { ReviewSkeleton } from "../components/ui/skeletons";
import StatusBadge from "../components/ui/StatusBadge";
import { documentsApi } from "../api/documents-api";
import { extractionsApi } from "../api/extractions-api";
import { parseApiError } from "../lib/utils";

/* ─── field configs by doc type ────────────────────────────────────────────── */

const INVOICE_FIELDS = [
  ["vendor_name", "Vendor / Party Name"],
  ["vendor_gstin", "Vendor GSTIN"],
  ["invoice_number", "Invoice Number"],
  ["invoice_date", "Invoice Date"],
  ["subtotal", "Subtotal / Taxable Amount"],
  ["cgst", "CGST"],
  ["sgst", "SGST"],
  ["igst", "IGST"],
  ["tax_amount", "Total Tax"],
  ["total_amount", "Invoice Total"],
  ["payment_terms", "Payment Terms"],
  ["tds_section", "TDS Section"],
  ["tds_rate", "TDS Rate (%)"],
  ["tds_amount", "TDS Amount"]
];

const BANK_FIELDS = [
  ["account_holder", "Account Holder Name"],
  ["account_number", "Account Number"],
  ["bank_name", "Bank Name"],
  ["ifsc_code", "IFSC Code"],
  ["statement_period_from", "Statement Period From"],
  ["statement_period_to", "Statement Period To"],
  ["opening_balance", "Opening Balance (₹)"],
  ["closing_balance", "Closing Balance (₹)"]
];

const getHeaderFields = (docType) =>
  docType === "bank_statement" ? BANK_FIELDS : INVOICE_FIELDS;

/* ─── line item / transaction helpers ──────────────────────────────────────── */

const emptyLineItem = () => ({
  description: "",
  quantity: "",
  unit_price: "",
  total: "",
  tally_item_name: "",
  hsn_code: "",
  uom: "",
  suggestions: []
});

const emptyTransaction = () => ({
  date: "",
  narration: "",
  debit: "",
  credit: "",
  balance: "",
  reference: ""
});

/* ─── validation helpers ────────────────────────────────────────────────────── */

const getFieldValidation = (validation, fieldKey) => {
  if (!validation) return null;
  if (fieldKey === "vendor_gstin" && validation.gstin && !validation.gstin.valid)
    return validation.gstin;
  if (fieldKey === "tax_amount" && Array.isArray(validation.tax_math))
    return validation.tax_math.find((i) => i.field === "tax_amount") || null;
  if (fieldKey === "total_amount" && Array.isArray(validation.tax_math))
    return validation.tax_math.find((i) => i.field === "total_amount") || null;
  if (fieldKey === "cgst" && Array.isArray(validation.tax_math))
    return validation.tax_math.find((i) => i.field === "cgst") || null;
  if (fieldKey === "tds_rate" && validation.tds && !validation.tds.valid)
    return validation.tds;
  return null;
};

const hasBlockingErrors = (validation) => {
  if (!validation) return false;
  return Boolean(
    validation.gstin && !validation.gstin.valid && validation.gstin.severity === "error"
  );
};

/* ─── component ─────────────────────────────────────────────────────────────── */

const ReviewPage = () => {
  const { doc_id: documentId } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [document, setDocument] = useState(null);
  const [form, setForm] = useState({});
  const [lineItems, setLineItems] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [confidence, setConfidence] = useState(0);
  const [validation, setValidation] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const docType = document?.docType || document?.doc_type || "invoice";
  const isBankStatement = docType === "bank_statement";
  const headerFields = getHeaderFields(docType);

  /* ─── load ─── */

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [docResult, extractionResult] = await Promise.allSettled([
        documentsApi.getById(documentId),
        extractionsApi.getByDocumentId(documentId)
      ]);

      if (docResult.status === "fulfilled") {
        setDocument(docResult.value);
      }

      if (extractionResult.status === "fulfilled") {
        const ext = extractionResult.value;
        const sd = ext?.structured_data || ext?.structuredData || {};
        setConfidence(ext?.confidence_score || ext?.confidenceScore || 0);
        setValidation(ext?.validation || null);

        // Populate header form fields
        const fields = {};
        for (const [key] of [...INVOICE_FIELDS, ...BANK_FIELDS]) {
          fields[key] = sd[key] ?? "";
        }
        setForm(fields);

        // Line items (invoice/bill)
        const rawItems = ext?.line_items || sd.line_items || [];
        setLineItems(
          rawItems.length > 0
            ? rawItems.map((item) => ({
                description: item.description || "",
                quantity: item.quantity ?? "",
                unit_price: item.unit_price ?? "",
                total: item.total ?? "",
                tally_item_name: item.tally_item_name || item.description || "",
                hsn_code: item.hsn_code || "",
                uom: item.uom || "",
                suggestions: item.suggestions || []
              }))
            : []
        );

        // Transactions (bank statement)
        const rawTxns = sd.transactions || [];
        setTransactions(
          rawTxns.map((txn) => ({
            date: txn.date || "",
            narration: txn.narration || "",
            debit: txn.debit ?? "",
            credit: txn.credit ?? "",
            balance: txn.balance ?? "",
            reference: txn.reference || ""
          }))
        );
      }

      if (docResult.status === "rejected" && extractionResult.status === "rejected") {
        setError("Review data endpoint is not available yet.");
      }
    } catch (loadError) {
      setError(parseApiError(loadError, "Unable to load review data"));
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* ─── form helpers ─── */

  const onFieldChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const onLineItemChange = (idx, key, value) =>
    setLineItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [key]: value };
      return next;
    });

  const onTransactionChange = (idx, key, value) =>
    setTransactions((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [key]: value };
      return next;
    });

  const addLineItem = () => setLineItems((prev) => [...prev, emptyLineItem()]);
  const removeLineItem = (idx) => setLineItems((prev) => prev.filter((_, i) => i !== idx));

  const addTransaction = () => setTransactions((prev) => [...prev, emptyTransaction()]);
  const removeTransaction = (idx) => setTransactions((prev) => prev.filter((_, i) => i !== idx));

  /* ─── build payload ─── */

  const buildPayload = () => {
    const payload = { ...form };
    if (isBankStatement) {
      payload.transactions = transactions.map(({ ...rest }) => rest);
    } else {
      payload.line_items = lineItems.map(({ suggestions, ...rest }) => rest);
    }
    return payload;
  };

  /* ─── save / approve / reprocess ─── */

  const onSave = async () => {
    setSaving(true);
    setToast("");
    setError("");
    try {
      await extractionsApi.update(documentId, buildPayload());
      setToast("Extraction corrections saved.");
    } catch (saveError) {
      setError(parseApiError(saveError, "Unable to save extraction"));
    } finally {
      setSaving(false);
    }
  };

  const onApprove = async () => {
    setApproving(true);
    setToast("");
    setError("");
    try {
      await extractionsApi.update(documentId, buildPayload());
      await extractionsApi.approve(documentId);
      setToast("Extraction approved. Item name mappings saved.");
      await loadData();
    } catch (approveError) {
      setError(parseApiError(approveError, "Unable to approve extraction"));
    } finally {
      setApproving(false);
    }
  };

  const onReprocess = async () => {
    setReprocessing(true);
    setToast("");
    setError("");
    try {
      await extractionsApi.reprocess(documentId);
      setToast("Reprocess request queued. Refresh in a moment.");
    } catch (reprocessError) {
      setError(parseApiError(reprocessError, "Unable to reprocess document"));
    } finally {
      setReprocessing(false);
    }
  };

  /* ─── derived state ─── */

  const lowConfidence = confidence < 0.8;
  const blocking = hasBlockingErrors(validation);
  const isExported = document?.status === "exported";
  const isReviewed = document?.status === "reviewed";

  const previewUrl = useMemo(
    () => document?.preview_url || document?.download_url || document?.downloadUrl || "",
    [document]
  );

  const previewNode = previewUrl ? (
    previewUrl.toLowerCase().includes(".pdf") ? (
      <iframe
        title="Document preview"
        src={previewUrl}
        className="h-[70vh] w-full rounded-lg border border-[#e3d7c3]"
      />
    ) : (
      <img
        src={previewUrl}
        alt="Uploaded document"
        className="max-h-[70vh] w-full rounded-lg border border-[#e3d7c3] object-contain"
      />
    )
  ) : (
    <div className="flex h-[70vh] items-center justify-center rounded-lg border border-dashed border-[#d8c8a8] bg-sand-50 text-sm text-[#74849a]">
      Preview not available. Document may still be processing.
    </div>
  );

  /* ─── render ─── */

  return (
    <AppShell
      title="Extraction Review"
      subtitle="Verify AI output against the original document before approving export-ready entries."
    >
      {loading ? <ReviewSkeleton /> : null}

      {error && (
        <div className="mb-4 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      )}

      {toast && (
        <div className="mb-4 rounded-lg border border-mint-300 bg-mint-500/10 px-4 py-3 text-sm font-semibold text-mint-700">
          {toast}
        </div>
      )}

      {/* Duplicate invoice warning */}
      {validation?.duplicate?.isDuplicate && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          Warning: {validation.duplicate.message}
          {validation.duplicate.existingDocumentId && (
            <Link
              to={`/review/${validation.duplicate.existingDocumentId}`}
              className="ml-2 text-amber-600 underline hover:text-amber-700"
            >
              View original
            </Link>
          )}
        </div>
      )}

      {/* Two-column layout */}
      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Left: document preview */}
        <article className="panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-ink-900">Original document</h2>
            <div className="flex items-center gap-2">
              {isBankStatement && (
                <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                  Bank Statement
                </span>
              )}
              {docType === "bill" && (
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                  Bill
                </span>
              )}
              <StatusBadge status={document?.status || "uploaded"} />
            </div>
          </div>
          {previewNode}
        </article>

        {/* Right: extracted header fields */}
        <article className="panel p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-ink-900">Extracted fields</h2>
            <div
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                lowConfidence ? "bg-amber-100 text-amber-700" : "bg-mint-500/10 text-mint-700"
              }`}
            >
              Confidence {Math.round(Number(confidence || 0) * 100)}%
            </div>
          </div>

          <div className="max-h-[58vh] space-y-3 overflow-y-auto pr-1">
            {headerFields.map(([key, label]) => {
              const fv = getFieldValidation(validation, key);
              return (
                <div key={key}>
                  <label className="label">{label}</label>
                  <input
                    className={`field ${lowConfidence && !form[key] ? "bg-amber-50" : ""} ${
                      fv?.severity === "error"
                        ? "border-rose-400 bg-rose-50/50"
                        : fv
                        ? "border-amber-300 bg-amber-50/50"
                        : ""
                    }`}
                    value={form[key] ?? ""}
                    disabled={isExported}
                    onChange={(e) => onFieldChange(key, e.target.value)}
                  />
                  {fv?.message && (
                    <p
                      className={`mt-1 text-xs font-medium ${
                        fv.severity === "error" ? "text-rose-600" : "text-amber-600"
                      }`}
                    >
                      {fv.severity === "error" ? "Error: " : "Warning: "}
                      {fv.message}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Action buttons */}
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              type="button"
              className="btn-secondary"
              disabled={saving || isExported}
              onClick={onSave}
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={reprocessing || isExported}
              onClick={onReprocess}
            >
              {reprocessing ? "Queueing..." : "Reprocess"}
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={approving || blocking || isExported || isReviewed}
              onClick={onApprove}
              title={
                blocking
                  ? "Fix errors before approving"
                  : isReviewed
                  ? "Already approved"
                  : ""
              }
            >
              {approving ? "Approving..." : isReviewed ? "Approved" : "Approve"}
            </button>
          </div>
        </article>
      </section>

      {/* ─── Bank Statement: Transactions table ─── */}
      {isBankStatement && (
        <section className="panel mt-4 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-ink-900">
              Transactions
              <span className="ml-2 text-sm font-normal text-ink-500">
                ({transactions.length} {transactions.length === 1 ? "entry" : "entries"})
              </span>
            </h2>
            {!isExported && (
              <button
                type="button"
                className="btn-secondary px-3 py-1.5 text-xs"
                onClick={addTransaction}
              >
                + Add Row
              </button>
            )}
          </div>

          {transactions.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-400">
              No transactions extracted. Click "Add Row" to add manually or reprocess.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr className="bg-sand-100 text-left text-xs uppercase tracking-wide text-[#6d7e95]">
                    <th className="rounded-l-lg px-2 py-2.5 w-10">#</th>
                    <th className="px-2 py-2.5 w-28">Date</th>
                    <th className="px-2 py-2.5">Narration</th>
                    <th className="px-2 py-2.5 w-28 text-right">Debit (₹)</th>
                    <th className="px-2 py-2.5 w-28 text-right">Credit (₹)</th>
                    <th className="px-2 py-2.5 w-28 text-right">Balance (₹)</th>
                    <th className="px-2 py-2.5 w-28">Reference</th>
                    <th className="rounded-r-lg px-2 py-2.5 w-10 text-center">
                      <span className="sr-only">Remove</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((txn, idx) => (
                    <tr key={idx} className="border-t border-[#eadfcf] align-top">
                      <td className="px-2 py-2 text-xs text-ink-400 font-mono">{idx + 1}</td>
                      <td className="px-2 py-2">
                        <input
                          className="field text-xs w-full"
                          type="date"
                          value={txn.date}
                          disabled={isExported}
                          onChange={(e) => onTransactionChange(idx, "date", e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className="field text-xs"
                          value={txn.narration}
                          disabled={isExported}
                          onChange={(e) => onTransactionChange(idx, "narration", e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className="field text-xs w-full text-right"
                          inputMode="decimal"
                          value={txn.debit}
                          disabled={isExported}
                          onChange={(e) => onTransactionChange(idx, "debit", e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className="field text-xs w-full text-right"
                          inputMode="decimal"
                          value={txn.credit}
                          disabled={isExported}
                          onChange={(e) => onTransactionChange(idx, "credit", e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className="field text-xs w-full text-right"
                          inputMode="decimal"
                          value={txn.balance}
                          disabled={isExported}
                          onChange={(e) => onTransactionChange(idx, "balance", e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className="field text-xs w-full"
                          value={txn.reference}
                          disabled={isExported}
                          onChange={(e) => onTransactionChange(idx, "reference", e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        {!isExported && (
                          <button
                            type="button"
                            className="text-ink-400 hover:text-rose-500 transition-colors text-lg leading-none"
                            title="Remove row"
                            onClick={() => removeTransaction(idx)}
                          >
                            &times;
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ─── Invoice/Bill: Line Items table ─── */}
      {!isBankStatement && (
        <section className="panel mt-4 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-ink-900">
              Line Items
              <span className="ml-2 text-sm font-normal text-ink-500">
                ({lineItems.length} {lineItems.length === 1 ? "item" : "items"})
              </span>
            </h2>
            {!isExported && (
              <button
                type="button"
                className="btn-secondary px-3 py-1.5 text-xs"
                onClick={addLineItem}
              >
                + Add Row
              </button>
            )}
          </div>

          {lineItems.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-400">
              No line items extracted. Click "Add Row" to add manually or reprocess the document.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr className="bg-sand-100 text-left text-xs uppercase tracking-wide text-[#6d7e95]">
                    <th className="rounded-l-lg px-2 py-2.5 w-10">#</th>
                    <th className="px-2 py-2.5">Description</th>
                    <th className="px-2 py-2.5 w-16">Qty</th>
                    <th className="px-2 py-2.5 w-20">Rate</th>
                    <th className="px-2 py-2.5 w-24">Amount</th>
                    <th className="px-2 py-2.5 w-20">HSN</th>
                    <th className="px-2 py-2.5 w-16">UOM</th>
                    <th className="px-2 py-2.5 bg-mint-500/5">
                      <span className="text-mint-700">Tally Item Name</span>
                    </th>
                    <th className="rounded-r-lg px-2 py-2.5 w-10 text-center">
                      <span className="sr-only">Remove</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item, idx) => {
                    const datalistId = `suggestions-${idx}`;
                    return (
                      <tr key={idx} className="border-t border-[#eadfcf] align-top">
                        <td className="px-2 py-2 text-xs text-ink-400 font-mono">{idx + 1}</td>
                        <td className="px-2 py-2">
                          <input
                            className="field text-xs"
                            value={item.description}
                            disabled={isExported}
                            onChange={(e) => onLineItemChange(idx, "description", e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            className="field text-xs w-full"
                            inputMode="decimal"
                            value={item.quantity}
                            disabled={isExported}
                            onChange={(e) => onLineItemChange(idx, "quantity", e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            className="field text-xs w-full"
                            inputMode="decimal"
                            value={item.unit_price}
                            disabled={isExported}
                            onChange={(e) => onLineItemChange(idx, "unit_price", e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            className="field text-xs w-full"
                            inputMode="decimal"
                            value={item.total}
                            disabled={isExported}
                            onChange={(e) => onLineItemChange(idx, "total", e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            className="field text-xs w-full"
                            value={item.hsn_code}
                            disabled={isExported}
                            onChange={(e) => onLineItemChange(idx, "hsn_code", e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            className="field text-xs w-full"
                            value={item.uom}
                            placeholder="PCS"
                            disabled={isExported}
                            onChange={(e) => onLineItemChange(idx, "uom", e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-2 bg-mint-500/5">
                          <input
                            className="field text-xs w-full border-mint-300 focus:border-mint-500 focus:ring-mint-500/20"
                            value={item.tally_item_name}
                            disabled={isExported}
                            list={datalistId}
                            placeholder="Mapped name..."
                            onChange={(e) =>
                              onLineItemChange(idx, "tally_item_name", e.target.value)
                            }
                          />
                          {item.suggestions?.length > 0 && (
                            <datalist id={datalistId}>
                              {item.suggestions.map((s, si) => (
                                <option key={si} value={s} />
                              ))}
                            </datalist>
                          )}
                        </td>
                        <td className="px-2 py-2 text-center">
                          {!isExported && (
                            <button
                              type="button"
                              className="text-ink-400 hover:text-rose-500 transition-colors text-lg leading-none"
                              title="Remove row"
                              onClick={() => removeLineItem(idx)}
                            >
                              &times;
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {validation?.tds && !validation.tds.valid && validation.tds.message && (
            <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              TDS: {validation.tds.message}
            </div>
          )}
        </section>
      )}
    </AppShell>
  );
};

export default ReviewPage;
