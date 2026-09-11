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
import { clientsApi } from "../api/clients-api";
import { complianceApi } from "../api/compliance-api";
import { useAuth } from "../contexts/AuthContext";
import { formatDate, parseApiError } from "../lib/utils";
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
  ["bank_statement", "Bank Statements"],
  ["bill", "Bills"],
  ["other", "Other"]
];

const PlusIcon = () => (
  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.25">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
);

const SearchIcon = () => (
  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
  </svg>
);

const documentSummaryText = (summary) => {
  const total = summary?.totalDocuments || 0;
  if (total === 0) return null;
  const pending = summary?.pendingDocuments || 0;
  if (pending > 0) return `${total} total · ${pending} pending`;
  return `${total} document${total === 1 ? "" : "s"}`;
};

const lastActivityText = (summary) => (summary?.lastActivityAt ? formatDate(summary.lastActivityAt) : null);

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
  const [formToast, setFormToast] = useState("");
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

    setGstLookup({ status: "loading", message: "Checking GST portal...", legalName: "" });
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
    setFormToast("");
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
    setFormToast("");
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
    setFormToast("");

    const validation = clientSchema.safeParse(form);
    if (!validation.success) {
      setFormError(validation.error.issues[0]?.message || "Invalid form values");
      return;
    }

    setSaving(true);
    try {
      if (editingClient) {
        await clientsApi.update(editingClient.id, validation.data);
        setPageToast("Client updated successfully.");
      } else {
        await clientsApi.create(validation.data);
        setPageToast("Client created successfully.");
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
      setCopyFeedback("Copied!");
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

  const canGoPrevious = pagination.page > 1;
  const canGoNext = pagination.totalPages > pagination.page;
  const isFiltering = Boolean(filters.search || filters.status);

  return (
    <AppShell>
      {/* Delete confirmation modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-sm">
          <div className="panel mx-4 w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-ink-900">Delete client?</h3>
            <p className="mt-2 text-sm text-[#607086]">
              This will permanently delete the client and all associated data. This cannot be undone.
            </p>
            {pageError ? (
              <div className="mt-3 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {pageError}
              </div>
            ) : null}
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                className="btn-secondary flex-1"
                disabled={deletingId === confirmDeleteId}
                onClick={() => setConfirmDeleteId("")}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingId === confirmDeleteId}
                className="flex-1 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={onDeleteConfirmed}
              >
                {deletingId === confirmDeleteId ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Request documents modal */}
      {requestDocsClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-sm">
          <div className="panel mx-4 w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-ink-900">
              Request Documents from {requestDocsClient.name}
            </h3>

            {!magicLink ? (
              <>
                <div className="mt-4">
                  <label className="label">Document types</label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {requestDocsTypeOptions.map(([value, label]) => (
                      <label
                        key={value}
                        className="flex items-center gap-2 rounded-lg border border-[#e7dcc8] px-3 py-2 text-sm"
                      >
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

                {requestDocsError ? (
                  <div className="mt-3 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {requestDocsError}
                  </div>
                ) : null}

                <div className="mt-5 flex gap-3">
                  <button
                    type="button"
                    className="btn-secondary flex-1"
                    disabled={requestDocsLoading}
                    onClick={closeRequestDocsModal}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-primary flex-1"
                    disabled={requestDocsLoading || requestDocsTypes.length === 0}
                    onClick={onSendDocRequest}
                  >
                    {requestDocsLoading ? "Sending..." : "Send Request"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="mt-3 text-sm text-mint-700">
                  Request sent! Share this link with your client:
                </p>
                <p className="mt-2 break-all rounded-lg border border-[#e4d8c5] bg-sand-50 px-3 py-2 font-mono text-xs text-[#596a82]">
                  {magicLink}
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={onCopyMagicLink}>
                    Copy Link
                  </button>
                  {copyFeedback && (
                    <span className="text-xs font-semibold text-mint-700">{copyFeedback}</span>
                  )}
                </div>

                <div className="mt-5">
                  <button type="button" className="btn-primary w-full" onClick={closeRequestDocsModal}>
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Add / Edit client drawer */}
      {canAdmin && (
        <Drawer
          open={drawerOpen}
          onClose={closeDrawer}
          title={editingClient ? `Edit ${editingClient.name}` : "Add new client"}
          subtitle={editingClient ? "Update client details below." : "Create a client profile and issue upload links."}
        >
          <form className="space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="label">Client name</label>
              <input
                className="field"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="M/s Example Industries"
                autoFocus
              />
            </div>

            <div>
              <label className="label">Email</label>
              <input
                className="field"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="accounts@example.com"
                type="email"
              />
            </div>

            <div>
              <label className="label">Phone</label>
              <input
                className="field"
                value={form.phone}
                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="9876543210"
              />
            </div>

            <div>
              <label className="label">GSTIN</label>
              <input
                className="field uppercase"
                value={form.gstin}
                onChange={(e) => setForm((prev) => ({ ...prev, gstin: e.target.value.toUpperCase() }))}
                placeholder="22AAAAA0000A1Z5"
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
                value={form.status}
                onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
              >
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {formError ? (
              <div className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {formError}
              </div>
            ) : null}

            {formToast ? (
              <div className="rounded-lg border border-mint-300 bg-mint-500/10 px-3 py-2 text-sm text-mint-700">
                {formToast}
              </div>
            ) : null}

            <div className="flex gap-3 pt-2">
              <button type="button" className="btn-secondary flex-1" onClick={closeDrawer} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="btn-primary flex-1" disabled={saving}>
                {saving
                  ? editingClient ? "Saving..." : "Creating..."
                  : editingClient ? "Save changes" : "Create client"}
              </button>
            </div>
          </form>
        </Drawer>
      )}

      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">Clients</h1>
          <p className="mt-1 text-sm text-ink-500">
            Manage your firm&apos;s clients, documents, and upload requests.
          </p>
        </div>
        {canAdmin && (
          <div className="flex gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setImportModalOpen(true)}
              className="btn-secondary inline-flex items-center justify-center gap-2"
            >
              Import Clients
            </button>
            <button
              type="button"
              onClick={openAddDrawer}
              className="btn-primary inline-flex items-center justify-center gap-2"
            >
              <PlusIcon />
              Add client
            </button>
          </div>
        )}
      </div>

      {canAdmin && (
        <ClientImportModal
          open={importModalOpen}
          onClose={() => setImportModalOpen(false)}
          onImported={loadClients}
        />
      )}

      {pageToast ? (
        <div className="mb-4 rounded-lg border border-mint-300 bg-mint-500/10 px-4 py-3 text-sm font-semibold text-mint-700">
          {pageToast}
        </div>
      ) : null}
      {pageError ? (
        <div className="mb-4 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {pageError}
        </div>
      ) : null}

      <article className="panel p-4">
        {/* Search + filter toolbar */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400">
              <SearchIcon />
            </span>
            <input
              className="field pl-9 pr-8"
              placeholder="Search clients by name, GSTIN, email or phone..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            {searchInput ? (
              <button
                type="button"
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700"
                onClick={() => setSearchInput("")}
              >
                ×
              </button>
            ) : null}
          </div>
          <select
            className="field sm:max-w-[180px]"
            value={filters.status}
            onChange={(e) => setFilters((prev) => ({ ...prev, page: 1, status: e.target.value }))}
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {loading ? (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0">
              <thead>
                <tr className="bg-sand-100 text-left text-xs uppercase tracking-wide text-[#6d7e95]">
                  <th className="rounded-l-lg px-3 py-3">Client</th>
                  <th className="px-3 py-3">Contact</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Documents</th>
                  <th className="px-3 py-3">Last activity</th>
                  <th className="rounded-r-lg px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                <TableRowsSkeleton rows={6} cols={6} />
              </tbody>
            </table>
          </div>
        ) : listError ? (
          <EmptyState
            title="Couldn't load your clients."
            description={listError}
            action={
              <button type="button" className="btn-primary" onClick={loadClients}>
                Try again
              </button>
            }
          />
        ) : rows.length === 0 ? (
          isFiltering ? (
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
              title="No clients yet"
              description="Add your first client to start collecting and processing financial documents."
              action={
                canAdmin ? (
                  <button type="button" className="btn-primary inline-flex items-center gap-2" onClick={openAddDrawer}>
                    <PlusIcon />
                    Add your first client
                  </button>
                ) : null
              }
            />
          )
        ) : (
          <>
            {/* Desktop / tablet table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr className="bg-sand-100 text-left text-xs uppercase tracking-wide text-[#6d7e95]">
                    <th className="rounded-l-lg px-3 py-3">Client</th>
                    <th className="px-3 py-3">Contact</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Documents</th>
                    <th className="px-3 py-3">Last activity</th>
                    <th className="rounded-r-lg px-3 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((client) => {
                    const docsText = documentSummaryText(client.documentSummary);
                    const activityText = lastActivityText(client.documentSummary);
                    return (
                      <tr
                        key={client.id}
                        className={`border-t border-[#eadfcf] transition-colors hover:bg-sand-50/50 ${
                          editingClient?.id === client.id && drawerOpen ? "bg-indigo-50/50" : ""
                        }`}
                      >
                        <td className="px-3 py-4 align-middle">
                          <Link
                            to={`/clients/${client.id}`}
                            className="font-semibold text-ink-900 transition-colors hover:text-indigo-600 hover:underline"
                          >
                            {client.name}
                          </Link>
                          {client.gstin && (
                            <div className="mt-0.5 font-mono text-xs text-ink-400">{client.gstin}</div>
                          )}
                        </td>
                        <td className="px-3 py-4 align-middle">
                          <div className="text-sm text-ink-700">{client.email || "-"}</div>
                          {client.phone && <div className="text-xs text-ink-400">{client.phone}</div>}
                        </td>
                        <td className="px-3 py-4 align-middle">
                          <StatusBadge status={client.status} />
                        </td>
                        <td className="px-3 py-4 align-middle text-sm text-ink-700">
                          {docsText || <span className="text-ink-400">No documents</span>}
                        </td>
                        <td className="px-3 py-4 align-middle text-xs text-[#6e7f96]">
                          {activityText || <span className="text-ink-400">No activity yet</span>}
                        </td>
                        <td className="px-3 py-4 text-right align-middle">
                          <OverflowMenu items={getClientMenuItems(client)} label={`Actions for ${client.name}`} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="divide-y divide-[#eee3cf] md:hidden">
              {rows.map((client) => {
                const docsText = documentSummaryText(client.documentSummary);
                const activityText = lastActivityText(client.documentSummary);
                return (
                  <div key={client.id} className="flex items-start justify-between gap-3 py-4">
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/clients/${client.id}`}
                        className="block truncate font-semibold text-ink-900 hover:text-indigo-600 hover:underline"
                      >
                        {client.name}
                      </Link>
                      {client.gstin && (
                        <div className="mt-0.5 font-mono text-xs text-ink-400">{client.gstin}</div>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <StatusBadge status={client.status} />
                        {docsText && <span className="text-xs text-ink-500">{docsText}</span>}
                      </div>
                      {(client.email || client.phone) && (
                        <div className="mt-1.5 text-xs text-ink-500">
                          {[client.email, client.phone].filter(Boolean).join(" · ")}
                        </div>
                      )}
                      <div className="mt-1 text-[11px] text-ink-400">
                        Last activity: {activityText || "No activity yet"}
                      </div>
                    </div>
                    <OverflowMenu items={getClientMenuItems(client)} label={`Actions for ${client.name}`} />
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            <div className="mt-4 flex items-center justify-between text-sm">
              <p className="text-[#6b7b90]">
                {pagination.total} client{pagination.total === 1 ? "" : "s"} · Page {pagination.page} of{" "}
                {Math.max(1, pagination.totalPages || 1)}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-secondary px-3 py-1.5 text-xs"
                  disabled={!canGoPrevious}
                  onClick={() => setFilters((prev) => ({ ...prev, page: prev.page - 1 }))}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="btn-secondary px-3 py-1.5 text-xs"
                  disabled={!canGoNext}
                  onClick={() => setFilters((prev) => ({ ...prev, page: prev.page + 1 }))}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </article>
    </AppShell>
  );
};

export default ClientsPage;
