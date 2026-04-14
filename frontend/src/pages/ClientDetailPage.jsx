import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import AppShell from "../components/layout/AppShell";
import EmptyState from "../components/ui/EmptyState";
import { ClientDetailSkeleton } from "../components/ui/skeletons";
import StatCard from "../components/ui/StatCard";
import StatusBadge from "../components/ui/StatusBadge";
import { clientsApi } from "../api/clients-api";
import { formatDateTime, parseApiError } from "../lib/utils";

const editSchema = z.object({
  name: z.string().min(2, "Client name is required").max(255),
  email: z.string().email("Enter a valid email").or(z.literal("")).transform((v) => v || null),
  phone: z.string().max(15).or(z.literal("")).transform((v) => v || null),
  gstin: z.string().max(15).or(z.literal("")).transform((v) => (v ? v.toUpperCase() : null)),
  status: z.enum(["active", "inactive", "pending"])
});

const ClientDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [client, setClient] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", phone: "", gstin: "", status: "active" });
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

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

  useEffect(() => {
    loadClient();
  }, [id]);

  const onRequestDocs = async () => {
    setRequesting(true);
    setError("");
    setToast("");
    try {
      const result = await clientsApi.requestDocuments(id);
      setToast(`Upload link refreshed. Expires ${formatDateTime(result.uploadTokenExpiresAt)}.`);
      await loadClient();
    } catch (requestError) {
      setError(parseApiError(requestError, "Unable to request documents"));
    } finally {
      setRequesting(false);
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

  const summary = client?.documentSummary || {};

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
                <button
                  type="button"
                  className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition"
                  onClick={() => { setShowEdit(!showEdit); setError(""); }}
                >
                  {showEdit ? "Cancel edit" : "Edit"}
                </button>
              </div>

              {showEdit ? (
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
                        onChange={(e) => setEditForm((p) => ({ ...p, gstin: e.target.value }))}
                      />
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
                <button type="button" className="btn-primary w-full" disabled={requesting} onClick={onRequestDocs}>
                  {requesting ? "Refreshing link..." : "Request documents"}
                </button>
                <Link className="btn-secondary block w-full text-center" to={`/clients/${id}/documents`}>
                  View documents
                </Link>
                <Link className="btn-secondary block w-full text-center" to="/clients">
                  Back to clients list
                </Link>
                <hr className="border-[#e7dcc8]" />
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full rounded-lg border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 transition disabled:opacity-50"
                >
                  {deleting ? "Deleting..." : "Delete client"}
                </button>
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
