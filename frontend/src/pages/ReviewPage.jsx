import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import { ReviewSkeleton } from "../components/ui/skeletons";
import StatusBadge from "../components/ui/StatusBadge";
import { documentsApi } from "../api/documents-api";
import { extractionsApi } from "../api/extractions-api";
import { complianceApi } from "../api/compliance-api";
import { documentVersionsApi } from "../api/document-versions-api";
import { useAuth } from "../contexts/AuthContext";
import { parseApiError, triggerFileDownload } from "../lib/utils";
import { isAdmin } from "../utils/permissions";

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

const confidenceTone = (confidence) => {
  const percentage = Math.round(Number(confidence || 0) * 100);
  if (percentage >= 80) return { bar: "bg-mint-600", text: "text-mint-700", track: "bg-mint-500/10" };
  if (percentage >= 60) return { bar: "bg-yellow-500", text: "text-yellow-700", track: "bg-yellow-100" };
  if (percentage >= 40) return { bar: "bg-amber-500", text: "text-amber-700", track: "bg-amber-100" };
  return { bar: "bg-rose-500", text: "text-rose-700", track: "bg-rose-100" };
};

const FIELD_ALIASES = {
  vendor_name: ["supplier_name"],
  vendor_gstin: ["supplier_gstin"],
  subtotal: ["taxable_amount"],
  cgst: ["cgst_amount"],
  sgst: ["sgst_amount"],
  igst: ["igst_amount"]
};

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

const deriveGstr2bPeriod = (value) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  return `${month}${parsed.getFullYear()}`;
};

const formatMismatchField = (field) =>
  ({
    supplierGSTIN: "Supplier GSTIN",
    taxableAmount: "Taxable Amount",
    gstAmount: "GST Amount",
    invoiceDate: "Invoice Date"
  }[field] || field);

const getGstBadge = (status) => {
  if (!status) {
    return { label: "Unverified", className: "bg-slate-100 text-slate-600" };
  }
  if (status === "matched") {
    return { label: "GST Verified", className: "bg-mint-500/10 text-mint-700" };
  }
  if (status === "partial") {
    return { label: "Partial Match", className: "bg-amber-100 text-amber-700" };
  }
  if (status === "not_found") {
    return { label: "Not in GSTR-2B", className: "bg-rose-100 text-rose-700" };
  }
  if (status === "mismatch") {
    return { label: "Mismatch", className: "bg-rose-100 text-rose-700" };
  }
  if (status === "unavailable") {
    return { label: "GSP Unavailable", className: "bg-slate-100 text-slate-600" };
  }
  return { label: "Unverified", className: "bg-slate-100 text-slate-600" };
};

const getRecordValue = (record, field) => {
  if (!record) return "-";
  if (field === "supplierGSTIN") return record.supplierGSTIN || record.supplier_gstin || record.ctin || record.gstin || "-";
  if (field === "taxableAmount") return record.taxableAmount ?? record.taxable_amount ?? record.txval ?? "-";
  if (field === "gstAmount") {
    return record.gstAmount ?? record.gst_amount ?? record.iamt ?? record.camt ?? "-";
  }
  if (field === "invoiceDate") return record.invoiceDate || record.invoice_date || record.idt || record.date || "-";
  return record[field] ?? "-";
};

const getExtractedMismatchValue = (form, field) => {
  if (field === "supplierGSTIN") return form.vendor_gstin || "-";
  if (field === "taxableAmount") return form.taxable_amount || form.subtotal || "-";
  if (field === "gstAmount") return form.tax_amount || "-";
  if (field === "invoiceDate") return form.invoice_date || "-";
  return form[field] || "-";
};

const HISTORY_FIELDS = [
  ["invoice_number", "Invoice Number"],
  ["invoice_date", "Invoice Date"],
  ["vendor_name", "Supplier Name"],
  ["vendor_gstin", "Supplier GSTIN"],
  ["taxable_amount", "Taxable Amount"],
  ["tax_amount", "GST Amount"],
  ["total_amount", "Total Amount"]
];

const reasonLabel = (reason) =>
  ({
    pre_edit: "Before Edit",
    pre_approval: "Before Approval",
    reprocess: "Before Reprocess"
  }[reason] || reason);

const reasonClass = (reason) =>
  ({
    pre_edit: "bg-slate-100 text-slate-600",
    pre_approval: "bg-indigo-100 text-indigo-700",
    reprocess: "bg-amber-100 text-amber-700"
  }[reason] || "bg-slate-100 text-slate-600");

const relativeTime = (value) => {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
};

const normalizeValue = (value) =>
  value === undefined || value === null || value === "" ? "—" : String(value);

/* ─── component ─────────────────────────────────────────────────────────────── */

const ReviewPage = () => {
  const { doc_id: documentId } = useParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [document, setDocument] = useState(null);
  const [extractionReady, setExtractionReady] = useState(false);
  const [extractionMessage, setExtractionMessage] = useState("");
  const [form, setForm] = useState({});
  const [structuredData, setStructuredData] = useState({});
  const [lineItems, setLineItems] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [confidence, setConfidence] = useState(0);
  const [validation, setValidation] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [gstMatch, setGstMatch] = useState(null);
  const [gstChecking, setGstChecking] = useState(false);
  const [gstDetailsOpen, setGstDetailsOpen] = useState(false);
  const [versions, setVersions] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [versionLoading, setVersionLoading] = useState(false);
  const [versionError, setVersionError] = useState("");
  const [isPolling, setIsPolling] = useState(false);
  const [pollError, setPollError] = useState("");
  const pollingRef = useRef(null);

  const docType = document?.docType || document?.doc_type || "invoice";
  const isBankStatement = docType === "bank_statement";
  const headerFields = getHeaderFields(docType);

  /* ─── load ─── */

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [docResult, extractionResult, versionsResult] = await Promise.allSettled([
        documentsApi.getById(documentId),
        extractionsApi.getByDocumentId(documentId),
        documentVersionsApi.list(documentId)
      ]);

      if (docResult.status === "fulfilled") {
        setDocument(docResult.value);
        if (docResult.value?.gstr2bMatchStatus) {
          setGstMatch({
            matchStatus: docResult.value.gstr2bMatchStatus,
            ...(docResult.value.gstr2bMatchDetails || {})
          });
        } else {
          setGstMatch(null);
        }
      }

      if (extractionResult.status === "fulfilled") {
        const ext = extractionResult.value;

        // Backend returns { extraction: null, message: "..." } when not yet processed
        if (!ext || ext.extraction === null && ext.message) {
          setExtractionReady(false);
          setExtractionMessage(ext.message || "Document has not been processed yet.");
          setStructuredData({});
          return;
        }

        setExtractionReady(true);
        const sd = ext?.structured_data || ext?.structuredData || {};
        setStructuredData(sd);
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

      if (versionsResult.status === "fulfilled") {
        setVersions(versionsResult.value.versions || []);
      } else {
        setVersions([]);
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

  /* ─── processing status polling ─── */

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    if (pollingRef.current) return;
    const startTime = Date.now();
    const MAX_POLL_TIME = 3 * 60 * 1000;

    pollingRef.current = setInterval(async () => {
      if (Date.now() - startTime > MAX_POLL_TIME) {
        stopPolling();
        setIsPolling(false);
        setPollError("Processing is taking longer than expected. Please refresh the page.");
        return;
      }

      try {
        const doc = await documentsApi.getById(documentId);

        if (doc.status === "extracted" || doc.status === "review_required") {
          stopPolling();
          setIsPolling(false);
          setToast("Document reprocessed successfully.");
          await loadData();
          return;
        }

        if (doc.status === "failed") {
          stopPolling();
          setIsPolling(false);
          setPollError("Processing failed. Please try again.");
          setDocument(doc);
          return;
        }
      } catch (pollErr) {
        console.error("Poll error:", pollErr);
      }
    }, 3000);
  }, [documentId, loadData, stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  // Auto-start polling if the document is already processing on page load
  useEffect(() => {
    if (!loading && document?.status === "processing" && !pollingRef.current) {
      setIsPolling(true);
      setPollError("");
      startPolling();
    }
  }, [loading, document?.status, startPolling]);

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
      await loadData();
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
    setPollError("");
    try {
      await extractionsApi.reprocess(documentId);
      setIsPolling(true);
      startPolling();
    } catch (reprocessError) {
      setError(parseApiError(reprocessError, "Unable to reprocess document"));
    } finally {
      setReprocessing(false);
    }
  };

  const onVerifyGst = async () => {
    const gstin = String(form.vendor_gstin || "").trim().toUpperCase();
    const period = deriveGstr2bPeriod(form.invoice_date);

    setToast("");
    setError("");
    if (!gstin) {
      setError("No GSTIN found in document");
      return;
    }
    if (!period) {
      setError("Invoice date is required to derive the GSTR-2B period.");
      return;
    }

    setGstChecking(true);
    try {
      const result = await complianceApi.matchGstr2b({
        gstin,
        period,
        documentIds: [documentId]
      });
      const match = result.results?.[0];
      setGstMatch(match || null);
      setGstDetailsOpen(Boolean(match?.mismatchFields?.length));
      setToast("GST verification updated.");
    } catch (verifyError) {
      setError(parseApiError(verifyError, "Unable to verify GST details"));
    } finally {
      setGstChecking(false);
    }
  };

  const currentStructuredData = useMemo(() => {
    const payload = { ...form };
    if (isBankStatement) {
      payload.transactions = transactions;
    } else {
      payload.line_items = lineItems.map(({ suggestions, ...rest }) => rest);
    }
    return payload;
  }, [form, isBankStatement, lineItems, transactions]);

  const [downloadError, setDownloadError] = useState("");
  const [downloading, setDownloading] = useState(false);

  const handleDownloadOriginal = async () => {
    const url = document?.preview_url || document?.download_url || document?.downloadUrl;
    if (!url) return;
    setDownloading(true);
    setDownloadError("");
    try {
      await triggerFileDownload(url, document?.file_name || "document");
    } catch (downloadErr) {
      setDownloadError(parseApiError(downloadErr, "Unable to download this document"));
    } finally {
      setDownloading(false);
    }
  };

  const openHistory = async () => {
    setHistoryOpen(true);
    setVersionError("");
    if (!selectedVersion && versions.length > 0) {
      await selectVersion(versions[0]);
    }
  };

  const selectVersion = async (version) => {
    setVersionLoading(true);
    setVersionError("");
    try {
      const detail = await documentVersionsApi.get(documentId, version.id);
      setSelectedVersion(detail);
    } catch (historyError) {
      setVersionError(parseApiError(historyError, "Unable to load version detail"));
    } finally {
      setVersionLoading(false);
    }
  };

  /* ─── derived state ─── */

  const lowConfidence = confidence < 0.8;
  const confidencePercent = Math.round(Number(confidence || 0) * 100);
  const confidenceStyle = confidenceTone(confidence);
  const showConfidencePanel = ["extracted", "review_required"].includes(document?.status);
  const taxMathWarning = structuredData?._tax_math_warning || "";
  const pageTruncationWarning = structuredData?._page_truncation_warning || "";
  const lowConfidenceFields = Array.isArray(structuredData?.low_confidence_fields)
    ? structuredData.low_confidence_fields
    : [];
  const blocking = hasBlockingErrors(validation);
  const isExported = document?.status === "exported";
  const isReviewed = document?.status === "reviewed";
  const isLocked = isExported || isReviewed;
  const canApprove = ["extracted", "review_required"].includes(document?.status);
  const canAdmin = isAdmin(user);

  const isLowConfidenceField = (key) => {
    const candidates = [key, ...(FIELD_ALIASES[key] || [])];
    return candidates.some((candidate) => lowConfidenceFields.includes(candidate));
  };

  const isMissingExtractedField = (key) => {
    const candidates = [key, ...(FIELD_ALIASES[key] || [])];
    return candidates.some((candidate) => structuredData?.[candidate] === null);
  };

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

      {pollError && (
        <div className="mb-4 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {pollError}
        </div>
      )}

      {historyOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-ink-900/40 backdrop-blur-sm">
          <aside className="h-full w-full max-w-5xl overflow-y-auto bg-white shadow-elevated">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#eadfcf] bg-white px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-ink-900">Edit History</h2>
                <p className="text-sm text-[#607086]">{document?.fileName || document?.file_name}</p>
              </div>
              <button
                type="button"
                className="btn-secondary px-3 py-1.5 text-xs"
                onClick={() => setHistoryOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="grid gap-4 p-5 lg:grid-cols-[0.85fr_1.4fr]">
              <section className="rounded-xl border border-[#e4d8c5] p-3">
                {versions.length === 0 ? (
                  <p className="py-8 text-center text-sm text-[#6b7d93]">No edit history yet.</p>
                ) : (
                  <div className="space-y-2">
                    {versions.map((version) => (
                      <button
                        key={version.id}
                        type="button"
                        className={`w-full rounded-lg border px-3 py-3 text-left transition ${
                          selectedVersion?.id === version.id
                            ? "border-ink-900 bg-sand-100"
                            : "border-[#eadfcf] hover:bg-sand-50"
                        }`}
                        onClick={() => selectVersion(version)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-ink-900">v{version.versionNumber}</span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${reasonClass(version.snapshotReason)}`}>
                            {reasonLabel(version.snapshotReason)}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-[#607086]">
                          {version.createdByName || "System"} · {relativeTime(version.createdAt)}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-xl border border-[#e4d8c5] p-4">
                {versionLoading ? (
                  <p className="py-8 text-center text-sm font-semibold text-[#607086]">Loading version...</p>
                ) : versionError ? (
                  <div className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {versionError}
                  </div>
                ) : selectedVersion ? (
                  <div>
                    <div className="grid grid-cols-2 gap-3 text-xs font-bold uppercase tracking-wide text-[#6a7b90]">
                      <span>Historical v{selectedVersion.versionNumber}</span>
                      <span>Current</span>
                    </div>
                    <div className="mt-3 space-y-2">
                      {HISTORY_FIELDS.map(([key, label]) => {
                        const oldValue = normalizeValue(selectedVersion.extractedData?.[key]);
                        const newValue = normalizeValue(currentStructuredData?.[key]);
                        const changed = oldValue !== newValue;
                        return (
                          <div key={key} className="grid gap-2 rounded-lg border border-[#f0e7d9] p-2 sm:grid-cols-[150px_1fr_1fr]">
                            <div className="text-xs font-bold text-[#607086]">{label}</div>
                            <div className={`rounded px-2 py-1 text-sm ${changed ? "bg-amber-100 text-amber-800" : "bg-sand-50 text-ink-800"}`}>
                              {oldValue}
                            </div>
                            <div className={`rounded px-2 py-1 text-sm ${changed ? "bg-amber-100 text-amber-800" : "bg-sand-50 text-ink-800"}`}>
                              {newValue}
                            </div>
                          </div>
                        );
                      })}
                      {(() => {
                        const oldCount = Array.isArray(selectedVersion.extractedData?.line_items)
                          ? selectedVersion.extractedData.line_items.length
                          : 0;
                        const newCount = Array.isArray(currentStructuredData?.line_items)
                          ? currentStructuredData.line_items.length
                          : 0;
                        const changed = oldCount !== newCount;
                        return (
                          <div className="grid gap-2 rounded-lg border border-[#f0e7d9] p-2 sm:grid-cols-[150px_1fr_1fr]">
                            <div className="text-xs font-bold text-[#607086]">Line Items</div>
                            <div className={`rounded px-2 py-1 text-sm ${changed ? "bg-amber-100 text-amber-800" : "bg-sand-50 text-ink-800"}`}>
                              {oldCount} items
                            </div>
                            <div className={`rounded px-2 py-1 text-sm ${changed ? "bg-amber-100 text-amber-800" : "bg-sand-50 text-ink-800"}`}>
                              {newCount} items
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                ) : (
                  <p className="py-8 text-center text-sm text-[#6b7d93]">Select a version to compare.</p>
                )}
              </section>
            </div>
          </aside>
        </div>
      )}

      {/* Processing / polling state */}
      {isPolling && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          <div className="relative h-5 w-5 shrink-0">
            <span className="absolute inset-0 animate-spin rounded-full border-2 border-amber-200 border-t-amber-600" />
          </div>
          <div>
            <p>Processing document...</p>
            <p className="mt-0.5 font-normal">This usually takes 30–60 seconds.</p>
          </div>
        </div>
      )}

      {/* Not yet processed banner */}
      {!loading && !error && !isPolling && !extractionReady && extractionMessage && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          {extractionMessage}
          {document && (["uploaded", "processing"].includes(document.status)) && (
            <span className="ml-2 font-normal">Current status: <strong>{document.status}</strong>. Refresh the page in a few moments.</span>
          )}
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

      {document?.status === "review_required" && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-semibold">
            This document was flagged during processing — low confidence or unexpected document type. Please verify all fields carefully before approving.
          </p>
          <p className="mt-1 font-medium">
            Tip: Fields highlighted in red had low confidence. Verify these carefully.
          </p>
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
              {previewUrl && (
                <button
                  type="button"
                  onClick={handleDownloadOriginal}
                  disabled={downloading}
                  className="rounded-md border border-[#d8c8a8] bg-white px-2.5 py-1 text-xs font-semibold text-ink-700 hover:bg-sand-50 disabled:opacity-60"
                >
                  {downloading ? "Downloading..." : "Download"}
                </button>
              )}
            </div>
          </div>
          {downloadError && (
            <p className="mb-2 text-xs font-semibold text-rose-600">{downloadError}</p>
          )}
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

          {showConfidencePanel && (
            <div className="mb-4 rounded-lg border border-[#eadfcf] bg-sand-50/60 px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-wide text-[#607086]">
                  AI Extraction Confidence
                </p>
                <p className={`text-xs font-bold ${confidenceStyle.text}`}>
                  {confidencePercent}% confidence
                </p>
              </div>
              <div className={`mt-2 h-2 overflow-hidden rounded-full ${confidenceStyle.track}`}>
                <div
                  className={`h-full rounded-full ${confidenceStyle.bar}`}
                  style={{ width: `${Math.max(0, Math.min(100, confidencePercent))}%` }}
                />
              </div>
              {taxMathWarning && (
                <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <p className="font-semibold">
                    ⚠ Tax math mismatch detected — verify amounts before approving
                  </p>
                  <p className="mt-1">{taxMathWarning}</p>
                </div>
              )}
              {pageTruncationWarning && (
                <div className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">
                  <p className="font-semibold">⚠ Document truncated — some pages were not processed</p>
                  <p className="mt-1">{pageTruncationWarning}</p>
                </div>
              )}
            </div>
          )}

          <div className="relative">
            {isPolling && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-lg bg-white/80 backdrop-blur-sm">
                <div className="relative h-8 w-8">
                  <span className="absolute inset-0 animate-spin rounded-full border-2 border-ink-200 border-t-mint-500" />
                </div>
                <p className="text-sm font-semibold text-ink-700">Processing document...</p>
                <p className="text-xs text-[#607086]">This usually takes 30–60 seconds</p>
              </div>
            )}
            <div className={`max-h-[58vh] space-y-3 overflow-y-auto pr-1 ${isPolling ? "pointer-events-none opacity-40" : ""}`}>
              {headerFields.map(([key, label]) => {
              const fv = getFieldValidation(validation, key);
              const isGstinField = key === "vendor_gstin";
              const gstBadge = getGstBadge(gstMatch?.matchStatus);
              const fieldNeedsReview = isMissingExtractedField(key) || isLowConfidenceField(key);
              return (
                <div key={key}>
                  <label className="label">{label}</label>
                  <input
                    className={`field ${fieldNeedsReview ? "border-rose-300 bg-rose-50/60" : ""} ${lowConfidence && !form[key] && !fieldNeedsReview ? "bg-amber-50" : ""} ${
                      fv?.severity === "error"
                        ? "border-rose-400 bg-rose-50/50"
                        : fv
                        ? "border-amber-300 bg-amber-50/50"
                        : ""
                    }`}
                    value={form[key] ?? ""}
                    disabled={isLocked}
                    onChange={(e) => onFieldChange(key, e.target.value)}
                  />
                  {fieldNeedsReview && (
                    <p className="mt-1 text-xs font-medium text-rose-600">
                      Verify this field before approving.
                    </p>
                  )}
                  {isGstinField && (
                    <div className="mt-2 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${gstBadge.className}`}
                        >
                          {gstChecking ? "Checking..." : gstBadge.label}
                        </span>
                        {canAdmin && (
                          <button
                            type="button"
                            className="btn-secondary px-3 py-1.5 text-xs"
                            disabled={gstChecking || isExported || !form.vendor_gstin}
                            title={!form.vendor_gstin ? "No GSTIN found in document" : ""}
                            onClick={onVerifyGst}
                          >
                            {gstChecking ? "Verifying..." : "Verify GST"}
                          </button>
                        )}
                        {gstMatch?.mismatchFields?.length > 0 && (
                          <button
                            type="button"
                            className="text-xs font-semibold text-[#607086] underline"
                            onClick={() => setGstDetailsOpen((prev) => !prev)}
                          >
                            {gstDetailsOpen ? "Hide details" : "Show details"}
                          </button>
                        )}
                      </div>

                      {gstDetailsOpen && gstMatch?.mismatchFields?.length > 0 && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                          <p className="font-semibold">
                            Mismatched fields:{" "}
                            {gstMatch.mismatchFields.map(formatMismatchField).join(", ")}
                          </p>
                          <div className="mt-2 space-y-1">
                            {gstMatch.mismatchFields.map((field) => (
                              <div key={field} className="grid gap-2 sm:grid-cols-3">
                                <span className="font-medium">{formatMismatchField(field)}</span>
                                <span>Extracted: {getExtractedMismatchValue(form, field)}</span>
                                <span>GSTR-2B: {getRecordValue(gstMatch.gstr2bRecord, field)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
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
          </div>

          {versions.length > 0 && (
            <button
              type="button"
              className="btn-secondary mt-4 w-full"
              onClick={openHistory}
            >
              View History
            </button>
          )}

          {/* Action buttons */}
          <div className={`mt-4 grid grid-cols-1 gap-2 ${canAdmin ? "sm:grid-cols-3" : ""}`}>
            <button
              type="button"
              className="btn-secondary"
              disabled={saving || isLocked}
              onClick={onSave}
            >
              {saving ? "Saving..." : "Save"}
            </button>
            {canAdmin && (
              <button
                type="button"
                className="btn-secondary"
                disabled={reprocessing || isPolling || isExported}
                onClick={onReprocess}
              >
                {reprocessing ? "Queueing..." : isPolling ? "Processing..." : "Reprocess"}
              </button>
            )}
            {canAdmin && (
              <button
                type="button"
                className="btn-primary"
                disabled={approving || blocking || isExported || isReviewed || !canApprove}
                onClick={onApprove}
                title={
                  blocking
                    ? "Fix errors before approving"
                    : isReviewed
                    ? "Already approved"
                    : !canApprove
                    ? "Document must be extracted or marked needs review before approving"
                    : ""
                }
              >
                {approving ? "Approving..." : isReviewed ? "Approved" : "Approve"}
              </button>
            )}
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
                          disabled={isLocked}
                          onChange={(e) => onTransactionChange(idx, "date", e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className="field text-xs"
                          value={txn.narration}
                          disabled={isLocked}
                          onChange={(e) => onTransactionChange(idx, "narration", e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className="field text-xs w-full text-right"
                          inputMode="decimal"
                          value={txn.debit}
                          disabled={isLocked}
                          onChange={(e) => onTransactionChange(idx, "debit", e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className="field text-xs w-full text-right"
                          inputMode="decimal"
                          value={txn.credit}
                          disabled={isLocked}
                          onChange={(e) => onTransactionChange(idx, "credit", e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className="field text-xs w-full text-right"
                          inputMode="decimal"
                          value={txn.balance}
                          disabled={isLocked}
                          onChange={(e) => onTransactionChange(idx, "balance", e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className="field text-xs w-full"
                          value={txn.reference}
                          disabled={isLocked}
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
                            disabled={isLocked}
                            onChange={(e) => onLineItemChange(idx, "description", e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            className="field text-xs w-full"
                            inputMode="decimal"
                            value={item.quantity}
                            disabled={isLocked}
                            onChange={(e) => onLineItemChange(idx, "quantity", e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            className="field text-xs w-full"
                            inputMode="decimal"
                            value={item.unit_price}
                            disabled={isLocked}
                            onChange={(e) => onLineItemChange(idx, "unit_price", e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            className="field text-xs w-full"
                            inputMode="decimal"
                            value={item.total}
                            disabled={isLocked}
                            onChange={(e) => onLineItemChange(idx, "total", e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            className="field text-xs w-full"
                            value={item.hsn_code}
                            disabled={isLocked}
                            onChange={(e) => onLineItemChange(idx, "hsn_code", e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            className="field text-xs w-full"
                            value={item.uom}
                            placeholder="PCS"
                            disabled={isLocked}
                            onChange={(e) => onLineItemChange(idx, "uom", e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-2 bg-mint-500/5">
                          <input
                            className="field text-xs w-full border-mint-300 focus:border-mint-500 focus:ring-mint-500/20"
                            value={item.tally_item_name}
                            disabled={isLocked}
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
