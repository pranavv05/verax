import { useEffect, useState } from "react";
import { z } from "zod";
import AppShell from "../components/layout/AppShell";
import LoadingState from "../components/ui/LoadingState";
import EmptyState from "../components/ui/EmptyState";
import { usersApi } from "../api/users-api";
import { useAuth } from "../contexts/AuthContext";
import { formatDateTime, parseApiError } from "../lib/utils";

const inviteSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["admin", "staff"], { errorMap: () => ({ message: "Select a valid role" }) })
});

const RoleBadge = ({ role }) => {
  const normalized = String(role || "staff").toLowerCase();
  if (normalized === "admin") {
    return (
      <span className="inline-flex rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-xs font-semibold text-indigo-700">
        Admin
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full border border-ink-700/30 bg-ink-900/10 px-2.5 py-1 text-xs font-semibold text-ink-700">
      Staff
    </span>
  );
};

const TeamPage = () => {
  const { user: currentUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [rows, setRows] = useState([]);

  const [showInviteForm, setShowInviteForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "staff" });
  const [formError, setFormError] = useState("");

  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const loadUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await usersApi.list();
      setRows(result.data || result || []);
    } catch (loadError) {
      setError(parseApiError(loadError, "Unable to load team members"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const onInvite = async (event) => {
    event.preventDefault();
    setFormError("");
    setToast("");

    const validation = inviteSchema.safeParse(form);
    if (!validation.success) {
      setFormError(validation.error.issues[0]?.message || "Invalid form values");
      return;
    }

    setSaving(true);
    try {
      await usersApi.invite(validation.data);
      setForm({ name: "", email: "", password: "", role: "staff" });
      setShowInviteForm(false);
      setToast("Team member invited successfully.");
      await loadUsers();
    } catch (submitError) {
      setFormError(parseApiError(submitError, "Unable to invite team member"));
    } finally {
      setSaving(false);
    }
  };

  const onDeleteConfirm = async (id) => {
    setDeletingId(id);
    setError("");
    setToast("");
    try {
      await usersApi.remove(id);
      setConfirmDeleteId(null);
      setToast("Team member removed.");
      await loadUsers();
    } catch (deleteError) {
      setError(parseApiError(deleteError, "Unable to remove team member"));
    } finally {
      setDeletingId(null);
    }
  };

  const onCancelInvite = () => {
    setShowInviteForm(false);
    setForm({ name: "", email: "", password: "", role: "staff" });
    setFormError("");
  };

  return (
    <AppShell title="Team" subtitle="Manage team members and their access roles.">
      <div className="space-y-5">
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

        {/* Team member list */}
        <article className="panel p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-ink-900">Team members</h2>
              <p className="mt-0.5 text-sm text-ink-500">
                {rows.length} member{rows.length !== 1 ? "s" : ""} in your firm
              </p>
            </div>
            <button
              type="button"
              className="btn-primary text-sm"
              onClick={() => {
                setShowInviteForm((prev) => !prev);
                setFormError("");
              }}
            >
              {showInviteForm ? "Cancel" : "Invite team member"}
            </button>
          </div>

          {/* Inline invite form */}
          {showInviteForm && (
            <div className="mb-5 rounded-xl border border-[#e7dcc8] bg-sand-50/60 p-5">
              <h3 className="mb-4 text-sm font-bold text-ink-900">Invite a new team member</h3>
              <form className="space-y-3" onSubmit={onInvite}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label">Full name</label>
                    <input
                      className="field"
                      value={form.name}
                      placeholder="Jane Doe"
                      onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="label">Email address</label>
                    <input
                      className="field"
                      type="email"
                      value={form.email}
                      placeholder="jane@yourfirm.com"
                      onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label">Password</label>
                    <input
                      className="field"
                      type="password"
                      value={form.password}
                      placeholder="Min. 8 characters"
                      onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="label">Role</label>
                    <select
                      className="field"
                      value={form.role}
                      onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
                    >
                      <option value="staff">Staff</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>

                {formError ? (
                  <div className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                    {formError}
                  </div>
                ) : null}

                <div className="flex gap-2 pt-1">
                  <button type="submit" className="btn-primary text-sm" disabled={saving}>
                    {saving ? "Inviting..." : "Send invite"}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary text-sm"
                    disabled={saving}
                    onClick={onCancelInvite}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {loading ? (
            <LoadingState message="Loading team members..." />
          ) : rows.length === 0 ? (
            <EmptyState
              title="No team members yet"
              description="Invite your first team member to collaborate on document processing."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr className="bg-sand-100 text-left text-xs uppercase tracking-wide text-[#6d7e95]">
                    <th className="rounded-l-lg px-3 py-3">Name</th>
                    <th className="px-3 py-3">Email</th>
                    <th className="px-3 py-3">Role</th>
                    <th className="px-3 py-3">Joined</th>
                    <th className="rounded-r-lg px-3 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((member) => {
                    const isCurrentUser = currentUser?.id === member.id;
                    const isConfirming = confirmDeleteId === member.id;
                    const isDeleting = deletingId === member.id;

                    return (
                      <tr key={member.id} className="border-t border-[#eadfcf]">
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-ink-900/10 to-ink-900/20 text-xs font-bold text-ink-700">
                              {(member.name || "U")
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .toUpperCase()
                                .slice(0, 2)}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-ink-900">
                                {member.name}
                                {isCurrentUser && (
                                  <span className="ml-2 text-xs font-normal text-ink-500">(you)</span>
                                )}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-sm text-ink-500">{member.email}</td>
                        <td className="px-3 py-3">
                          <RoleBadge role={member.role} />
                        </td>
                        <td className="px-3 py-3 text-xs text-[#6e7f96]">
                          {formatDateTime(member.createdAt || member.created_at)}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {isCurrentUser ? (
                            <span className="text-xs text-ink-400">Cannot remove yourself</span>
                          ) : isConfirming ? (
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-xs text-ink-700">Are you sure?</span>
                              <button
                                type="button"
                                className="rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
                                disabled={isDeleting}
                                onClick={() => onDeleteConfirm(member.id)}
                              >
                                {isDeleting ? "Removing..." : "Yes, remove"}
                              </button>
                              <button
                                type="button"
                                className="btn-secondary px-2.5 py-1 text-xs"
                                disabled={isDeleting}
                                onClick={() => setConfirmDeleteId(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-100 hover:border-rose-300"
                              onClick={() => setConfirmDeleteId(member.id)}
                            >
                              Remove
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
        </article>
      </div>
    </AppShell>
  );
};

export default TeamPage;
