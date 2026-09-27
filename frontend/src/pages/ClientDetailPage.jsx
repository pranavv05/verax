import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import AppShell from "../components/layout/AppShell";
import EmptyState from "../components/ui/EmptyState";
import { ClientDetailSkeleton } from "../components/ui/skeletons";
import StatusBadge from "../components/ui/StatusBadge";
import Modal, { ConfirmDialog } from "../components/app/Modal";
import ExportPreviewModal from "../components/app/ExportPreviewModal";
import { Alert, Avatar, Badge, Breadcrumbs, Card, CardHeader, FormField, PageHeader, Segmented, StatTile } from "../components/app/primitives";
import {
  IconCalendar,
  IconCheck,
  IconCheckCircle,
  IconCopy,
  IconEdit,
  IconExport,
  IconFiles,
  IconLink,
  IconLock,
  IconMail,
  IconScale,
  IconSpark,
  IconTrash
} from "../components/app/icons";
import { clientsApi } from "../api/clients-api";
import { complianceApi } from "../api/compliance-api";
import { exportsApi } from "../api/exports-api";
import { scheduledRequestsApi } from "../api/scheduled-requests-api";
import { useAuth } from "../contexts/AuthContext";
import { cn, formatDateTime, parseApiError, triggerFileDownload } from "../lib/utils";
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
  ["bank_statement", "Bank statement"],
  ["other", "Other"]
];
const weekDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const emptyScheduleForm = {
  documentTypes: ["invoice", "bill"],
  frequency: "monthly",
  dayOfMonth: 1,
  dayOfWeek: 1
};

const DocTypeChecks = ({ value, onChange, name }) => (
  <fieldset>
    <legend className="label">Document types</legend>
    <div className="grid gap-2 sm:grid-cols-2">
      {docTypeOptions.map(([type, label]) => {
        const checked = value.includes(type);
        return (
          <label
            key={type}
            className={cn(
              "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-[0.8125rem] font-medium transition-colors",
              checked
                ? "border-ui-accent/40 bg-ui-accent/[0.06] text-ui-fg"
                : "border-ui-line bg-ui-surface text-ui-fg-2 hover:border-ui-line-strong"
            )}
          >
            <input
              type="checkbox"
              name={name}
              className="h-4 w-4 accent-[rgb(var(--ui-accent))]"
              checked={checked}
              onChange={(event) => onChange(event.target.checked ? [...value, type] : value.filter((t) => t !== type))}
            />
            {label}
          </label>
        );
      })}
    </div>
  </fieldset>
);

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

  const uploadLink = uploadLinkFor(client?.uploadToken);
  const gstClass =
    gstLookup.status === "valid"
      ? "text-ui-ok"
      : gstLookup.status === "fallback" || gstLookup.status === "loading"
        ? "text-ui-fg-3"
        : "text-ui-err";


  return (
    <AppShell>
      <ConfirmDialog
        open={showDeleteConfirm}
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={onDelete}
        title={`Delete ${client?.name || "client"}?`}
        description="The client, their documents and upload links will be removed. This cannot be undone."
        confirmLabel="Delete client"
        destructive
        busy={deleting}
        busyLabel="Deleting…"
      />

      <Modal
        open={showBulkExport}
        onClose={() => {
          setShowBulkExport(false);
          setBulkExportError("");
        }}
        busy={previewingExport}
        title="Export to Tally"
        description={`${reviewedCount} reviewed ${reviewedCount === 1 ? "document" : "documents"} for ${client?.name}. Leave the dates blank to export all of them.`}
        footer={
          <>
            <button
              type="button"
              className="btn-secondary"
              disabled={previewingExport}
              onClick={() => {
                setShowBulkExport(false);
                setBulkExportError("");
              }}
            >
              Cancel
            </button>
            <button type="button" className="btn-primary" disabled={previewingExport} onClick={onBulkExportPreview}>
              {previewingExport ? "Preparing preview…" : "Preview vouchers"}
            </button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="From" htmlFor="bulk-from">
            <input
              id="bulk-from"
              className="field"
              type="date"
              value={bulkExportForm.fromDate}
              onChange={(event) => setBulkExportForm((prev) => ({ ...prev, fromDate: event.target.value }))}
            />
          </FormField>
          <FormField label="To" htmlFor="bulk-to">
            <input
              id="bulk-to"
              className="field"
              type="date"
              value={bulkExportForm.toDate}
              onChange={(event) => setBulkExportForm((prev) => ({ ...prev, toDate: event.target.value }))}
            />
          </FormField>
        </div>
        {bulkExportError ? (
          <Alert tone="err" className="mt-4">
            {bulkExportError}
          </Alert>
        ) : null}
      </Modal>

      <ExportPreviewModal
        open={showExportPreview}
        preview={exportPreview}
        clientName={client?.name}
        error={exportPreviewError}
        confirming={confirmingExport}
        onCancel={() => {
          setShowExportPreview(false);
          setExportPreviewError("");
        }}
        onConfirm={onConfirmBulkExport}
      />

      <Modal
        open={showScheduleForm}
        onClose={() => setShowScheduleForm(false)}
        busy={savingSchedule}
        size="lg"
        title={schedule ? "Edit recurring request" : "Set up recurring requests"}
        description={`Verax emails ${client?.name || "the client"} an upload link on a schedule, so you never have to chase.`}
        footer={
          <>
            <button type="button" className="btn-secondary" disabled={savingSchedule} onClick={() => setShowScheduleForm(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={savingSchedule || scheduleForm.documentTypes.length === 0}
              onClick={onSaveSchedule}
            >
              {savingSchedule ? "Saving…" : "Save schedule"}
            </button>
          </>
        }
      >
        <div className="space-y-5">
          <DocTypeChecks
            name="schedule-types"
            value={scheduleForm.documentTypes}
            onChange={(documentTypes) => setScheduleForm((prev) => ({ ...prev, documentTypes }))}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="label">Frequency</p>
              <Segmented
                ariaLabel="Frequency"
                layoutId="schedule-frequency"
                value={scheduleForm.frequency}
                onChange={(frequency) => setScheduleForm((prev) => ({ ...prev, frequency }))}
                options={[
                  { value: "monthly", label: "Monthly" },
                  { value: "weekly", label: "Weekly" }
                ]}
              />
            </div>
            {scheduleForm.frequency === "monthly" ? (
              <FormField label="Day of month" htmlFor="schedule-dom">
                <select
                  id="schedule-dom"
                  className="field"
                  value={scheduleForm.dayOfMonth}
                  onChange={(event) => setScheduleForm((prev) => ({ ...prev, dayOfMonth: event.target.value }))}
                >
                  {Array.from({ length: 28 }, (_, index) => index + 1).map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
              </FormField>
            ) : (
              <FormField label="Day of week" htmlFor="schedule-dow">
                <select
                  id="schedule-dow"
                  className="field"
                  value={scheduleForm.dayOfWeek}
                  onChange={(event) => setScheduleForm((prev) => ({ ...prev, dayOfWeek: event.target.value }))}
                >
                  {weekDays.map((day, index) => (
                    <option key={day} value={index}>
                      {day}
                    </option>
                  ))}
                </select>
              </FormField>
            )}
          </div>
          {scheduleError ? <Alert tone="err">{scheduleError}</Alert> : null}
        </div>
      </Modal>

      <Modal
        open={showRequestDocs}
        onClose={() => setShowRequestDocs(false)}
        busy={requesting}
        title="Request documents"
        description={
          client?.email
            ? `${client.email} will be emailed a secure upload link.`
            : "This client has no email on file. Share the upload link manually."
        }
        footer={
          <>
            <button type="button" className="btn-secondary" disabled={requesting} onClick={() => setShowRequestDocs(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={requesting || requestDocsTypes.length === 0}
              onClick={onSendDocRequest}
            >
              <IconMail size={14} />
              {requesting ? "Sending…" : "Send request"}
            </button>
          </>
        }
      >
        <DocTypeChecks name="request-types" value={requestDocsTypes} onChange={setRequestDocsTypes} />
        {requestDocsError ? (
          <Alert tone="err" className="mt-4">
            {requestDocsError}
          </Alert>
        ) : null}
      </Modal>

      <Modal
        open={showEnablePortal}
        onClose={closeEnablePortalModal}
        busy={enablingPortal}
        title={tempPassword ? "Portal access ready" : client?.portal?.enabled ? "Reset portal password" : "Enable the client portal"}
        description={
          tempPassword
            ? `Share this password with ${client?.name}. It won't be shown again.`
            : "Your client can sign in to see their own documents, statuses and GST reports — never your extracted data or Tally files."
        }
        footer={
          tempPassword ? (
            <button type="button" className="btn-primary" onClick={closeEnablePortalModal}>
              Done
            </button>
          ) : (
            <>
              <button type="button" className="btn-secondary" disabled={enablingPortal} onClick={closeEnablePortalModal}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={enablingPortal || !portalEmail.trim()}
                onClick={onEnablePortal}
              >
                {enablingPortal ? "Enabling…" : client?.portal?.enabled ? "Reset password" : "Enable portal"}
              </button>
            </>
          )
        }
      >
        {tempPassword ? (
          <div>
            <div className="rounded-xl border border-ui-warn/25 bg-ui-warn/[0.06] p-4">
              <p className="text-xs font-medium text-ui-warn">Temporary password</p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="ui-mono break-all text-lg font-semibold tracking-wide text-ui-fg">{tempPassword}</p>
                <button type="button" className="btn-secondary btn-sm shrink-0" onClick={onCopyTempPassword}>
                  {tempPasswordCopied ? <IconCheck size={13} /> : <IconCopy size={13} />}
                  {tempPasswordCopied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-ui-fg-3">
              We also emailed these details to {portalEmail}. They sign in at{" "}
              <span className="ui-mono text-ui-fg-2">/client-portal/login</span>.
            </p>
          </div>
        ) : (
          <FormField label="Client's email address" htmlFor="portal-email">
            <input
              id="portal-email"
              className="field"
              type="email"
              autoComplete="off"
              value={portalEmail}
              onChange={(event) => setPortalEmail(event.target.value)}
              placeholder="owner@client.in"
            />
          </FormField>
        )}
        {portalError ? (
          <Alert tone="err" className="mt-4">
            {portalError}
          </Alert>
        ) : null}
      </Modal>

      {loading ? (
        <>
          <PageHeader breadcrumbs={[{ label: "Clients", to: "/clients" }, { label: "Loading…" }]} title="Client" />
          <ClientDetailSkeleton />
        </>
      ) : null}

      {!loading && !client ? (
        <>
          <PageHeader breadcrumbs={[{ label: "Clients", to: "/clients" }, { label: "Not found" }]} title="Client not found." />
          {error ? (
            <Alert tone="err" className="mb-4">
              {error}
            </Alert>
          ) : null}
          <EmptyState
            title="Client not found"
            description="The client is unavailable or you don't have access."
            action={
              <Link to="/clients" className="btn-secondary">
                Back to clients
              </Link>
            }
          />
        </>
      ) : null}

      {client ? (
        <>
          <header className="mb-7 sm:mb-8">
            <Breadcrumbs items={[{ label: "Clients", to: "/clients" }, { label: client.name }]} className="mb-4" />
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <Avatar name={client.name} size={52} className="rounded-2xl" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h1 className="truncate text-[1.625rem] font-semibold leading-tight tracking-[-0.03em] text-ui-fg sm:text-[1.875rem]">
                      {client.name}
                    </h1>
                    <StatusBadge status={client.status} />
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem] text-ui-fg-3">
                    {client.gstin ? <span className="ui-mono text-ui-fg-2">{client.gstin}</span> : <span>No GSTIN</span>}
                    <span aria-hidden="true" className="text-ui-fg-4">·</span>
                    <span>Last upload {summary.lastUploadedAt ? formatDateTime(summary.lastUploadedAt) : "never"}</span>
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Link className="btn-secondary" to={`/clients/${id}/documents`}>
                  <IconFiles size={14} />
                  Documents
                </Link>
                {canAdmin ? (
                  <button type="button" className="btn-primary" onClick={openRequestDocsModal}>
                    <IconLink size={14} />
                    Request documents
                  </button>
                ) : null}
              </div>
            </div>
          </header>

          {toast ? (
            <Alert tone="ok" className="mb-5" onDismiss={() => setToast("")}>
              {toast}
            </Alert>
          ) : null}
          {error && !showEdit ? (
            <Alert tone="err" className="mb-5" onDismiss={() => setError("")}>
              {error}
            </Alert>
          ) : null}

          <section aria-label="Document counts" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label="Total documents" value={summary.totalDocuments ?? 0} icon={<IconFiles size={15} />} to={`/clients/${id}/documents`} />
            <StatTile label="Processing" value={summary.processingDocuments ?? 0} tone={summary.processingDocuments > 0 ? "accent" : "neutral"} icon={<IconSpark size={15} />} />
            <StatTile label="Reviewed" value={summary.reviewedDocuments ?? 0} tone={summary.reviewedDocuments > 0 ? "ok" : "neutral"} hint={reviewedCount > 0 ? "Ready to export" : undefined} icon={<IconCheckCircle size={15} />} />
            <StatTile label="Exported" value={summary.exportedDocuments ?? 0} icon={<IconExport size={15} />} />
          </section>

          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div className="grid grid-cols-1 content-start gap-5">
              <Card>
                <CardHeader
                  title="Profile"
                  description="Contact and tax details used on every voucher."
                  action={
                    canAdmin ? (
                      <button
                        type="button"
                        className="btn-ghost btn-sm"
                        onClick={() => {
                          setShowEdit(!showEdit);
                          setError("");
                        }}
                      >
                        {showEdit ? (
                          "Cancel"
                        ) : (
                          <>
                            <IconEdit size={13} />
                            Edit
                          </>
                        )}
                      </button>
                    ) : null
                  }
                />
                {canAdmin && showEdit ? (
                  <form className="space-y-4 px-5 py-5" onSubmit={onSaveEdit}>
                    <FormField label="Client name" htmlFor="edit-name" required>
                      <input
                        id="edit-name"
                        className="field"
                        value={editForm.name}
                        onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                      />
                    </FormField>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField label="Email" htmlFor="edit-email">
                        <input
                          id="edit-email"
                          className="field"
                          type="email"
                          value={editForm.email}
                          onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                        />
                      </FormField>
                      <FormField label="Phone" htmlFor="edit-phone">
                        <input
                          id="edit-phone"
                          className="field"
                          value={editForm.phone}
                          onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                        />
                      </FormField>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField label="GSTIN" htmlFor="edit-gstin">
                        <input
                          id="edit-gstin"
                          className="field ui-mono uppercase"
                          value={editForm.gstin}
                          onChange={(e) => setEditForm((p) => ({ ...p, gstin: e.target.value.toUpperCase() }))}
                        />
                        {gstLookup.status !== "idle" && gstLookup.message ? (
                          <p className={cn("mt-1.5 flex items-center gap-1.5 text-xs font-medium", gstClass)}>
                            {gstLookup.status === "valid" ? <IconCheck size={13} /> : null}
                            {gstLookup.status === "valid" ? "Verified: " : ""}
                            {gstLookup.message}
                          </p>
                        ) : null}
                      </FormField>
                      <FormField label="Status" htmlFor="edit-status">
                        <select
                          id="edit-status"
                          className="field"
                          value={editForm.status}
                          onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value }))}
                        >
                          <option value="active">Active</option>
                          <option value="pending">Pending</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </FormField>
                    </div>
                    {error ? <Alert tone="err">{error}</Alert> : null}
                    <div className="flex justify-end gap-2 border-t border-ui-line pt-4">
                      <button type="button" className="btn-secondary" onClick={() => setShowEdit(false)} disabled={saving}>
                        Cancel
                      </button>
                      <button type="submit" className="btn-primary" disabled={saving}>
                        {saving ? "Saving…" : "Save changes"}
                      </button>
                    </div>
                  </form>
                ) : (
                  <dl className="grid gap-x-6 gap-y-5 px-5 py-5 sm:grid-cols-2">
                    {[
                      ["Email", client.email],
                      ["Phone", client.phone],
                      ["GSTIN", client.gstin, true],
                      ["Last upload", summary.lastUploadedAt ? formatDateTime(summary.lastUploadedAt) : null]
                    ].map(([label, value, mono]) => (
                      <div key={label}>
                        <dt className="text-xs font-medium text-ui-fg-3">{label}</dt>
                        <dd className={cn("mt-1 text-[0.875rem] text-ui-fg", mono && "ui-mono")}>
                          {value || <span className="text-ui-fg-4">—</span>}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </Card>

              <Card>
                <CardHeader
                  title="Upload link"
                  description="Anyone with this link can send documents for this client. No login needed."
                  icon={<IconLink size={14} />}
                />
                <div className="px-5 py-4">
                  {uploadLink ? (
                    <div className="flex items-center gap-2 rounded-lg border border-ui-line bg-ui-subtle p-1.5 pl-3">
                      <p className="ui-mono min-w-0 flex-1 truncate text-ui-fg-2" title={uploadLink}>
                        {uploadLink}
                      </p>
                      <button type="button" className="btn-secondary btn-sm shrink-0" onClick={onCopyUploadLink}>
                        {copyLinkFeedback.startsWith("Link copied") ? <IconCheck size={13} /> : <IconCopy size={13} />}
                        {copyLinkFeedback.startsWith("Link copied") ? "Copied" : "Copy"}
                      </button>
                    </div>
                  ) : (
                    <p className="text-[0.8125rem] text-ui-fg-3">No active link. Request documents to issue one.</p>
                  )}
                  {copyLinkFeedback && !copyLinkFeedback.startsWith("Link copied") ? (
                    <p className="mt-2 text-xs text-ui-err">{copyLinkFeedback}</p>
                  ) : null}
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-1 content-start gap-5">
              <Card>
                <CardHeader title="Workflows" />
                <ul className="divide-y divide-ui-line">
                  <li className="flex items-center gap-3 px-5 py-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-ui-line bg-ui-subtle text-ui-fg-3">
                      <IconExport size={15} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.8125rem] font-medium text-ui-fg">Export to Tally</p>
                      <p className="text-xs text-ui-fg-3">
                        {reviewedCount > 0 ? `${reviewedCount} reviewed, ready to go` : "Nothing reviewed yet"}
                      </p>
                    </div>
                    {canAdmin ? (
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        disabled={reviewedCount === 0}
                        onClick={() => {
                          setBulkExportError("");
                          setShowBulkExport(true);
                        }}
                      >
                        Export
                      </button>
                    ) : null}
                  </li>
                  <li className="flex items-center gap-3 px-5 py-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-ui-line bg-ui-subtle text-ui-fg-3">
                      <IconScale size={15} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.8125rem] font-medium text-ui-fg">GST reconciliation</p>
                      <p className="text-xs text-ui-fg-3">
                        {client.gstin ? "Match purchases against GSTR-2B" : "Add a GSTIN to reconcile"}
                      </p>
                    </div>
                    {client.gstin ? (
                      <Link className="btn-secondary btn-sm" to={`/clients/${id}/gst-reconciliation`}>
                        Open
                      </Link>
                    ) : null}
                  </li>
                </ul>
              </Card>

              {canAdmin ? (
                <>
                  <Card>
                    <CardHeader
                      title="Client portal"
                      icon={<IconLock size={14} />}
                      action={
                        <Badge tone={client.portal?.enabled ? "ok" : "neutral"} dot>
                          {client.portal?.enabled ? "Enabled" : "Off"}
                        </Badge>
                      }
                    />
                    <div className="px-5 py-4 text-[0.8125rem] text-ui-fg-3">
                      {client.portal?.enabled ? (
                        <>
                          <p className="truncate text-ui-fg-2">{client.portal.email}</p>
                          <p className="mt-0.5 text-xs">
                            Last sign-in {client.portal.lastLoginAt ? formatDateTime(client.portal.lastLoginAt) : "never"}
                          </p>
                          <button type="button" className="btn-secondary btn-sm mt-3" onClick={openEnablePortalModal}>
                            Reset password
                          </button>
                        </>
                      ) : (
                        <>
                          <p>Give this client a secure login to track their own documents and GST summary.</p>
                          <button type="button" className="btn-secondary btn-sm mt-3" onClick={openEnablePortalModal}>
                            Enable portal
                          </button>
                        </>
                      )}
                    </div>
                  </Card>

                  <Card>
                    <CardHeader title="Recurring requests" icon={<IconCalendar size={14} />} />
                    <div className="px-5 py-4 text-[0.8125rem] text-ui-fg-3">
                      {schedule ? (
                        <>
                          <p className="text-ui-fg-2">
                            <span className="capitalize">{schedule.frequency}</span> {scheduleDay}
                          </p>
                          <p className="mt-0.5 text-xs">{scheduleDocTypes}</p>
                          <p className="mt-0.5 text-xs">
                            Last sent {schedule.lastSentAt ? formatDateTime(schedule.lastSentAt) : "never"}
                          </p>
                          <div className="mt-3 flex gap-2">
                            <button type="button" className="btn-secondary btn-sm" onClick={openScheduleForm}>
                              Edit
                            </button>
                            <button type="button" className="btn-danger btn-sm" disabled={deletingSchedule} onClick={onDeleteSchedule}>
                              {deletingSchedule ? "Removing…" : "Stop"}
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <p>Email this client an upload link every week or month, automatically.</p>
                          <button type="button" className="btn-secondary btn-sm mt-3" onClick={openScheduleForm}>
                            Set up schedule
                          </button>
                        </>
                      )}
                    </div>
                  </Card>

                  <Card className="border-ui-err/20">
                    <div className="flex items-center justify-between gap-4 px-5 py-4">
                      <div>
                        <p className="text-[0.8125rem] font-medium text-ui-fg">Delete client</p>
                        <p className="text-xs text-ui-fg-3">Removes the client and all of their documents.</p>
                      </div>
                      <button type="button" className="btn-danger btn-sm" disabled={deleting} onClick={() => setShowDeleteConfirm(true)}>
                        <IconTrash size={13} />
                        {deleting ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </Card>
                </>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </AppShell>
  );
};

export default ClientDetailPage;
