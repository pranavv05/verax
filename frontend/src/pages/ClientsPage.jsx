import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import AppShell from "../components/layout/AppShell";
import EmptyState from "../components/ui/EmptyState";
import { TableRowsSkeleton } from "../components/ui/skeletons";
import StatusBadge from "../components/ui/StatusBadge";
import { clientsApi } from "../api/clients-api";
import { formatDateTime, parseApiError } from "../lib/utils";

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

const ClientsPage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [requestingId, setRequestingId] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState({ page: 1, limit: 20, search: "", status: "" });
  const [form, setForm] = useState(emptyForm);
  const [editingClient, setEditingClient] = useState(null); // null = add mode, object = edit mode
  const [confirmDeleteId, setConfirmDeleteId] = useState(""); // id to confirm delete

  const loadClients = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await clientsApi.list(filters);
      setRows(result.data || []);
      setPagination(result.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 });
    } catch (loadError) {
      setError(parseApiError(loadError, "Unable to load clients"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
  }, [filters.page, filters.status, filters.search]);

  const startEdit = (client) => {
    setEditingClient(client);
    setForm({
      name: client.name || "",
      email: client.email || "",
      phone: client.phone || "",
      gstin: client.gstin || "",
      status: client.status || "active"
    });
    setError("");
    setToast("");
  };

  const cancelEdit = () => {
    setEditingClient(null);
    setForm(emptyForm);
    setError("");
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setToast("");

    const validation = clientSchema.safeParse(form);
    if (!validation.success) {
      setError(validation.error.issues[0]?.message || "Invalid form values");
      return;
    }

    setSaving(true);
    try {
      if (editingClient) {
        await clientsApi.update(editingClient.id, validation.data);
        setToast("Client updated successfully.");
        setEditingClient(null);
        setForm(emptyForm);
      } else {
        await clientsApi.create(validation.data);
        setForm(emptyForm);
        setToast("Client created successfully.");
      }
      await loadClients();
    } catch (submitError) {
      setError(parseApiError(submitError, editingClient ? "Unable to update client" : "Unable to create client"));
    } finally {
      setSaving(false);
    }
  };

  const onDeleteConfirmed = async () => {
    const id = confirmDeleteId;
    setConfirmDeleteId("");
    setDeletingId(id);
    setError("");
    setToast("");
    try {
      await clientsApi.remove(id);
      setToast("Client deleted.");
      if (editingClient?.id === id) cancelEdit();
      await loadClients();
    } catch (deleteError) {
      setError(parseApiError(deleteError, "Unable to delete client"));
    } finally {
      setDeletingId("");
    }
  };

  const onRequestDocs = async (clientId) => {
    setRequestingId(clientId);
    setError("");
    setToast("");
    try {
      const result = await clientsApi.requestDocuments(clientId);
      setToast(`Upload link refreshed. Expires at ${formatDateTime(result.uploadTokenExpiresAt)}.`);
      await loadClients();
    } catch (requestError) {
      setError(parseApiError(requestError, "Unable to request documents"));
    } finally {
      setRequestingId("");
    }
  };

  const canGoPrevious = pagination.page > 1;
  const canGoNext = pagination.totalPages > pagination.page;

  const tableBody = useMemo(() => {
    if (!rows.length) {
      return (
        <tr>
          <td colSpan={7} className="p-0">
            <EmptyState
              title="No clients found"
              description="Try changing filters or add a new client to begin collecting documents."
            />
          </td>
        </tr>
      );
    }

    return rows.map((client) => (
      <tr key={client.id} className={`border-t border-[#eadfcf] ${editingClient?.id === client.id ? "bg-indigo-50/50" : ""}`}>
        <td className="px-3 py-3 text-sm font-semibold text-ink-900">{client.name}</td>
        <td className="px-3 py-3 text-sm text-[#5f6f84]">{client.gstin || "-"}</td>
        <td className="px-3 py-3 text-sm text-[#5f6f84]">{client.email || "-"}</td>
        <td className="px-3 py-3 text-sm text-[#5f6f84]">{client.phone || "-"}</td>
        <td className="px-3 py-3 text-sm">
          <StatusBadge status={client.status} />
        </td>
        <td className="px-3 py-3 text-xs text-[#6e7f96]">{formatDateTime(client.createdAt)}</td>
        <td className="px-3 py-3 text-right text-sm">
          <div className="flex flex-wrap justify-end gap-1.5">
            <Link className="btn-secondary px-2 py-1.5 text-xs" to={`/clients/${client.id}`}>
              Details
            </Link>
            <Link className="btn-secondary px-2 py-1.5 text-xs" to={`/clients/${client.id}/documents`}>
              Docs
            </Link>
            <button
              type="button"
              className="btn-secondary px-2 py-1.5 text-xs"
              onClick={() => startEdit(client)}
            >
              Edit
            </button>
            <button
              type="button"
              className="px-2 py-1.5 text-xs rounded-lg border border-rose-300 text-rose-600 hover:bg-rose-50 transition disabled:opacity-50"
              disabled={deletingId === client.id}
              onClick={() => setConfirmDeleteId(client.id)}
            >
              {deletingId === client.id ? "..." : "Delete"}
            </button>
            <button
              type="button"
              className="btn-primary px-2 py-1.5 text-xs"
              disabled={requestingId === client.id}
              onClick={() => onRequestDocs(client.id)}
            >
              {requestingId === client.id ? "..." : "Request docs"}
            </button>
          </div>
        </td>
      </tr>
    ));
  }, [rows, editingClient, deletingId, requestingId]);

  return (
    <AppShell title="Clients" subtitle="Search, filter, and manage clients across your firm.">
      {/* Delete confirmation modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-sm">
          <div className="panel mx-4 w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-ink-900">Delete client?</h3>
            <p className="mt-2 text-sm text-[#607086]">
              This will permanently delete the client and all associated data. This cannot be undone.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                className="btn-secondary flex-1"
                onClick={() => setConfirmDeleteId("")}
              >
                Cancel
              </button>
              <button
                type="button"
                className="flex-1 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 transition"
                onClick={onDeleteConfirmed}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        {/* Client table */}
        <article className="panel p-4">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 gap-2">
              <input
                className="field"
                placeholder="Search by name, email, GSTIN, phone"
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, page: 1, search: e.target.value }))}
              />
              <select
                className="field max-w-[160px]"
                value={filters.status}
                onChange={(e) => setFilters((prev) => ({ ...prev, page: 1, status: e.target.value }))}
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0">
              <thead>
                <tr className="bg-sand-100 text-left text-xs uppercase tracking-wide text-[#6d7e95]">
                  <th className="rounded-l-lg px-3 py-3">Name</th>
                  <th className="px-3 py-3">GSTIN</th>
                  <th className="px-3 py-3">Email</th>
                  <th className="px-3 py-3">Phone</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Created</th>
                  <th className="rounded-r-lg px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? <TableRowsSkeleton rows={6} cols={7} /> : tableBody}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm">
            <p className="text-[#6b7b90]">
              Showing page {pagination.page} of {Math.max(1, pagination.totalPages || 1)}
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
        </article>

        {/* Add / Edit panel */}
        <article className="panel p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-ink-900">
                {editingClient ? `Edit: ${editingClient.name}` : "Add new client"}
              </h2>
              <p className="mt-0.5 text-sm text-[#66778f]">
                {editingClient
                  ? "Update client details below."
                  : "Create a client profile and issue upload links."}
              </p>
            </div>
            {editingClient && (
              <button
                type="button"
                onClick={cancelEdit}
                className="text-xs text-[#607086] hover:text-ink-900 underline"
              >
                Cancel
              </button>
            )}
          </div>

          <form className="mt-4 space-y-3" onSubmit={onSubmit}>
            <div>
              <label className="label">Client name</label>
              <input
                className="field"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="M/s Example Industries"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
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
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">GSTIN</label>
                <input
                  className="field uppercase"
                  value={form.gstin}
                  onChange={(e) => setForm((prev) => ({ ...prev, gstin: e.target.value }))}
                  placeholder="22AAAAA0000A1Z5"
                />
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
            </div>

            {error ? (
              <div className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            {toast ? (
              <div className="rounded-lg border border-mint-300 bg-mint-500/10 px-3 py-2 text-sm text-mint-700">
                {toast}
              </div>
            ) : null}

            <button type="submit" className="btn-primary w-full" disabled={saving}>
              {saving
                ? editingClient ? "Saving..." : "Creating..."
                : editingClient ? "Save changes" : "Create client"}
            </button>
          </form>
        </article>
      </section>
    </AppShell>
  );
};

export default ClientsPage;
