import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import AppShell from "../components/layout/AppShell";
import EmptyState from "../components/ui/EmptyState";
import { ClientDetailSkeleton } from "../components/ui/skeletons";
import StatCard from "../components/ui/StatCard";
import StatusBadge from "../components/ui/StatusBadge";
import { clientsApi } from "../api/clients-api";
import { complianceApi } from "../api/compliance-api";
import { exportsApi } from "../api/exports-api";
import { scheduledRequestsApi } from "../api/scheduled-requests-api";
import { useAuth } from "../contexts/AuthContext";
import { formatDateTime, parseApiError, triggerFileDownload } from "../lib/utils";
import { isAdmin } from "../utils/permissions";

const editSchema = z.object({
  name: z.string().min(2, "Client name is required").max(255),
  email: z.string().email("Enter a valid email").or(z.literal("")).transform((v) => v || null),
  phone: z.string().max(15).or(z.literal("")).transform((v) => v || null),
  gstin: z.string().max(15).or(z.literal("")).transform((v) => (v ? v.toUpperCase() : null)),
  status: z.enum(["active", "inactive", "pending"])
});

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const docTypeOptions = [
  ["invoice", "Invoice"],
  ["bill", "Bill"],
  ["bank_statement", "Bank Statement"],
  ["other", "Other"]
];
const weekDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const emptyScheduleForm = {
  documentTypes: ["invoice", "bill"],
  frequency: "monthly",
  dayOfMonth: 1,
  dayOfWeek: 1
};

const formatCurrency = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

const ClientDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canAdmin = isAdmin(user);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [previewingExport, setPreviewingExport] = useState(false);
  const [confirmingExport, setConfirmingExport] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showBulkExport, setShowBulkExport] = useState(false);
  const [showExportPreview, setShowExportPreview] = useState(false);
  const [showPreviewWarnings, setShowPreviewWarnings] = useState(false);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [showRequestDocs, setShowRequestDocs] = useState(false);
  const [showEnablePortal, setShowEnablePortal] = useState(false);
  const [portalEmail, setPortalEmail] = useState("");
  const [portalError, setPortalError] = useState("");
  const [enablingPortal, setEnablingPortal] = useState(false);
  const [tempPassword, setTempPassword] = useState("");
  const [tempPasswordCopied, setTempPasswordCopied] = useState(false);
  const [requestDocsTypes, setRequestDocsTypes] = useState(docTypeOptions.map(([value]) => value));
  const [requestDocsError, setRequestDocsError] = useState("");
  const [copyLinkFeedback, setCopyLinkFeedback] = useState("");
  const [client, setClient] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", phone: "", gstin: "", status: "active" });
  const [bulkExportForm, setBulkExportForm] = useState({ fromDate: "", toDate: "" });
  const [scheduleForm, setScheduleForm] = useState(emptyScheduleForm);
  const [bulkExportError, setBulkExportError] = useState("");
  const [exportPreviewError, setExportPreviewError] = useState("");
  const [exportPreview, setExportPreview] = useState(null);
  const [previewExportPayload, setPreviewExportPayload] = useState(null);
  const [scheduleError, setScheduleError] = useState("");
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [deletingSchedule, setDeletingSchedule] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [gstLookup, setGstLookup] = useState({ status: "idle", message: "" });

  const loadClient = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await clientsApi.getById(id);
      setClient(result);
      setEditForm({
        name: result.name || "",
        email: result.email || "",
        phone: result.phone || "",
        gstin: result.gstin || "",
        status: result.status || "active"
      });
    } catch (loadError) {
      setError(parseApiError(loadError, "Unable to load client details"));
    } finally {
      setLoading(false);
    }
  };

  const loadSchedule = async () => {
    try {
      const result = await scheduledRequestsApi.list({ clientId: id });
      setSchedule(result.schedule || null);
    } catch {
      setSchedule(null);
    }
  };

  useEffect(() => {
    loadClient();
    loadSchedule();
  }, [id]);

  useEffect(() => {
    if (!showEdit) {
      setGstLookup({ status: "idle", message: "" });
      return undefined;
    }

    const gstin = String(editForm.gstin || "").trim().toUpperCase();
    if (!gstin || gstin.length !== 15 || !GSTIN_PATTERN.test(gstin)) {
      setGstLookup({ status: "idle", message: "" });
      return undefined;
    }

    setGstLookup({ status: "loading", message: "Checking GST portal..." });
    const timeoutId = window.setTimeout(async () => {
      try {
        const result = await complianceApi.verifyGstin(gstin);
        if (result.source === "local_fallback") {
          setGstLookup({
            status: "fallback",
            message: result.valid ? "Format valid (GST portal unreachable)" : result.message || "GSTIN could not be verified"
          });
        } else if (result.valid) {
          setGstLookup({
            status: "valid",
            message: result.legalName || result.tradeName || "GSTIN verified"
          });
        } else {
          setGstLookup({
            status: "invalid",
            message: `${result.registrationStatus || "Invalid"}${result.legalName ? ` - ${result.legalName}` : ""}`
          });
        }
      } catch (lookupError) {
        setGstLookup({
          status: "error",
          message: parseApiError(lookupError, "Unable to verify GSTIN")
        });
      }
    }, 800);

    return () => window.clearTimeout(timeoutId);
  }, [editForm.gstin, showEdit]);

  const openRequestDocsModal = () => {
    setRequestDocsTypes(docTypeOptions.map(([value]) => value));
    setRequestDocsError("");
    setCopyLinkFeedback("");
    setShowRequestDocs(true);
  };

  const uploadLinkFor = (token) =>
    token ? `${window.location.origin}/upload/${token}` : "";

  const onCopyUploadLink = async () => {
    const link = uploadLinkFor(client?.uploadToken);
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopyLinkFeedback("Link copied to clipboard.");
    } catch {
      setCopyLinkFeedback("Unable to copy link — copy it manually.");
    }
  };

  const onSendDocRequest = async () => {
    if (requestDocsTypes.length === 0) return;
    setRequesting(true);
    setRequestDocsError("");
    setError("");
    setToast("");
    try {
      await clientsApi.requestDocuments(id, { documentTypes: requestDocsTypes });
      setShowRequestDocs(false);
      setToast("Document request sent successfully.");
      await loadClient();
    } catch (requestError) {
      setRequestDocsError(parseApiError(requestError, "Unable to request documents"));
    } finally {
      setRequesting(false);
    }
  };

  const openEnablePortalModal = () => {
    setPortalEmail(client?.portal?.email || client?.email || "");
    setPortalError("");
    setTempPassword("");
    setTempPasswordCopied(false);
    setShowEnablePortal(true);
  };

  const closeEnablePortalModal = () => {
    setShowEnablePortal(false);
    // The temp password is shown exactly once — never keep it in state after
    // the modal closes.
    setTempPassword("");
    setTempPasswordCopied(false);
    setPortalError("");
  };

  const onEnablePortal = async () => {
    setEnablingPortal(true);
    setPortalError("");
    setToast("");
    try {
      const result = await clientsApi.enablePortal(id, { portalEmail });
      setTempPassword(result.tempPassword);
      setTempPasswordCopied(false);
      await loadClient();
    } catch (enableError) {
      setPortalError(parseApiError(enableError, "Unable to enable the client portal"));
    } finally {
      setEnablingPortal(false);
    }
  };

  const onCopyTempPassword = async () => {
    if (!tempPassword) return;
    try {
      await navigator.clipboard.writeText(tempPassword);
      setTempPasswordCopied(true);
    } catch {
      setPortalError("Unable to copy — please select and copy the password manually.");
    }
  };

  const onSaveEdit = async (event) => {
    event.preventDefault();
    setError("");
    const validation = editSchema.safeParse(editForm);
    if (!validation.success) {
      setError(validation.error.issues[0]?.message || "Invalid values");
      return;
    }
    setSaving(true);
    try {
      await clientsApi.update(id, validation.data);
      setToast("Client updated.");
      setShowEdit(false);
      await loadClient();
    } catch (saveError) {
      setError(parseApiError(saveError, "Unable to update client"));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    setDeleting(true);
    setShowDeleteConfirm(false);
    try {
      await clientsApi.remove(id);
      navigate("/clients", { replace: true });
    } catch (deleteError) {
      setError(parseApiError(deleteError, "Unable to delete client"));
      setDeleting(false);
    }
  };

  const onBulkExportPreview = async () => {
    const payload = {
      clientId: id,
      fromDate: bulkExportForm.fromDate || undefined,
      toDate: bulkExportForm.toDate || undefined
    };

    setPreviewingExport(true);
    setBulkExportError("");
    setExportPreviewError("");
    setExportPreview(null);
    setPreviewExportPayload(payload);
    setToast("");
    try {
      const result = await exportsApi.preview(payload);
      setShowBulkExport(false);
      setExportPreview(result);
      setShowPreviewWarnings(false);
      setShowExportPreview(true);
    } catch (previewError) {
      setBulkExportError(parseApiError(previewError, "Unable to preview reviewed documents"));
    } finally {
      setPreviewingExport(false);
    }
  };

  const onConfirmBulkExport = async () => {
    if (!previewExportPayload) return;
    setConfirmingExport(true);
    setExportPreviewError("");
    setToast("");
    try {
      const result = await exportsApi.generateBulk(previewExportPayload);
      setShowExportPreview(false);
      setExportPreview(null);
      setPreviewExportPayload(null);
      setBulkExportForm({ fromDate: "", toDate: "" });
      setToast(`${result.documentCount} documents exported successfully.`);
      if (result.downloadUrl) {
        await triggerFileDownload(result.downloadUrl, "tally-export.xml");
      }
      await loadClient();
    } catch (exportError) {
      setExportPreviewError(parseApiError(exportError, "Unable to export reviewed documents"));
    } finally {
      setConfirmingExport(false);
    }
  };

  const openScheduleForm = () => {
    setScheduleError("");
    setScheduleForm(
      schedule
        ? {
            documentTypes: schedule.documentTypes || ["invoice"],
            frequency: schedule.frequency || "monthly",
            dayOfMonth: schedule.dayOfMonth || 1,
            dayOfWeek: schedule.dayOfWeek ?? 1
          }
        : emptyScheduleForm
    );
    setShowScheduleForm(true);
  };

  const onSaveSchedule = async () => {
    setSavingSchedule(true);
    setScheduleError("");
    setToast("");
    const payload = {
      clientId: id,
      documentTypes: scheduleForm.documentTypes,
      frequency: scheduleForm.frequency,
      dayOfMonth: scheduleForm.frequency === "monthly" ? Number(scheduleForm.dayOfMonth) : null,
      dayOfWeek: scheduleForm.frequency === "weekly" ? Number(scheduleForm.dayOfWeek) : null
    };

    try {
      if (schedule?.id) {
        await scheduledRequestsApi.update(schedule.id, payload);
        setToast("Recurring request schedule updated.");
      } else {
        await scheduledRequestsApi.create(payload);
        setToast("Recurring request schedule created.");
      }
      setShowScheduleForm(false);
      await loadSchedule();
    } catch (saveScheduleError) {
      setScheduleError(parseApiError(saveScheduleError, "Unable to save schedule"));
    } finally {
      setSavingSchedule(false);
    }
  };

  const onDeleteSchedule = async () => {
    if (!schedule?.id) return;
    setDeletingSchedule(true);
    setScheduleError("");
    setToast("");
    try {
      await scheduledRequestsApi.remove(schedule.id);
      setSchedule(null);
      setToast("Recurring request schedule deleted.");
    } catch (deleteScheduleError) {
      setError(parseApiError(deleteScheduleError, "Unable to delete schedule"));
    } finally {
      setDeletingSchedule(false);
    }
  };

  const summary = client?.documentSummary || {};
  const reviewedCount = Number(summary.reviewedDocuments || 0);
  const scheduleDay = schedule?.frequency === "monthly"
    ? `on the ${schedule.dayOfMonth}${schedule.dayOfMonth === 1 ? "st" : schedule.dayOfMonth === 2 ? "nd" : schedule.dayOfMonth === 3 ? "rd" : "th"}`
    : `on ${weekDays[schedule?.dayOfWeek || 0]}`;
  const scheduleDocTypes = (schedule?.documentTypes || [])
    .map((type) => docTypeOptions.find(([value]) => value === type)?.[1] || type)
    .join(", ");

  return (
    <AppShell title={client?.name || "Client Detail"} subtitle="Client profile, upload status, and compliance pipeline.">
      {/* Delete confirm modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-sm">
          <div className="panel mx-4 w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-ink-900">Delete client?</h3>
            <p className="mt-2 text-sm text-[#607086]">
              This will permanently delete <strong>{client?.name}</strong> and all associated data. This cannot be undone.
            </p>
            <div className="mt-5 flex gap-3">
              <button type="button" className="btn-secondary flex-1" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="flex-1 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 transition"
                onClick={onDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showBulkExport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-sm">
          <div className="panel mx-4 w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-ink-900">Bulk Export to Tally</h3>
            <p className="mt-1 text-sm font-semibold text-[#607086]">{client?.name}</p>
            <p className="mt-3 text-xs text-[#6f8097]">
              Leave blank to export all reviewed documents.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">From</label>
                <input
                  className="field"
                  type="date"
                  value={bulkExportForm.fromDate}
                  onChange={(event) =>
                    setBulkExportForm((prev) => ({ ...prev, fromDate: event.target.value }))
                  }
                />
              </div>
              <div>
                <label className="label">To</label>
                <input
                  className="field"
                  type="date"
                  value={bulkExportForm.toDate}
                  onChange={(event) =>
                    setBulkExportForm((prev) => ({ ...prev, toDate: event.target.value }))
                  }
                />
              </div>
            </div>

            <p className="mt-3 text-sm text-[#607086]">
              {reviewedCount} reviewed {reviewedCount === 1 ? "document" : "documents"} available.
            </p>

            {bulkExportError ? (
              <div className="mt-3 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {bulkExportError}
              </div>
            ) : null}

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                className="btn-secondary flex-1"
                disabled={previewingExport}
                onClick={() => {
                  setShowBulkExport(false);
                  setBulkExportError("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary flex-1"
                disabled={previewingExport}
                onClick={onBulkExportPreview}
              >
                {previewingExport ? "Preparing preview..." : "Preview"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showExportPreview && exportPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 px-4 py-6 backdrop-blur-sm">
          <div className="panel flex max-h-[90vh] w-full max-w-4xl flex-col p-0">
            <div className="border-b border-[#eadfcf] px-5 py-4">
              <h3 className="text-lg font-bold text-ink-900">Export Preview - {client?.name}</h3>
              <p className="mt-1 text-sm text-[#607086]">
                {exportPreview.documentCount} documents · {exportPreview.vouchers?.length || 0} vouchers will be sent to TallyPrime
              </p>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {exportPreview.hasWarnings ? (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <p className="font-semibold">
                      {exportPreview.warnings.length} line items have unresolved Tally item name mappings.
                      These items will export with their original names.
                    </p>
                    <button
                      type="button"
                      className="text-xs font-bold text-amber-900 underline"
                      onClick={() => setShowPreviewWarnings((prev) => !prev)}
                    >
                      {showPreviewWarnings ? "Hide details" : "Show details"}
                    </button>
                  </div>
                  <p className="mt-1 text-xs">
                    Review mappings before exporting for best results.
                  </p>
                  {showPreviewWarnings ? (
                    <div className="mt-3 max-h-40 overflow-auto rounded-lg border border-amber-200 bg-white">
                      <table className="min-w-full text-left text-xs">
                        <thead className="bg-amber-100 text-amber-900">
                          <tr>
                            <th className="px-3 py-2">Invoice No.</th>
                            <th className="px-3 py-2">Item Name</th>
                            <th className="px-3 py-2">Issue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {exportPreview.warnings.map((warning, index) => (
                            <tr key={`${warning.documentId}-${warning.itemName}-${index}`} className="border-t border-amber-100">
                              <td className="px-3 py-2">{warning.invoiceNumber || "-"}</td>
                              <td className="px-3 py-2">{warning.itemName}</td>
                              <td className="px-3 py-2">Unresolved mapping</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {exportPreviewError ? (
                <div className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {exportPreviewError}
                </div>
              ) : null}

              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-0">
                  <thead>
                    <tr className="bg-sand-100 text-left text-xs uppercase tracking-wide text-[#6d7e95]">
                      <th className="rounded-l-lg px-3 py-3">Voucher Type</th>
                      <th className="px-3 py-3">Date</th>
                      <th className="px-3 py-3">Party</th>
                      <th className="px-3 py-3">Line Items</th>
                      <th className="px-3 py-3 text-right">Amount</th>
                      <th className="rounded-r-lg px-3 py-3 text-right">GST</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(exportPreview.vouchers || []).slice(0, 20).map((voucher, index) => (
                      <tr key={`${voucher.voucherType}-${voucher.voucherDate}-${index}`} className="border-t border-[#eadfcf]">
                        <td className="px-3 py-3 text-sm font-semibold text-ink-800">{voucher.voucherType}</td>
                        <td className="px-3 py-3 text-sm text-[#5f6f84]">{voucher.voucherDate || "-"}</td>
                        <td className="px-3 py-3 text-sm text-[#5f6f84]">{voucher.partyName || "-"}</td>
                        <td className="px-3 py-3 text-sm text-[#5f6f84]">{voucher.lineItemCount || 0}</td>
                        <td className="px-3 py-3 text-right text-sm font-semibold text-ink-800">
                          {formatCurrency(voucher.totalAmount)}
                        </td>
                        <td className="px-3 py-3 text-right text-sm text-[#5f6f84]">
                          {formatCurrency(voucher.gstAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {(exportPreview.vouchers?.length || 0) > 20 ? (
                <p className="text-sm text-[#607086]">
                  ...and {exportPreview.vouchers.length - 20} more vouchers
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-3 border-t border-[#eadfcf] px-5 py-4">
              <button
                type="button"
                className="btn-secondary flex-1"
                disabled={confirmingExport}
                onClick={() => {
                  setShowExportPreview(false);
                  setExportPreviewError("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary flex-1"
                disabled={confirmingExport}
                onClick={onConfirmBulkExport}
              >
                {confirmingExport
                  ? "Exporting..."
                  : exportPreview.hasWarnings
                  ? "Export Anyway"
                  : "Confirm Export"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showScheduleForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-sm">
          <div className="panel mx-4 w-full max-w-lg p-6">
            <h3 className="text-lg font-bold text-ink-900">Schedule Recurring Requests</h3>
            <p className="mt-1 text-sm text-[#607086]">{client?.name}</p>

            <div className="mt-4 space-y-4">
              <div>
                <label className="label">Document types</label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {docTypeOptions.map(([value, label]) => (
                    <label key={value} className="flex items-center gap-2 rounded-lg border border-[#e7dcc8] px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={scheduleForm.documentTypes.includes(value)}
                        onChange={(event) =>
                          setScheduleForm((prev) => ({
                            ...prev,
                            documentTypes: event.target.checked
                              ? [...prev.documentTypes, value]
                              : prev.documentTypes.filter((type) => type !== value)
                          }))
                        }
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Frequency</label>
                <div className="flex gap-3">
                  {["monthly", "weekly"].map((value) => (
                    <label key={value} className="flex items-center gap-2 text-sm font-semibold capitalize text-ink-700">
                      <input
                        type="radio"
                        name="frequency"
                        checked={scheduleForm.frequency === value}
                        onChange={() => setScheduleForm((prev) => ({ ...prev, frequency: value }))}
                      />
                      {value}
                    </label>
                  ))}
                </div>
              </div>

              {scheduleForm.frequency === "monthly" ? (
                <div>
                  <label className="label">Day of month</label>
                  <select
                    className="field"
                    value={scheduleForm.dayOfMonth}
                    onChange={(event) => setScheduleForm((prev) => ({ ...prev, dayOfMonth: event.target.value }))}
                  >
                    {Array.from({ length: 28 }, (_, index) => index + 1).map((day) => (
                      <option key={day} value={day}>{day}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="label">Day of week</label>
                  <select
                    className="field"
                    value={scheduleForm.dayOfWeek}
                    onChange={(event) => setScheduleForm((prev) => ({ ...prev, dayOfWeek: event.target.value }))}
                  >
                    {weekDays.map((day, index) => (
                      <option key={day} value={index}>{day}</option>
                    ))}
                  </select>
                </div>
              )}

              {scheduleError ? (
                <div className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {scheduleError}
                </div>
              ) : null}
            </div>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                className="btn-secondary flex-1"
                disabled={savingSchedule}
                onClick={() => setShowScheduleForm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary flex-1"
                disabled={savingSchedule || scheduleForm.documentTypes.length === 0}
                onClick={onSaveSchedule}
              >
                {savingSchedule ? "Saving..." : "Save Schedule"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRequestDocs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-sm">
          <div className="panel mx-4 w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-ink-900">Request Documents</h3>
            <p className="mt-1 text-sm text-[#607086]">{client?.name}</p>

            <div className="mt-4">
              <label className="label">Document types</label>
              <div className="grid gap-2 sm:grid-cols-2">
                {docTypeOptions.map(([value, label]) => (
                  <label key={value} className="flex items-center gap-2 rounded-lg border border-[#e7dcc8] px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={requestDocsTypes.includes(value)}
                      onChange={(event) =>
                        setRequestDocsTypes((prev) =>
                          event.target.checked
                            ? [...prev, value]
                            : prev.filter((type) => type !== value)
                        )
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            <p className="mt-3 text-xs text-[#6f8097]">
              {client?.email
                ? `${client.email} will be emailed a secure upload link automatically.`
                : "This client has no email on file — share the link below manually."}
            </p>

            {client?.uploadToken && (
              <div className="mt-3 rounded-lg border border-[#e4d8c5] bg-sand-50 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-[#6a7b90]">Current upload link</p>
                <p className="mt-1 break-all font-mono text-xs text-[#596a82]">
                  {uploadLinkFor(client.uploadToken)}
                </p>
                <button
                  type="button"
                  className="btn-secondary mt-2 px-3 py-1.5 text-xs"
                  onClick={onCopyUploadLink}
                >
                  Copy Link
                </button>
                {copyLinkFeedback && (
                  <p className="mt-1 text-xs font-semibold text-mint-700">{copyLinkFeedback}</p>
                )}
              </div>
            )}

            {requestDocsError ? (
              <div className="mt-3 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {requestDocsError}
              </div>
            ) : null}

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                className="btn-secondary flex-1"
                disabled={requesting}
                onClick={() => setShowRequestDocs(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary flex-1"
                disabled={requesting || requestDocsTypes.length === 0}
                onClick={onSendDocRequest}
              >
                {requesting ? "Sending..." : "Send Request"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEnablePortal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 px-4 backdrop-blur-sm">
          <div className="panel w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-ink-900">
              {client?.portal?.enabled ? "Reset portal password" : "Enable client portal"}
            </h3>
            <p className="mt-1 text-sm text-[#607086]">{client?.name}</p>

            {tempPassword ? (
              <>
                <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
                    Temporary password
                  </p>
                  <p className="mt-2 break-all font-mono text-xl font-bold tracking-wide text-ink-900">
                    {tempPassword}
                  </p>
                  <button
                    type="button"
                    className="btn-secondary mt-3 px-3 py-1.5 text-xs"
                    onClick={onCopyTempPassword}
                  >
                    {tempPasswordCopied ? "Copied" : "Copy password"}
                  </button>
                  <p className="mt-3 text-sm font-semibold text-amber-900">
                    Share this password with your client. It will not be shown again.
                  </p>
                </div>

                <p className="mt-3 text-xs text-[#6f8097]">
                  We also emailed these details to {portalEmail}. They can sign in at{" "}
                  <span className="font-mono">/client-portal/login</span>.
                </p>

                {portalError ? (
                  <div className="mt-3 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {portalError}
                  </div>
                ) : null}

                <button
                  type="button"
                  className="btn-primary mt-5 w-full"
                  onClick={closeEnablePortalModal}
                >
                  Done
                </button>
              </>
            ) : (
              <>
                <p className="mt-3 text-sm text-[#607086]">
                  Your client will be able to sign in and see their own documents, status, and
                  reconciliation reports. They can never see extracted data or Tally exports.
                </p>

                <div className="mt-4">
                  <label className="label" htmlFor="portal-email">
                    Client's email address
                  </label>
                  <input
                    id="portal-email"
                    className="field"
                    type="email"
                    autoComplete="off"
                    value={portalEmail}
                    onChange={(event) => setPortalEmail(event.target.value)}
                    placeholder="owner@client.in"
                  />
                </div>

                {portalError ? (
                  <div className="mt-3 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {portalError}
                  </div>
                ) : null}

                <div className="mt-5 flex gap-3">
                  <button
                    type="button"
                    className="btn-secondary flex-1"
                    disabled={enablingPortal}
                    onClick={closeEnablePortalModal}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-primary flex-1"
                    disabled={enablingPortal || !portalEmail.trim()}
                    onClick={onEnablePortal}
                  >
                    {enablingPortal ? "Enabling..." : "Enable Portal"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {loading ? <ClientDetailSkeleton /> : null}

      {error ? (
        <div className="mb-4 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      ) : null}

      {!loading && !client ? (
        <EmptyState title="Client not found" description="The requested client is unavailable or you do not have access." />
      ) : null}

      {client ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total documents" value={summary.totalDocuments ?? 0} />
            <StatCard label="Processing" value={summary.processingDocuments ?? 0} tone="warning" />
            <StatCard label="Reviewed" value={summary.reviewedDocuments ?? 0} tone="success" />
            <StatCard label="Exported" value={summary.exportedDocuments ?? 0} tone="success" />
          </section>

          <section className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            {/* Profile / Edit panel */}
            <article className="panel p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold text-ink-900">Client profile</h2>
                  <StatusBadge status={client.status} />
                </div>
                {canAdmin && (
                  <button
                    type="button"
                    className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition"
                    onClick={() => { setShowEdit(!showEdit); setError(""); }}
                  >
                    {showEdit ? "Cancel edit" : "Edit"}
                  </button>
                )}
              </div>

              {canAdmin && showEdit ? (
                <form className="mt-4 space-y-3" onSubmit={onSaveEdit}>
                  <div>
                    <label className="label">Client name</label>
                    <input
                      className="field"
                      value={editForm.name}
                      onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="label">Email</label>
                      <input
                        className="field"
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="label">Phone</label>
                      <input
                        className="field"
                        value={editForm.phone}
                        onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="label">GSTIN</label>
                      <input
                        className="field uppercase"
                        value={editForm.gstin}
                        onChange={(e) => setEditForm((p) => ({ ...p, gstin: e.target.value.toUpperCase() }))}
                      />
                      {gstLookup.status !== "idle" && gstLookup.message && (
                        <p
                          className={`mt-1 text-xs font-semibold ${
                            gstLookup.status === "valid"
                              ? "text-mint-700"
                              : gstLookup.status === "fallback"
                              ? "text-slate-500"
                              : gstLookup.status === "loading"
                              ? "text-[#607086]"
                              : "text-rose-600"
                          }`}
                        >
                          {gstLookup.status === "valid" ? "GST verified: " : ""}
                          {gstLookup.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="label">Status</label>
                      <select
                        className="field"
                        value={editForm.status}
                        onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value }))}
                      >
                        <option value="active">Active</option>
                        <option value="pending">Pending</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                  </div>
                  {error ? (
                    <div className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
                  ) : null}
                  <button type="submit" className="btn-primary w-full" disabled={saving}>
                    {saving ? "Saving..." : "Save changes"}
                  </button>
                </form>
              ) : (
                <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-[#6a7b90]">Email</dt>
                    <dd className="text-sm font-semibold text-ink-900">{client.email || "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-[#6a7b90]">Phone</dt>
                    <dd className="text-sm font-semibold text-ink-900">{client.phone || "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-[#6a7b90]">GSTIN</dt>
                    <dd className="text-sm font-semibold text-ink-900">{client.gstin || "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-[#6a7b90]">Last upload</dt>
                    <dd className="text-sm font-semibold text-ink-900">{formatDateTime(summary.lastUploadedAt)}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs uppercase tracking-wide text-[#6a7b90]">Upload token</dt>
                    <dd className="font-mono text-xs text-[#596a82] break-all">{client.uploadToken}</dd>
                  </div>
                </dl>
              )}
            </article>

            {/* Actions panel */}
            <article className="panel p-5">
              <h2 className="text-lg font-bold text-ink-900">Actions</h2>
              <div className="mt-4 space-y-3">
                {canAdmin && (
                  <button type="button" className="btn-primary w-full" onClick={openRequestDocsModal}>
                    Request documents
                  </button>
                )}
                {canAdmin && reviewedCount > 0 && (
                  <button
                    type="button"
                    className="btn-secondary w-full"
                    onClick={() => {
                      setBulkExportError("");
                      setShowBulkExport(true);
                    }}
                  >
                    Export All to Tally
                  </button>
                )}
                {client.gstin && (
                  <Link className="btn-secondary block w-full text-center" to={`/clients/${id}/gst-reconciliation`}>
                    GST Reconciliation
                  </Link>
                )}
                <Link className="btn-secondary block w-full text-center" to={`/clients/${id}/documents`}>
                  View documents
                </Link>
                <Link className="btn-secondary block w-full text-center" to="/clients">
                  Back to clients list
                </Link>
                {canAdmin && (
                  <>
                <hr className="border-[#e7dcc8]" />
                <div className="rounded-xl border border-[#e4d8c5] bg-sand-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-ink-900">Client Portal</h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                        client.portal?.enabled
                          ? "bg-mint-500/15 text-mint-700"
                          : "bg-sand-100 text-[#6a7b90]"
                      }`}
                    >
                      {client.portal?.enabled ? "Enabled" : "Not enabled"}
                    </span>
                  </div>
                  {client.portal?.enabled ? (
                    <div className="mt-2 space-y-2 text-sm text-[#607086]">
                      <p className="break-all">{client.portal.email}</p>
                      <p>
                        Last login:{" "}
                        {client.portal.lastLoginAt
                          ? formatDateTime(client.portal.lastLoginAt)
                          : "Never"}
                      </p>
                      <button
                        type="button"
                        className="btn-secondary px-3 py-1.5 text-xs"
                        onClick={openEnablePortalModal}
                      >
                        Reset password
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="mt-2 text-sm text-[#607086]">
                        Give this client a secure login to track their own documents.
                      </p>
                      <button
                        type="button"
                        className="btn-secondary mt-3 w-full"
                        onClick={openEnablePortalModal}
                      >
                        Enable Client Portal
                      </button>
                    </>
                  )}
                </div>
                <hr className="border-[#e7dcc8]" />
                <div className="rounded-xl border border-[#e4d8c5] bg-sand-50 p-3">
                  <h3 className="text-sm font-bold text-ink-900">Schedule Recurring Requests</h3>
                  {schedule ? (
                    <div className="mt-2 space-y-2 text-sm text-[#607086]">
                      <p>
                        Sends {schedule.frequency} {scheduleDay} · {scheduleDocTypes}
                      </p>
                      <p>Last sent: {schedule.lastSentAt ? formatDateTime(schedule.lastSentAt) : "Never"}</p>
                      <div className="flex gap-2">
                        <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={openScheduleForm}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                          disabled={deletingSchedule}
                          onClick={onDeleteSchedule}
                        >
                          {deletingSchedule ? "Deleting..." : "Pause / Delete"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" className="btn-secondary mt-3 w-full" onClick={openScheduleForm}>
                      Set up recurring requests
                    </button>
                  )}
                </div>
                <hr className="border-[#e7dcc8]" />
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full rounded-lg border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 transition disabled:opacity-50"
                >
                  {deleting ? "Deleting..." : "Delete client"}
                </button>
                  </>
                )}
              </div>
              {toast ? (
                <div className="mt-4 rounded-lg border border-mint-300 bg-mint-500/10 px-3 py-2 text-sm text-mint-700">
                  {toast}
                </div>
              ) : null}
            </article>
          </section>
        </>
      ) : null}
    </AppShell>
  );
};

export default ClientDetailPage;
