import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import AppShell from "../components/layout/AppShell";
import ClientImportModal from "../components/clients/ClientImportModal";
import Drawer from "../components/ui/Drawer";
import EmptyState from "../components/ui/EmptyState";
import OverflowMenu from "../components/ui/OverflowMenu";
import { TableRowsSkeleton } from "../components/ui/skeletons";
import StatusBadge from "../components/ui/StatusBadge";
import Modal, { ConfirmDialog } from "../components/app/Modal";
import { Pagination, SearchField, TableScroll, Toolbar } from "../components/app/TableKit";
import { Alert, Avatar, FormField, PageHeader, Segmented } from "../components/app/primitives";
import { IconCheck, IconCopy, IconFile, IconLink, IconPlus, IconUpload, IconUsers } from "../components/app/icons";
import { clientsApi } from "../api/clients-api";
import { complianceApi } from "../api/compliance-api";
import { useAuth } from "../contexts/AuthContext";
import { cn, formatDate, parseApiError } from "../lib/utils";
import { isAdmin } from "../utils/permissions";

const clientSchema = z.object({
  name: z.string().min(2, "Client name is required").max(255),
  email: z
    .string()
    .email("Enter a valid email")
    .or(z.literal(""))
    .transform((v) => v || null),
  phone: z
    .string()
    .max(15, "Phone should be 15 chars max")
    .or(z.literal(""))
    .transform((v) => v || null),
  gstin: z
    .string()
    .max(15, "GSTIN should be 15 chars max")
    .or(z.literal(""))
    .transform((v) => (v ? v.toUpperCase() : null)),
  status: z.enum(["active", "inactive", "pending"])
});

const emptyForm = { name: "", email: "", phone: "", gstin: "", status: "active" };
const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const requestDocsTypeOptions = [
  ["invoice", "Invoices"],
  ["bank_statement", "Bank statements"],
  ["bill", "Bills"],
  ["other", "Other"]
];

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending" },
  { value: "inactive", label: "Inactive" }
];

const lastActivityText = (summary) => (summary?.lastActivityAt ? formatDate(summary.lastActivityAt) : null);

/** Documents cell: total, with the pending share called out. */
const DocumentsCell = ({ summary }) => {
  const total = summary?.totalDocuments || 0;
  const pending = summary?.pendingDocuments || 0;
  if (total === 0) return <span className="text-ui-fg-4">None yet</span>;
  return (
    <span className="inline-flex items-center gap-2 tabular-nums">
      <span className="font-medium text-ui-fg-2">{total}</span>
      {pending > 0 ? (
        <span className="rounded-full bg-ui-warn/10 px-1.5 py-px text-[11px] font-medium text-ui-warn">{pending} pending</span>
      ) : null}
    </span>
  );
};

const ClientsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canAdmin = isAdmin(user);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [requestDocsClient, setRequestDocsClient] = useState(null);
  const [requestDocsLoading, setRequestDocsLoading] = useState(false);
  const [requestDocsTypes, setRequestDocsTypes] = useState(requestDocsTypeOptions.map(([value]) => value));
  const [requestDocsError, setRequestDocsError] = useState("");
  const [magicLink, setMagicLink] = useState(null);
  const [copyFeedback, setCopyFeedback] = useState("");
  // Drawer-scoped feedback (create/update client) — shown next to the form.
  const [formError, setFormError] = useState("");
  // Page-level feedback for actions that happen outside the drawer (delete,
  // and a confirmation echo once the drawer auto-closes on success).
  const [pageError, setPageError] = useState("");
  const [pageToast, setPageToast] = useState("");
  const [listError, setListError] = useState("");
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState({ page: 1, limit: 20, search: "", status: "" });
  const [searchInput, setSearchInput] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingClient, setEditingClient] = useState(null); // null = add mode, object = edit mode
  const [confirmDeleteId, setConfirmDeleteId] = useState(""); // id to confirm delete
  const [gstLookup, setGstLookup] = useState({ status: "idle", message: "", legalName: "" });

  const loadClients = async () => {
    setLoading(true);
    setListError("");
    try {
      const result = await clientsApi.list(filters);
      setRows(result.data || []);
      setPagination(result.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 });
    } catch (loadError) {
      setListError(parseApiError(loadError, "Couldn't load your clients."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
  }, [filters.page, filters.status, filters.search]);

  // Debounced so search feels instant without firing a request on every keystroke.
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setFilters((prev) => (prev.search === searchInput ? prev : { ...prev, page: 1, search: searchInput }));
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  useEffect(() => {
    const gstin = String(form.gstin || "").trim().toUpperCase();
    if (!gstin) {
      setGstLookup({ status: "idle", message: "", legalName: "" });
      return undefined;
    }
    if (gstin.length !== 15 || !GSTIN_PATTERN.test(gstin)) {
      setGstLookup({ status: "idle", message: "", legalName: "" });
      return undefined;
    }

    setGstLookup({ status: "loading", message: "Checking GST portal…", legalName: "" });
    const timeoutId = window.setTimeout(async () => {
      try {
        const result = await complianceApi.verifyGstin(gstin);
        if (result.source === "local_fallback") {
          setGstLookup({
            status: "fallback",
            message: result.valid ? "Format valid (GST portal unreachable)" : result.message || "GSTIN could not be verified",
            legalName: ""
          });
        } else if (result.valid) {
          setGstLookup({
            status: "valid",
            message: result.legalName || result.tradeName || "GSTIN verified",
            legalName: result.legalName || result.tradeName || ""
          });
        } else {
          setGstLookup({
            status: "invalid",
            message: `${result.registrationStatus || "Invalid"}${result.legalName ? ` - ${result.legalName}` : ""}`,
            legalName: result.legalName || ""
          });
        }
      } catch (lookupError) {
        setGstLookup({
          status: "error",
          message: parseApiError(lookupError, "Unable to verify GSTIN"),
          legalName: ""
        });
      }
    }, 800);

    return () => window.clearTimeout(timeoutId);
  }, [form.gstin]);

  const openAddDrawer = () => {
    setEditingClient(null);
    setForm(emptyForm);
    setFormError("");
    setGstLookup({ status: "idle", message: "", legalName: "" });
    setDrawerOpen(true);
  };

  const startEdit = (client) => {
    setEditingClient(client);
    setForm({
      name: client.name || "",
      email: client.email || "",
      phone: client.phone || "",
      gstin: client.gstin || "",
      status: client.status || "active"
    });
    setFormError("");
    setGstLookup({ status: "idle", message: "", legalName: "" });
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditingClient(null);
    setForm(emptyForm);
    setFormError("");
    setGstLookup({ status: "idle", message: "", legalName: "" });
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setFormError("");

    const validation = clientSchema.safeParse(form);
    if (!validation.success) {
      setFormError(validation.error.issues[0]?.message || "Invalid form values");
      return;
    }

    setSaving(true);
    try {
      if (editingClient) {
        await clientsApi.update(editingClient.id, validation.data);
        setPageToast("Client updated.");
      } else {
        await clientsApi.create(validation.data);
        setPageToast("Client created.");
      }
      setPageError("");
      closeDrawer();
      await loadClients();
    } catch (submitError) {
      setFormError(parseApiError(submitError, editingClient ? "Unable to update client" : "Unable to create client"));
    } finally {
      setSaving(false);
    }
  };

  const onDeleteConfirmed = async () => {
    const id = confirmDeleteId;
    setDeletingId(id);
    setPageError("");
    setPageToast("");
    try {
      await clientsApi.remove(id);
      setConfirmDeleteId("");
      setPageToast("Client deleted.");
      if (editingClient?.id === id) closeDrawer();
      await loadClients();
    } catch (deleteError) {
      setPageError(parseApiError(deleteError, "Unable to delete client"));
    } finally {
      setDeletingId("");
    }
  };

  const openRequestDocsModal = (client) => {
    setRequestDocsClient(client);
    setRequestDocsTypes(requestDocsTypeOptions.map(([value]) => value));
    setRequestDocsError("");
    setMagicLink(null);
    setCopyFeedback("");
  };

  const closeRequestDocsModal = () => {
    setRequestDocsClient(null);
    setRequestDocsLoading(false);
    setRequestDocsError("");
    setMagicLink(null);
    setCopyFeedback("");
  };

  const onSendDocRequest = async () => {
    if (!requestDocsClient || requestDocsTypes.length === 0) return;
    setRequestDocsLoading(true);
    setRequestDocsError("");
    try {
      const result = await clientsApi.requestDocuments(requestDocsClient.id, {
        documentTypes: requestDocsTypes
      });
      setMagicLink(`${window.location.origin}/upload/${result.uploadToken}`);
      await loadClients();
    } catch (requestError) {
      setRequestDocsError(parseApiError(requestError, "Unable to request documents"));
    } finally {
      setRequestDocsLoading(false);
    }
  };

  const onCopyMagicLink = async () => {
    if (!magicLink) return;
    try {
      await navigator.clipboard.writeText(magicLink);
      setCopyFeedback("Copied");
    } catch {
      setCopyFeedback("Unable to copy — copy it manually.");
    }
  };

  const clearFilters = () => {
    setSearchInput("");
    setFilters({ page: 1, limit: 20, search: "", status: "" });
  };

  const getClientMenuItems = (client) => [
    { label: "View details", onSelect: () => navigate(`/clients/${client.id}`) },
    { label: "View documents", onSelect: () => navigate(`/clients/${client.id}/documents`) },
    canAdmin && {
      label: "Request documents",
      onSelect: () => openRequestDocsModal(client)
    },
    canAdmin && "divider",
    canAdmin && { label: "Edit client", onSelect: () => startEdit(client) },
    canAdmin && { label: "Delete client", destructive: true, onSelect: () => setConfirmDeleteId(client.id) }
  ];

  const isFiltering = Boolean(filters.search || filters.status);
  const deletingClient = rows.find((row) => row.id === confirmDeleteId);

  return (
    <AppShell>
      <ConfirmDialog
        open={Boolean(confirmDeleteId)}
        onCancel={() => setConfirmDeleteId("")}
        onConfirm={onDeleteConfirmed}
        title={`Delete ${deletingClient?.name || "client"}?`}
        description="The client, their documents and upload links will be removed. This cannot be undone."
        confirmLabel="Delete client"
        busyLabel="Deleting…"
        busy={deletingId === confirmDeleteId && Boolean(confirmDeleteId)}
        destructive
        error={confirmDeleteId ? pageError : ""}
      />

      <Modal
        open={Boolean(requestDocsClient)}
        onClose={closeRequestDocsModal}
        busy={requestDocsLoading}
        title={magicLink ? "Upload link ready" : "Request documents"}
        description={
          magicLink
            ? `Share this link with ${requestDocsClient?.name}. They can upload from any phone, no login needed.`
            : `Choose what ${requestDocsClient?.name || "the client"} should send. They get a secure upload link.`
        }
        footer={
          magicLink ? (
            <button type="button" className="btn-primary" onClick={closeRequestDocsModal}>
              Done
            </button>
          ) : (
            <>
              <button type="button" className="btn-secondary" disabled={requestDocsLoading} onClick={closeRequestDocsModal}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={requestDocsLoading || requestDocsTypes.length === 0}
                onClick={onSendDocRequest}
              >
                <IconLink size={14} />
                {requestDocsLoading ? "Sending…" : "Send request"}
              </button>
            </>
          )
        }
      >
        {!magicLink ? (
          <fieldset>
            <legend className="label">Document types</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {requestDocsTypeOptions.map(([value, label]) => {
                const checked = requestDocsTypes.includes(value);
                return (
                  <label
                    key={value}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-[0.8125rem] font-medium transition-colors",
                      checked
                        ? "border-ui-accent/40 bg-ui-accent/[0.06] text-ui-fg"
                        : "border-ui-line bg-ui-surface text-ui-fg-2 hover:border-ui-line-strong"
                    )}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded accent-[rgb(var(--ui-accent))]"
                      checked={checked}
                      onChange={(event) =>
                        setRequestDocsTypes((prev) =>
                          event.target.checked ? [...prev, value] : prev.filter((type) => type !== value)
                        )
                      }
                    />
                    {label}
                  </label>
                );
              })}
            </div>
            {requestDocsError ? (
              <Alert tone="err" className="mt-4">
                {requestDocsError}
              </Alert>
            ) : null}
          </fieldset>
        ) : (
          <div>
            <div className="flex items-center gap-2 rounded-lg border border-ui-line bg-ui-subtle p-1.5 pl-3">
              <IconLink size={14} className="text-ui-fg-4" />
              <p className="ui-mono min-w-0 flex-1 truncate text-ui-fg-2" title={magicLink}>
                {magicLink}
              </p>
              <button type="button" className="btn-secondary btn-sm" onClick={onCopyMagicLink}>
                {copyFeedback === "Copied" ? <IconCheck size={13} /> : <IconCopy size={13} />}
                {copyFeedback === "Copied" ? "Copied" : "Copy"}
              </button>
            </div>
            {copyFeedback && copyFeedback !== "Copied" ? <p className="mt-2 text-xs text-ui-err">{copyFeedback}</p> : null}
          </div>
        )}
      </Modal>

      {canAdmin && (
        <Drawer
          open={drawerOpen}
          onClose={closeDrawer}
          title={editingClient ? `Edit ${editingClient.name}` : "Add a client"}
          subtitle={editingClient ? "Update the client's details." : "Create a client profile, then send them an upload link."}
        >
          <form className="space-y-4" onSubmit={onSubmit}>
            <FormField label="Client name" htmlFor="client-name" required>
              <input
                id="client-name"
                className="field"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="M/s Example Industries"
                autoFocus
              />
            </FormField>

            <FormField label="GSTIN" htmlFor="client-gstin" hint="We check it against the GST portal as you type.">
              <input
                id="client-gstin"
                className="field ui-mono uppercase"
                value={form.gstin}
                onChange={(e) => setForm((prev) => ({ ...prev, gstin: e.target.value.toUpperCase() }))}
                placeholder="27AABCA1234A1ZJ"
              />
              {gstLookup.status !== "idle" && gstLookup.message ? (
                <p
                  className={cn(
                    "mt-1.5 flex items-center gap-1.5 text-xs font-medium",
                    gstLookup.status === "valid"
                      ? "text-ui-ok"
                      : gstLookup.status === "fallback" || gstLookup.status === "loading"
                        ? "text-ui-fg-3"
                        : "text-ui-err"
                  )}
                >
                  {gstLookup.status === "valid" ? <IconCheck size={13} /> : null}
                  {gstLookup.status === "valid" ? "Verified: " : ""}
                  {gstLookup.message}
                </p>
              ) : null}
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Email" htmlFor="client-email">
                <input
                  id="client-email"
                  className="field"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="accounts@example.com"
                  type="email"
                />
              </FormField>
              <FormField label="Phone" htmlFor="client-phone">
                <input
                  id="client-phone"
                  className="field"
                  value={form.phone}
                  onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="9876543210"
                />
              </FormField>
            </div>

            <FormField label="Status" htmlFor="client-status">
              <select
                id="client-status"
                className="field"
                value={form.status}
                onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
              >
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="inactive">Inactive</option>
              </select>
            </FormField>

            {formError ? <Alert tone="err">{formError}</Alert> : null}

            <div className="flex gap-2 border-t border-ui-line pt-4">
              <button type="button" className="btn-secondary flex-1" onClick={closeDrawer} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="btn-primary flex-1" disabled={saving}>
                {saving ? (editingClient ? "Saving…" : "Creating…") : editingClient ? "Save changes" : "Create client"}
              </button>
            </div>
          </form>
        </Drawer>
      )}

      <PageHeader
        title="Clients."
        tint="Everyone you collect paperwork from."
        actions={
          canAdmin ? (
            <>
              <button type="button" onClick={() => setImportModalOpen(true)} className="btn-secondary">
                <IconUpload size={14} />
                Import
              </button>
              <button type="button" onClick={openAddDrawer} className="btn-primary">
                <IconPlus size={14} />
                Add client
              </button>
            </>
          ) : null
        }
      />

      {canAdmin && (
        <ClientImportModal open={importModalOpen} onClose={() => setImportModalOpen(false)} onImported={loadClients} />
      )}

      {pageToast ? (
        <Alert tone="ok" className="mb-4" onDismiss={() => setPageToast("")}>
          {pageToast}
        </Alert>
      ) : null}
      {pageError && !confirmDeleteId ? (
        <Alert tone="err" className="mb-4" onDismiss={() => setPageError("")}>
          {pageError}
        </Alert>
      ) : null}

      <section className="panel overflow-hidden">
        <Toolbar>
          <SearchField
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search by name, GSTIN, email or phone"
            label="Search clients"
          />
          <Segmented
            ariaLabel="Filter by status"
            layoutId="clients-status-filter"
            size="sm"
            value={filters.status}
            onChange={(status) => setFilters((prev) => ({ ...prev, page: 1, status }))}
            options={STATUS_FILTERS}
          />
        </Toolbar>

        {loading ? (
          <TableScroll>
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Contact</th>
                  <th>Status</th>
                  <th>Documents</th>
                  <th>Last activity</th>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody>
                <TableRowsSkeleton rows={6} cols={6} />
              </tbody>
            </table>
          </TableScroll>
        ) : listError ? (
          <div className="p-4">
            <EmptyState
              title="Couldn't load your clients"
              description={listError}
              action={
                <button type="button" className="btn-primary" onClick={loadClients}>
                  Try again
                </button>
              }
            />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-4">
            {isFiltering ? (
              <EmptyState
                title="No matching clients"
                description="Try a different search term or clear your filters."
                action={
                  <button type="button" className="btn-secondary" onClick={clearFilters}>
                    Clear filters
                  </button>
                }
              />
            ) : (
              <EmptyState
                icon={<IconUsers size={18} />}
                title="No clients yet"
                description="Add your first client to start collecting and processing their documents."
                action={
                  canAdmin ? (
                    <button type="button" className="btn-primary" onClick={openAddDrawer}>
                      <IconPlus size={14} />
                      Add your first client
                    </button>
                  ) : null
                }
              />
            )}
          </div>
        ) : (
          <>
            {/* Desktop / tablet table */}
            <TableScroll className="hidden md:block">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Contact</th>
                    <th>Status</th>
                    <th>Documents</th>
                    <th>Last activity</th>
                    <th className="w-12">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((client) => {
                    const activityText = lastActivityText(client.documentSummary);
                    return (
                      <tr
                        key={client.id}
                        className={editingClient?.id === client.id && drawerOpen ? "bg-ui-accent/[0.05]" : ""}
                      >
                        <td>
                          <div className="flex items-center gap-3">
                            <Avatar name={client.name} size={30} />
                            <div className="min-w-0">
                              <Link
                                to={`/clients/${client.id}`}
                                className="font-medium text-ui-fg transition-colors hover:text-ui-accent-text"
                              >
                                {client.name}
                              </Link>
                              {client.gstin ? <div className="ui-mono mt-0.5 text-[0.72rem] text-ui-fg-3">{client.gstin}</div> : null}
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="text-ui-fg-2">{client.email || <span className="text-ui-fg-4">—</span>}</div>
                          {client.phone ? <div className="text-xs text-ui-fg-3">{client.phone}</div> : null}
                        </td>
                        <td>
                          <StatusBadge status={client.status} />
                        </td>
                        <td>
                          <Link
                            to={`/clients/${client.id}/documents`}
                            className="inline-flex items-center gap-1.5 rounded hover:text-ui-accent-text"
                          >
                            <IconFile size={13} className="text-ui-fg-4" />
                            <DocumentsCell summary={client.documentSummary} />
                          </Link>
                        </td>
                        <td className="whitespace-nowrap text-xs text-ui-fg-3">
                          {activityText || <span className="text-ui-fg-4">No activity yet</span>}
                        </td>
                        <td className="text-right">
                          <OverflowMenu items={getClientMenuItems(client)} label={`Actions for ${client.name}`} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableScroll>

            {/* Mobile list */}
            <ul className="divide-y divide-ui-line md:hidden">
              {rows.map((client) => {
                const activityText = lastActivityText(client.documentSummary);
                return (
                  <li key={client.id} className="flex items-start gap-3 px-4 py-4">
                    <Avatar name={client.name} size={32} />
                    <div className="min-w-0 flex-1">
                      <Link to={`/clients/${client.id}`} className="block truncate font-medium text-ui-fg hover:text-ui-accent-text">
                        {client.name}
                      </Link>
                      {client.gstin ? <div className="ui-mono mt-0.5 text-[0.72rem] text-ui-fg-3">{client.gstin}</div> : null}
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <StatusBadge status={client.status} />
                        <DocumentsCell summary={client.documentSummary} />
                      </div>
                      <div className="mt-1.5 text-[11px] text-ui-fg-3">Last activity {activityText || "—"}</div>
                    </div>
                    <OverflowMenu items={getClientMenuItems(client)} label={`Actions for ${client.name}`} />
                  </li>
                );
              })}
            </ul>

            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              noun="client"
              onPage={(page) => setFilters((prev) => ({ ...prev, page }))}
            />
          </>
        )}
      </section>
    </AppShell>
  );
};

export default ClientsPage;
