import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import { ReviewSkeleton } from "../components/ui/skeletons";
import StatusBadge from "../components/ui/StatusBadge";
import Drawer from "../components/ui/Drawer";
import { Spinner } from "../components/ui/LoadingState";
import { TableScroll } from "../components/app/TableKit";
import { Alert, Badge, Breadcrumbs, Card, CardHeader, Dot, Progress, SectionLabel } from "../components/app/primitives";
import {
  IconCheck,
  IconExport,
  IconEye,
  IconFile,
  IconHistory,
  IconLock,
  IconPlus,
  IconRefresh,
  IconTrash
} from "../components/app/icons";
import { documentsApi } from "../api/documents-api";
import { clientsApi } from "../api/clients-api";
import { extractionsApi } from "../api/extractions-api";
import { complianceApi } from "../api/compliance-api";
import { documentVersionsApi } from "../api/document-versions-api";
import { useAuth } from "../contexts/AuthContext";
import { cn, parseApiError, triggerFileDownload } from "../lib/utils";
import { isAdmin } from "../utils/permissions";

/* ─── field configs by doc type ────────────────────────────────────────────── */

const INVOICE_FIELDS = [
  ["vendor_name", "Vendor / party name"],
  ["vendor_gstin", "Vendor GSTIN"],
  ["invoice_number", "Invoice number"],
  ["invoice_date", "Invoice date"],
  ["subtotal", "Taxable amount"],
  ["cgst", "CGST"],
  ["sgst", "SGST"],
  ["igst", "IGST"],
  ["tax_amount", "Total tax"],
  ["total_amount", "Invoice total"],
  ["payment_terms", "Payment terms"],
  ["tds_section", "TDS section"],
  ["tds_rate", "TDS rate (%)"],
  ["tds_amount", "TDS amount"]
];

const BANK_FIELDS = [
  ["account_holder", "Account holder"],
  ["account_number", "Account number"],
  ["bank_name", "Bank"],
  ["ifsc_code", "IFSC code"],
  ["statement_period_from", "Period from"],
  ["statement_period_to", "Period to"],
  ["opening_balance", "Opening balance (₹)"],
  ["closing_balance", "Closing balance (₹)"]
];

const getHeaderFields = (docType) =>
  docType === "bank_statement" ? BANK_FIELDS : INVOICE_FIELDS;

// How the review form is sectioned. Keys must exist in the field lists above.
const INVOICE_GROUPS = [
  { title: "Party", fields: ["vendor_name", "vendor_gstin"] },
  { title: "Invoice", fields: ["invoice_number", "invoice_date", "payment_terms"] },
  { title: "Amounts", fields: ["subtotal", "cgst", "sgst", "igst", "tax_amount", "total_amount"] },
  { title: "TDS", fields: ["tds_section", "tds_rate", "tds_amount"] }
];

const BANK_GROUPS = [
  { title: "Account", fields: ["account_holder", "bank_name", "account_number", "ifsc_code"] },
  { title: "Period and balances", fields: ["statement_period_from", "statement_period_to", "opening_balance", "closing_balance"] }
];

const DOC_TYPE_LABEL = { invoice: "Invoice", bill: "Bill", bank_statement: "Bank statement", other: "Document" };

const REASON_TONE = { pre_edit: "neutral", pre_approval: "accent", reprocess: "warn" };

const confidenceTone = (confidence) => {
  const percentage = Math.round(Number(confidence || 0) * 100);
  if (percentage >= 80) return { text: "text-ui-ok", tone: "ok", progress: "ok" };
  if (percentage >= 40) return { text: "text-ui-warn", tone: "warn", progress: "warn" };
  return { text: "text-ui-err", tone: "err", progress: "warn" };
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
  if (status === "matched") return { label: "Matches GSTR-2B", tone: "ok" };
  if (status === "partial") return { label: "Partial match", tone: "warn" };
  if (status === "not_found") return { label: "Not in GSTR-2B", tone: "err" };
  if (status === "mismatch") return { label: "Mismatch", tone: "err" };
  if (status === "unavailable") return { label: "GSP unavailable", tone: "neutral" };
  return { label: "Not verified", tone: "neutral" };
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
  ["invoice_number", "Invoice number"],
  ["invoice_date", "Invoice date"],
  ["vendor_name", "Supplier"],
  ["vendor_gstin", "Supplier GSTIN"],
  ["taxable_amount", "Taxable amount"],
  ["tax_amount", "GST amount"],
  ["total_amount", "Total"]
];

const reasonLabel = (reason) =>
  ({
    pre_edit: "Before edit",
    pre_approval: "Before approval",
    reprocess: "Before reprocess"
  }[reason] || reason);

const reasonClass = (reason) =>
  ({
    pre_edit: "bg-ui-inset text-ui-fg-3",
    pre_approval: "bg-ui-accent/10 text-ui-accent-text",
    reprocess: "bg-ui-warn/10 text-ui-warn"
  }[reason] || "bg-ui-inset text-ui-fg-3");

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


// Mirrors the backend worker: a document is retried automatically up to 3
// times (BullMQ attempts), and processing_attempts is reset on Reprocess. A
// failed attempt puts the document back to "uploaded" with processingError set,
// so "uploaded + error + attempts >= 3" means every automatic retry failed.
const MAX_PROCESSING_ATTEMPTS = 3;
const hasPermanentlyFailed = (doc) =>
  doc?.status === "uploaded" &&
  Boolean(doc?.processingError) &&
  Number(doc?.processingAttempts || 0) >= MAX_PROCESSING_ATTEMPTS;

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
  const [clientLabel, setClientLabel] = useState("");

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

  // The document only carries its client id; fetch the name for the breadcrumb.
  const docClientId = document?.clientId || document?.client_id;
  useEffect(() => {
    if (!docClientId || document?.clientName || document?.client_name) return undefined;
    let active = true;
    clientsApi
      .getById(docClientId)
      .then((client) => active && setClientLabel(client?.name || ""))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [docClientId, document?.clientName, document?.client_name]);

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

        if (doc.status === "failed" || hasPermanentlyFailed(doc)) {
          stopPolling();
          setIsPolling(false);
          setPollError(
            doc.processingError
              ? `Processing failed: ${doc.processingError}`
              : "Processing failed. Please try again."
          );
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
  const docTypeMismatchWarning = structuredData?._doc_type_mismatch_warning || "";
  const transactionsWarning = structuredData?._transactions_warning || "";
  const lowConfidenceFields = Array.isArray(structuredData?.low_confidence_fields)
    ? structuredData.low_confidence_fields
    : [];
  const blocking = hasBlockingErrors(validation);
  const isExported = document?.status === "exported";
  const isReviewed = document?.status === "reviewed";
  const isLocked = isExported || isReviewed;
  const processingFailed = hasPermanentlyFailed(document);
  const processingRetrying =
    document?.status === "uploaded" && Boolean(document?.processingError) && !processingFailed;
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
      <iframe title="Document preview" src={previewUrl} className="absolute inset-0 h-full w-full bg-white" />
    ) : (
      <img
        src={previewUrl}
        alt="Uploaded document"
        className="absolute inset-0 h-full w-full object-contain p-4 drop-shadow-[0_10px_30px_rgba(14,16,19,0.18)]"
      />
    )
  ) : (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center text-[0.8125rem] text-ui-fg-3">
      <IconFile size={22} className="text-ui-fg-4" />
      Preview not available. The document may still be processing.
    </div>
  );

  /* ─── render ─── */

  const fileName = document?.fileName || document?.file_name || "Document";
  const clientId = document?.clientId || document?.client_id;
  const clientName = document?.clientName || document?.client_name || clientLabel;
  const fieldLabel = Object.fromEntries(headerFields);
  const fieldGroups = (isBankStatement ? BANK_GROUPS : INVOICE_GROUPS).map((group) => ({
    ...group,
    fields: group.fields.filter((key) => fieldLabel[key])
  }));
  const gstBadge = getGstBadge(gstMatch?.matchStatus);
  const qualityWarnings = [
    taxMathWarning && { tone: "warn", title: "Tax maths doesn't add up — check the amounts", body: taxMathWarning },
    pageTruncationWarning && { tone: "err", title: "Some pages weren't processed", body: pageTruncationWarning },
    transactionsWarning && { tone: "err", title: "Transactions may be missing", body: transactionsWarning },
    docTypeMismatchWarning && { tone: "warn", title: "This may not be the document type it was uploaded as", body: docTypeMismatchWarning }
  ].filter(Boolean);

  const cellInput = "field h-8 rounded-md px-2 py-1 text-xs shadow-none";

  const renderField = (key) => {
    const label = fieldLabel[key];
    const fv = getFieldValidation(validation, key);
    const isGstinField = key === "vendor_gstin";
    const fieldNeedsReview = isMissingExtractedField(key) || isLowConfidenceField(key);
    const wide = ["vendor_name", "vendor_gstin", "account_holder", "bank_name"].includes(key);
    const mono = ["vendor_gstin", "invoice_number", "account_number", "ifsc_code"].includes(key);
    const numeric = /amount|subtotal|cgst|sgst|igst|balance|rate/.test(key);
    return (
      <div key={key} className={wide ? "sm:col-span-2" : ""}>
        <label className="mb-1.5 flex items-center justify-between gap-2 text-xs font-medium text-ui-fg-3" htmlFor={`field-${key}`}>
          {label}
          {fieldNeedsReview ? (
            <span className="inline-flex items-center gap-1 text-ui-err">
              <Dot tone="err" /> Check
            </span>
          ) : null}
        </label>
        <input
          id={`field-${key}`}
          className={cn(
            "field",
            mono && "ui-mono",
            numeric && "text-right tabular-nums",
            fieldNeedsReview && "border-ui-err/40 bg-ui-err/[0.04]",
            lowConfidence && !form[key] && !fieldNeedsReview && "bg-ui-warn/[0.05]",
            fv?.severity === "error" ? "border-ui-err/60" : fv ? "border-ui-warn/50" : ""
          )}
          value={form[key] ?? ""}
          disabled={isLocked}
          onChange={(e) => onFieldChange(key, e.target.value)}
        />
        {fieldNeedsReview ? <p className="mt-1 text-xs font-medium text-ui-err">Verify this field before approving.</p> : null}
        {isGstinField ? (
          <div className="mt-2 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={gstBadge.tone} dot>
                {gstChecking ? "Checking…" : gstBadge.label}
              </Badge>
              {canAdmin ? (
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  disabled={gstChecking || isExported || !form.vendor_gstin}
                  title={!form.vendor_gstin ? "No GSTIN found in document" : ""}
                  onClick={onVerifyGst}
                >
                  <IconRefresh size={12} />
                  {gstChecking ? "Verifying…" : "Verify against GSTR-2B"}
                </button>
              ) : null}
              {gstMatch?.mismatchFields?.length > 0 ? (
                <button type="button" className="link-action text-xs" onClick={() => setGstDetailsOpen((prev) => !prev)}>
                  {gstDetailsOpen ? "Hide details" : "Show details"}
                </button>
              ) : null}
            </div>
            {gstDetailsOpen && gstMatch?.mismatchFields?.length > 0 ? (
              <div className="overflow-hidden rounded-lg border border-ui-warn/25">
                <table className="ui-table text-xs">
                  <thead>
                    <tr>
                      <th>Field</th>
                      <th>On the document</th>
                      <th>In GSTR-2B</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gstMatch.mismatchFields.map((field) => (
                      <tr key={field}>
                        <td className="font-medium text-ui-fg">{formatMismatchField(field)}</td>
                        <td className="ui-mono">{getExtractedMismatchValue(form, field)}</td>
                        <td className="ui-mono text-ui-warn">{getRecordValue(gstMatch.gstr2bRecord, field)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ) : null}
        {fv?.message ? (
          <p className={cn("mt-1 text-xs font-medium", fv.severity === "error" ? "text-ui-err" : "text-ui-warn")}>
            {fv.severity === "error" ? "Error: " : "Warning: "}
            {fv.message}
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <AppShell width="wide">
      <Drawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title="Edit history"
        subtitle={fileName}
        widthClassName="max-w-4xl"
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.5fr)]">
          <section>
            {versions.length === 0 ? (
              <p className="py-8 text-center text-[0.8125rem] text-ui-fg-3">No edit history yet.</p>
            ) : (
              <ol className="space-y-1.5">
                {versions.map((version) => (
                  <li key={version.id}>
                    <button
                      type="button"
                      className={cn(
                        "w-full rounded-lg border px-3 py-2.5 text-left transition-colors",
                        selectedVersion?.id === version.id
                          ? "border-ui-accent/40 bg-ui-accent/[0.06]"
                          : "border-ui-line hover:bg-ui-subtle"
                      )}
                      onClick={() => selectVersion(version)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[0.8125rem] font-semibold text-ui-fg">v{version.versionNumber}</span>
                        <Badge tone={REASON_TONE[version.snapshotReason] || "neutral"}>{reasonLabel(version.snapshotReason)}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-ui-fg-3">
                        {version.createdByName || "System"} · {relativeTime(version.createdAt)}
                      </p>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="rounded-xl border border-ui-line">
            {versionLoading ? (
              <p className="py-10 text-center text-[0.8125rem] text-ui-fg-3">Loading version…</p>
            ) : versionError ? (
              <div className="p-4">
                <Alert tone="err">{versionError}</Alert>
              </div>
            ) : selectedVersion ? (
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>Field</th>
                    <th>v{selectedVersion.versionNumber}</th>
                    <th>Now</th>
                  </tr>
                </thead>
                <tbody>
                  {HISTORY_FIELDS.map(([key, label]) => {
                    const oldValue = normalizeValue(selectedVersion.extractedData?.[key]);
                    const newValue = normalizeValue(currentStructuredData?.[key]);
                    const changed = oldValue !== newValue;
                    return (
                      <tr key={key}>
                        <td className="whitespace-nowrap text-xs text-ui-fg-3">{label}</td>
                        <td className={cn(changed && "text-ui-err line-through decoration-ui-err/40")}>{oldValue}</td>
                        <td className={cn(changed ? "font-medium text-ui-ok" : "text-ui-fg")}>{newValue}</td>
                      </tr>
                    );
                  })}
                  {(() => {
                    const oldCount = Array.isArray(selectedVersion.extractedData?.line_items)
                      ? selectedVersion.extractedData.line_items.length
                      : 0;
                    const newCount = Array.isArray(currentStructuredData?.line_items) ? currentStructuredData.line_items.length : 0;
                    const changed = oldCount !== newCount;
                    return (
                      <tr>
                        <td className="whitespace-nowrap text-xs text-ui-fg-3">Line items</td>
                        <td className={cn(changed && "text-ui-err line-through decoration-ui-err/40")}>{oldCount} items</td>
                        <td className={cn(changed ? "font-medium text-ui-ok" : "text-ui-fg")}>{newCount} items</td>
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
            ) : (
              <p className="py-10 text-center text-[0.8125rem] text-ui-fg-3">Select a version to compare.</p>
            )}
          </section>
        </div>
      </Drawer>

      <Breadcrumbs
        items={[
          { label: "Clients", to: "/clients" },
          ...(clientId ? [{ label: clientName || "Client", to: `/clients/${clientId}/documents` }] : []),
          { label: fileName }
        ]}
        className="mb-4"
      />

      {/* Sticky review bar: what this is, how sure Verax is, and what you can do. */}
      <div className="sticky top-14 z-30 -mx-4 mb-5 border-b border-ui-line bg-ui-canvas/85 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-ui-line bg-ui-surface text-ui-fg-3 shadow-ui-card">
              <IconFile size={16} />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-[1.0625rem] font-semibold tracking-[-0.02em] text-ui-fg">{fileName}</h1>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ui-fg-3">
                <span>{DOC_TYPE_LABEL[docType] || "Document"}</span>
                <span aria-hidden="true">·</span>
                <StatusBadge status={document?.status || "uploaded"} />
                {extractionReady ? (
                  <Badge tone={confidenceStyle.tone}>Confidence {confidencePercent}%</Badge>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {versions.length > 0 ? (
              <button type="button" className="btn-ghost" onClick={openHistory}>
                <IconHistory size={14} />
                History
              </button>
            ) : null}
            <button type="button" className="btn-secondary" disabled={saving || isLocked} onClick={onSave}>
              {saving ? "Saving…" : "Save"}
            </button>
            {canAdmin ? (
              <button type="button" className="btn-secondary" disabled={reprocessing || isPolling || isExported} onClick={onReprocess}>
                <IconRefresh size={14} />
                {reprocessing ? "Queueing…" : isPolling ? "Processing…" : "Reprocess"}
              </button>
            ) : null}
            {canAdmin ? (
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
                <IconCheck size={14} />
                {approving ? "Approving…" : isReviewed ? "Approved" : "Approve"}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {loading ? <ReviewSkeleton /> : null}

      <div className="space-y-3 empty:hidden [&:not(:empty)]:mb-5">
        {error ? <Alert tone="err">{error}</Alert> : null}
        {toast ? (
          <Alert tone="ok" onDismiss={() => setToast("")}>
            {toast}
          </Alert>
        ) : null}
        {pollError ? <Alert tone="err">{pollError}</Alert> : null}

        {isPolling ? (
          <div role="status" className="flex items-center gap-3 rounded-xl border border-ui-info/20 bg-ui-info/[0.06] px-4 py-3 text-[0.8125rem] text-ui-info">
            <Spinner />
            <div>
              <p className="font-medium">Processing document…</p>
              <p className="text-ui-fg-3">This usually takes 30–60 seconds.</p>
            </div>
          </div>
        ) : null}

        {/* Processing failure banner — the reason comes from documents.processing_error */}
        {!loading && !error && !isPolling && (processingFailed || processingRetrying) ? (
          <div
            role="alert"
            className={cn(
              "rounded-xl border px-4 py-3 text-[0.8125rem]",
              processingFailed ? "border-ui-err/20 bg-ui-err/[0.06] text-ui-err" : "border-ui-warn/25 bg-ui-warn/[0.07] text-ui-warn"
            )}
          >
            <p className="font-medium">
              {processingFailed
                ? "Processing failed after all automatic retries."
                : "The last processing attempt failed — retrying automatically."}
            </p>
            <p className="mt-1 break-words text-ui-fg-2">Reason: {document.processingError}</p>
            {processingFailed ? (
              <p className="mt-1 text-ui-fg-2">
                {canAdmin ? "Use Reprocess to try again." : "Ask a firm admin to reprocess this document."}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Not yet processed banner */}
        {!loading && !error && !isPolling && !extractionReady && extractionMessage ? (
          <Alert tone="info" title={extractionMessage}>
            {document && ["uploaded", "processing"].includes(document.status) && !processingFailed ? (
              <span>
                Current status: <strong>{document.status}</strong>. Refresh the page in a few moments.
              </span>
            ) : null}
          </Alert>
        ) : null}

        {validation?.duplicate?.isDuplicate ? (
          <Alert
            tone="warn"
            title="Possible duplicate"
            action={
              validation.duplicate.existingDocumentId ? (
                <Link to={`/review/${validation.duplicate.existingDocumentId}`} className="link-action shrink-0 text-xs">
                  View original
                </Link>
              ) : null
            }
          >
            {validation.duplicate.message}
          </Alert>
        ) : null}

        {document?.status === "review_required" ? (
          <Alert tone="warn" title="Flagged during processing">
            Low confidence or an unexpected document type. Fields marked “Check” had low confidence — verify them before approving.
          </Alert>
        ) : null}
      </div>

      {!loading ? (
        <>
          <section className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
            {/* Left: the original, pinned while you work through the fields. */}
            <Card className="flex flex-col overflow-hidden lg:sticky lg:top-[8.5rem] lg:h-[calc(100vh-10rem)]">
              <div className="flex items-center justify-between gap-3 border-b border-ui-line px-4 py-2.5">
                <p className="flex items-center gap-2 text-[0.8125rem] font-medium text-ui-fg-2">
                  <IconEye size={14} className="text-ui-fg-4" />
                  Original
                </p>
                {previewUrl ? (
                  <button type="button" onClick={handleDownloadOriginal} disabled={downloading} className="btn-ghost btn-sm">
                    <IconExport size={13} />
                    {downloading ? "Downloading…" : "Download"}
                  </button>
                ) : null}
              </div>
              {downloadError ? <p className="px-4 pt-2 text-xs font-medium text-ui-err">{downloadError}</p> : null}
              <div className="relative min-h-[60vh] flex-1 bg-ui-inset lg:min-h-0">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 opacity-60"
                  style={{
                    backgroundImage: "radial-gradient(rgb(var(--ui-fg) / 0.07) 1px, transparent 1px)",
                    backgroundSize: "16px 16px"
                  }}
                />
                {previewNode}
              </div>
            </Card>

            {/* Right: what Verax read. */}
            <div className="grid grid-cols-1 content-start gap-5">
              {showConfidencePanel ? (
                <Card>
                  <div className="px-5 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[0.8125rem] font-medium text-ui-fg-2">Extraction confidence</p>
                      <p className={cn("text-[0.8125rem] font-semibold tabular-nums", confidenceStyle.text)}>{confidencePercent}%</p>
                    </div>
                    <Progress value={confidencePercent} tone={confidenceStyle.progress} className="mt-2.5" label="Extraction confidence" />
                    {lowConfidenceFields.length > 0 ? (
                      <p className="mt-2.5 text-xs text-ui-fg-3">
                        {lowConfidenceFields.length} field{lowConfidenceFields.length === 1 ? "" : "s"} to check are marked below.
                      </p>
                    ) : null}
                  </div>
                  {qualityWarnings.length > 0 ? (
                    <div className="space-y-2 border-t border-ui-line px-5 py-4">
                      {qualityWarnings.map((warning) => (
                        <Alert key={warning.title} tone={warning.tone} title={warning.title}>
                          {warning.body}
                        </Alert>
                      ))}
                    </div>
                  ) : null}
                </Card>
              ) : null}

              <Card className="relative">
                <CardHeader
                  title="Extracted fields"
                  description={isLocked ? "Locked — this document has been approved." : "Correct anything Verax misread, then approve."}
                  action={isLocked ? <IconLock size={15} className="text-ui-fg-4" /> : null}
                />
                {isPolling ? (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-xl bg-ui-surface/80 backdrop-blur-sm">
                    <Spinner size={24} />
                    <p className="text-[0.8125rem] font-medium text-ui-fg-2">Reading the document again…</p>
                  </div>
                ) : null}
                <div className={cn("divide-y divide-ui-line", isPolling && "pointer-events-none opacity-40")}>
                  {fieldGroups.map((group) => (
                    <fieldset key={group.title} className="px-5 py-5">
                      <legend className="sr-only">{group.title}</legend>
                      <SectionLabel className="mb-3.5">{group.title}</SectionLabel>
                      <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">{group.fields.map(renderField)}</div>
                    </fieldset>
                  ))}
                </div>
                {validation?.tds && !validation.tds.valid && validation.tds.message ? (
                  <div className="border-t border-ui-line px-5 py-4">
                    <Alert tone="warn">TDS: {validation.tds.message}</Alert>
                  </div>
                ) : null}
              </Card>
            </div>
          </section>

          {isBankStatement ? (
            <Card className="mt-5 overflow-hidden">
              <CardHeader
                title="Transactions"
                description={`${transactions.length} ${transactions.length === 1 ? "entry" : "entries"} read from the statement.`}
                action={
                  !isExported ? (
                    <button type="button" className="btn-secondary btn-sm" onClick={addTransaction}>
                      <IconPlus size={13} />
                      Add row
                    </button>
                  ) : null
                }
              />
              {transactions.length === 0 ? (
                <p className="px-5 py-8 text-center text-[0.8125rem] text-ui-fg-3">
                  No transactions extracted. Add rows manually or reprocess the document.
                </p>
              ) : (
                <TableScroll>
                  <table className="ui-table [&_td]:px-2 [&_td]:py-1.5 [&_th]:px-2">
                    <thead>
                      <tr>
                        <th className="w-10 !pl-4">#</th>
                        <th className="w-36">Date</th>
                        <th>Narration</th>
                        <th className="w-28 text-right">Debit (₹)</th>
                        <th className="w-28 text-right">Credit (₹)</th>
                        <th className="w-28 text-right">Balance (₹)</th>
                        <th className="w-28">Reference</th>
                        <th className="w-10">
                          <span className="sr-only">Remove</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((txn, idx) => (
                        <tr key={idx}>
                          <td className="!pl-4 font-mono text-xs text-ui-fg-4">{idx + 1}</td>
                          <td>
                            <input className={cellInput} type="date" value={txn.date} disabled={isLocked} onChange={(e) => onTransactionChange(idx, "date", e.target.value)} />
                          </td>
                          <td>
                            <input className={cellInput} value={txn.narration} disabled={isLocked} onChange={(e) => onTransactionChange(idx, "narration", e.target.value)} />
                          </td>
                          <td>
                            <input className={cn(cellInput, "text-right tabular-nums")} inputMode="decimal" value={txn.debit} disabled={isLocked} onChange={(e) => onTransactionChange(idx, "debit", e.target.value)} />
                          </td>
                          <td>
                            <input className={cn(cellInput, "text-right tabular-nums")} inputMode="decimal" value={txn.credit} disabled={isLocked} onChange={(e) => onTransactionChange(idx, "credit", e.target.value)} />
                          </td>
                          <td>
                            <input className={cn(cellInput, "text-right tabular-nums")} inputMode="decimal" value={txn.balance} disabled={isLocked} onChange={(e) => onTransactionChange(idx, "balance", e.target.value)} />
                          </td>
                          <td>
                            <input className={cellInput} value={txn.reference} disabled={isLocked} onChange={(e) => onTransactionChange(idx, "reference", e.target.value)} />
                          </td>
                          <td className="text-center">
                            {!isExported ? (
                              <button type="button" className="btn-icon h-7 w-7 hover:text-ui-err" aria-label={`Remove row ${idx + 1}`} onClick={() => removeTransaction(idx)}>
                                <IconTrash size={13} />
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableScroll>
              )}
            </Card>
          ) : (
            <Card className="mt-5 overflow-hidden">
              <CardHeader
                title="Line items"
                description={`${lineItems.length} ${lineItems.length === 1 ? "item" : "items"}. The Tally item name is what lands in your books — Verax remembers it next time.`}
                action={
                  !isExported ? (
                    <button type="button" className="btn-secondary btn-sm" onClick={addLineItem}>
                      <IconPlus size={13} />
                      Add row
                    </button>
                  ) : null
                }
              />
              {lineItems.length === 0 ? (
                <p className="px-5 py-8 text-center text-[0.8125rem] text-ui-fg-3">
                  No line items extracted. Add rows manually or reprocess the document.
                </p>
              ) : (
                <TableScroll>
                  <table className="ui-table [&_td]:px-2 [&_td]:py-1.5 [&_th]:px-2">
                    <thead>
                      <tr>
                        <th className="w-10 !pl-4">#</th>
                        <th className="min-w-[14rem]">Description</th>
                        <th className="w-20 text-right">Qty</th>
                        <th className="w-24 text-right">Rate</th>
                        <th className="w-28 text-right">Amount</th>
                        <th className="w-24">HSN</th>
                        <th className="w-20">UOM</th>
                        <th className="min-w-[13rem] !bg-ui-accent/[0.05] !text-ui-accent-text">Tally item name</th>
                        <th className="w-10">
                          <span className="sr-only">Remove</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineItems.map((item, idx) => {
                        const datalistId = `suggestions-${idx}`;
                        return (
                          <tr key={idx}>
                            <td className="!pl-4 font-mono text-xs text-ui-fg-4">{idx + 1}</td>
                            <td>
                              <input className={cellInput} value={item.description} disabled={isLocked} onChange={(e) => onLineItemChange(idx, "description", e.target.value)} />
                            </td>
                            <td>
                              <input className={cn(cellInput, "text-right tabular-nums")} inputMode="decimal" value={item.quantity} disabled={isLocked} onChange={(e) => onLineItemChange(idx, "quantity", e.target.value)} />
                            </td>
                            <td>
                              <input className={cn(cellInput, "text-right tabular-nums")} inputMode="decimal" value={item.unit_price} disabled={isLocked} onChange={(e) => onLineItemChange(idx, "unit_price", e.target.value)} />
                            </td>
                            <td>
                              <input className={cn(cellInput, "text-right tabular-nums")} inputMode="decimal" value={item.total} disabled={isLocked} onChange={(e) => onLineItemChange(idx, "total", e.target.value)} />
                            </td>
                            <td>
                              <input className={cn(cellInput, "ui-mono")} value={item.hsn_code} disabled={isLocked} onChange={(e) => onLineItemChange(idx, "hsn_code", e.target.value)} />
                            </td>
                            <td>
                              <input className={cellInput} value={item.uom} placeholder="PCS" disabled={isLocked} onChange={(e) => onLineItemChange(idx, "uom", e.target.value)} />
                            </td>
                            <td className="bg-ui-accent/[0.03]">
                              <input
                                className={cn(cellInput, "border-ui-accent/30")}
                                value={item.tally_item_name}
                                disabled={isLocked}
                                list={datalistId}
                                placeholder="Mapped name…"
                                onChange={(e) => onLineItemChange(idx, "tally_item_name", e.target.value)}
                              />
                              {item.suggestions?.length > 0 ? (
                                <datalist id={datalistId}>
                                  {item.suggestions.map((s, si) => (
                                    <option key={si} value={s} />
                                  ))}
                                </datalist>
                              ) : null}
                            </td>
                            <td className="text-center">
                              {!isExported ? (
                                <button type="button" className="btn-icon h-7 w-7 hover:text-ui-err" aria-label={`Remove row ${idx + 1}`} onClick={() => removeLineItem(idx)}>
                                  <IconTrash size={13} />
                                </button>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </TableScroll>
              )}
            </Card>
          )}
        </>
      ) : null}
    </AppShell>
  );
};

export default ReviewPage;
