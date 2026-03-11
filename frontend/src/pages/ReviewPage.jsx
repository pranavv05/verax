import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { z } from "zod";
import AppShell from "../components/layout/AppShell";
import LoadingState from "../components/ui/LoadingState";
import StatusBadge from "../components/ui/StatusBadge";
import { documentsApi } from "../api/documents-api";
import { extractionsApi } from "../api/extractions-api";
import { parseApiError } from "../lib/utils";

const extractionSchema = z.object({
  vendor_name: z.string().nullable(),
  vendor_gstin: z.string().nullable(),
  invoice_number: z.string().nullable(),
  invoice_date: z.string().nullable(),
  subtotal: z.union([z.string(), z.number()]).nullable(),
  tax_amount: z.union([z.string(), z.number()]).nullable(),
  total_amount: z.union([z.string(), z.number()]).nullable(),
  payment_terms: z.string().nullable(),
  line_items: z.array(
    z.object({
      description: z.string().nullable().optional(),
      quantity: z.union([z.number(), z.string()]).nullable().optional(),
      unit_price: z.union([z.number(), z.string()]).nullable().optional(),
      total: z.union([z.number(), z.string()]).nullable().optional()
    })
  )
});

const initialForm = {
  vendor_name: "",
  vendor_gstin: "",
  invoice_number: "",
  invoice_date: "",
  subtotal: "",
  tax_amount: "",
  total_amount: "",
  payment_terms: "",
  line_items: "[]"
};

const textFields = [
  ["vendor_name", "Vendor name"],
  ["vendor_gstin", "Vendor GSTIN"],
  ["invoice_number", "Invoice number"],
  ["invoice_date", "Invoice date"],
  ["subtotal", "Subtotal"],
  ["tax_amount", "Tax amount"],
  ["total_amount", "Total amount"],
  ["payment_terms", "Payment terms"]
];

const ReviewPage = () => {
  const { doc_id: documentId } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [document, setDocument] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [confidence, setConfidence] = useState(0);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const loadData = async () => {
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
        const payload = extractionResult.value?.structured_data || extractionResult.value?.structuredData || {};
        setConfidence(extractionResult.value?.confidence_score || extractionResult.value?.confidenceScore || 0);
        setForm({
          vendor_name: payload.vendor_name || "",
          vendor_gstin: payload.vendor_gstin || "",
          invoice_number: payload.invoice_number || "",
          invoice_date: payload.invoice_date || "",
          subtotal: payload.subtotal ?? "",
          tax_amount: payload.tax_amount ?? "",
          total_amount: payload.total_amount ?? "",
          payment_terms: payload.payment_terms || "",
          line_items: JSON.stringify(payload.line_items || [], null, 2)
        });
      }

      if (docResult.status === "rejected" && extractionResult.status === "rejected") {
        setError("Review data endpoint is not available yet.");
      }
    } catch (loadError) {
      setError(parseApiError(loadError, "Unable to load review data"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [documentId]);

  const buildPayload = () => {
    const parsedLineItems = JSON.parse(form.line_items || "[]");
    const payload = {
      vendor_name: form.vendor_name || null,
      vendor_gstin: form.vendor_gstin || null,
      invoice_number: form.invoice_number || null,
      invoice_date: form.invoice_date || null,
      subtotal: form.subtotal === "" ? null : form.subtotal,
      tax_amount: form.tax_amount === "" ? null : form.tax_amount,
      total_amount: form.total_amount === "" ? null : form.total_amount,
      payment_terms: form.payment_terms || null,
      line_items: parsedLineItems
    };
    const validation = extractionSchema.safeParse(payload);
    if (!validation.success) {
      throw new Error(validation.error.issues[0]?.message || "Invalid extraction payload");
    }
    return validation.data;
  };

  const onSave = async () => {
    setSaving(true);
    setToast("");
    setError("");
    try {
      const payload = buildPayload();
      await extractionsApi.update(documentId, payload);
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
      await onSave();
      await extractionsApi.approve(documentId);
      setToast("Extraction approved successfully.");
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
      setToast("Reprocess request queued.");
    } catch (reprocessError) {
      setError(parseApiError(reprocessError, "Unable to reprocess document"));
    } finally {
      setReprocessing(false);
    }
  };

  const lowConfidence = confidence < 0.8;

  const previewUrl = useMemo(
    () => document?.preview_url || document?.download_url || document?.downloadUrl || "",
    [document]
  );

  const previewNode = previewUrl ? (
    previewUrl.toLowerCase().includes(".pdf") ? (
      <iframe title="Document preview" src={previewUrl} className="h-[70vh] w-full rounded-lg border border-[#e3d7c3]" />
    ) : (
      <img src={previewUrl} alt="Uploaded document" className="max-h-[70vh] w-full rounded-lg border border-[#e3d7c3] object-contain" />
    )
  ) : (
    <div className="flex h-[70vh] items-center justify-center rounded-lg border border-dashed border-[#d8c8a8] bg-sand-50 text-sm text-[#74849a]">
      Preview URL unavailable. Ensure document metadata endpoint returns `download_url`.
    </div>
  );

  return (
    <AppShell
      title="Extraction Review"
      subtitle="Verify AI output against the original document before approving export-ready entries."
    >
      {loading ? <LoadingState message="Loading document review..." /> : null}

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

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-ink-900">Original document</h2>
            <StatusBadge status={document?.status || "uploaded"} />
          </div>
          {previewNode}
        </article>

        <article className="panel p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-ink-900">Extracted fields</h2>
            <div
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                lowConfidence
                  ? "bg-amber-100 text-amber-700"
                  : "bg-mint-500/10 text-mint-700"
              }`}
            >
              Confidence {Math.round(Number(confidence || 0) * 100)}%
            </div>
          </div>

          <div className="space-y-3">
            {textFields.map(([key, label]) => (
              <div key={key}>
                <label className="label">{label}</label>
                <input
                  className={`field ${lowConfidence && !form[key] ? "bg-amber-50" : ""}`}
                  value={form[key]}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      [key]: event.target.value
                    }))
                  }
                />
              </div>
            ))}

            <div>
              <label className="label">Line items (JSON)</label>
              <textarea
                className={`field min-h-[160px] font-mono text-xs ${lowConfidence ? "bg-amber-50" : ""}`}
                value={form.line_items}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    line_items: event.target.value
                  }))
                }
              />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button type="button" className="btn-secondary" disabled={saving} onClick={onSave}>
              {saving ? "Saving..." : "Save"}
            </button>
            <button type="button" className="btn-secondary" disabled={reprocessing} onClick={onReprocess}>
              {reprocessing ? "Queueing..." : "Reprocess"}
            </button>
            <button type="button" className="btn-primary" disabled={approving} onClick={onApprove}>
              {approving ? "Approving..." : "Approve"}
            </button>
          </div>
        </article>
      </section>
    </AppShell>
  );
};

export default ReviewPage;
