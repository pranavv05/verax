import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import AppShell from "../components/layout/AppShell";
import EmptyState from "../components/ui/EmptyState";
import { TableRowsSkeleton } from "../components/ui/skeletons";
import StatusBadge from "../components/ui/StatusBadge";
import { clientsApi } from "../api/clients-api";
import { formatDateTime, parseApiError } from "../lib/utils";

const newClientSchema = z.object({
  name: z.string().min(2, "Client name is required").max(255),
  email: z
    .string()
    .email("Enter a valid email")
    .or(z.literal(""))
    .transform((value) => value || null),
  phone: z
    .string()
    .max(15, "Phone should be 15 chars max")
    .or(z.literal(""))
    .transform((value) => value || null),
  gstin: z
    .string()
    .max(15, "GSTIN should be 15 chars max")
    .or(z.literal(""))
    .transform((value) => (value ? value.toUpperCase() : null)),
  status: z.enum(["active", "inactive", "pending"]) 
});

const ClientsPage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [requestingId, setRequestingId] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

  const [filters, setFilters] = useState({ page: 1, limit: 20, search: "", status: "" });
  const [form, setForm] = useState({ name: "", email: "", phone: "", gstin: "", status: "active" });

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

  const onCreateClient = async (event) => {
    event.preventDefault();
    setError("");
    setToast("");

    const validation = newClientSchema.safeParse(form);
    if (!validation.success) {
      setError(validation.error.issues[0]?.message || "Invalid form values");
      return;
    }

    setSaving(true);
    try {
      await clientsApi.create(validation.data);
      setForm({ name: "", email: "", phone: "", gstin: "", status: "active" });
      setToast("Client created successfully.");
      await loadClients();
    } catch (submitError) {
      setError(parseApiError(submitError, "Unable to create client"));
    } finally {
      setSaving(false);
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

  const hasRows = rows.length > 0;

  const canGoPrevious = pagination.page > 1;
  const canGoNext = pagination.totalPages > pagination.page;

  const tableBody = useMemo(() => {
    if (!hasRows) {
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
      <tr key={client.id} className="border-t border-[#eadfcf]">
        <td className="px-3 py-3 text-sm font-semibold text-ink-900">{client.name}</td>
        <td className="px-3 py-3 text-sm text-[#5f6f84]">{client.gstin || "-"}</td>
        <td className="px-3 py-3 text-sm text-[#5f6f84]">{client.email || "-"}</td>
        <td className="px-3 py-3 text-sm text-[#5f6f84]">{client.phone || "-"}</td>
        <td className="px-3 py-3 text-sm">
          <StatusBadge status={client.status} />
        </td>
        <td className="px-3 py-3 text-xs text-[#6e7f96]">{formatDateTime(client.createdAt)}</td>
        <td className="px-3 py-3 text-right text-sm">
          <div className="flex flex-wrap justify-end gap-2">
            <Link className="btn-secondary px-2.5 py-1.5 text-xs" to={`/clients/${client.id}`}>
              Details
            </Link>
            <Link className="btn-secondary px-2.5 py-1.5 text-xs" to={`/clients/${client.id}/documents`}>
              Documents
            </Link>
            <button
              type="button"
              className="btn-primary px-2.5 py-1.5 text-xs"
              disabled={requestingId === client.id}
              onClick={() => onRequestDocs(client.id)}
            >
              {requestingId === client.id ? "Sending..." : "Request docs"}
            </button>
          </div>
        </td>
      </tr>
    ));
  }, [hasRows, requestingId, rows]);

  return (
    <AppShell title="Clients" subtitle="Search, filter, and manage clients across your firm.">
      <section className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <article className="panel p-4">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 gap-2">
              <input
                className="field"
                placeholder="Search by name, email, GSTIN, phone"
                value={filters.search}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, page: 1, search: event.target.value }))
                }
              />
              <select
                className="field max-w-[170px]"
                value={filters.status}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, page: 1, status: event.target.value }))
                }
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

        <article className="panel p-4">
          <h2 className="text-lg font-bold text-ink-900">Add new client</h2>
          <p className="mt-1 text-sm text-[#66778f]">Create a client profile and issue upload links.</p>

          <form className="mt-4 space-y-3" onSubmit={onCreateClient}>
            <div>
              <label className="label">Client name</label>
              <input
                className="field"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="M/s Example Industries"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Email</label>
                <input
                  className="field"
                  value={form.email}
                  onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                  placeholder="accounts@example.com"
                  type="email"
                />
              </div>
              <div>
                <label className="label">Phone</label>
                <input
                  className="field"
                  value={form.phone}
                  onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                  placeholder="9876543210"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">GSTIN</label>
                <input
                  className="field"
                  value={form.gstin}
                  onChange={(event) => setForm((prev) => ({ ...prev, gstin: event.target.value }))}
                  placeholder="22AAAAA0000A1Z5"
                />
              </div>
              <div>
                <label className="label">Status</label>
                <select
                  className="field"
                  value={form.status}
                  onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
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
              {saving ? "Creating..." : "Create client"}
            </button>
          </form>
        </article>
      </section>
    </AppShell>
  );
};

export default ClientsPage;
