import { useEffect, useState } from "react";
import { z } from "zod";
import AppShell from "../components/layout/AppShell";
import { TableRowsSkeleton } from "../components/ui/skeletons";
import EmptyState from "../components/ui/EmptyState";
import Modal, { ConfirmDialog } from "../components/app/Modal";
import { TableScroll } from "../components/app/TableKit";
import { Alert, Avatar, Badge, Card, FormField, PageHeader } from "../components/app/primitives";
import { IconPlus, IconTrash } from "../components/app/icons";
import { usersApi } from "../api/users-api";
import { useAuth } from "../contexts/AuthContext";
import { cn, formatDate, parseApiError } from "../lib/utils";
import { isAdmin } from "../utils/permissions";

const inviteSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["admin", "staff"], { errorMap: () => ({ message: "Select a valid role" }) })
});

const TeamPage = () => {
  const { user: currentUser } = useAuth();
  const canAdmin = isAdmin(currentUser);

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
      setToast("Invite sent.");
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

  const confirmingMember = rows.find((member) => member.id === confirmDeleteId);
  const admins = rows.filter((member) => String(member.role).toLowerCase() === "admin").length;

  return (
    <AppShell>
      <ConfirmDialog
        open={Boolean(confirmDeleteId)}
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={() => onDeleteConfirm(confirmDeleteId)}
        title={`Remove ${confirmingMember?.name || "team member"}?`}
        description="They lose access to the firm immediately. Their past reviews and exports stay in the audit log."
        confirmLabel="Remove member"
        busyLabel="Removing…"
        busy={Boolean(deletingId)}
        destructive
      />

      <Modal
        open={canAdmin && showInviteForm}
        onClose={onCancelInvite}
        busy={saving}
        title="Invite a team member"
        description="They sign in with this email and the temporary password you set."
        footer={
          <>
            <button type="button" className="btn-secondary" disabled={saving} onClick={onCancelInvite}>
              Cancel
            </button>
            <button type="submit" form="invite-form" className="btn-primary" disabled={saving}>
              {saving ? "Inviting…" : "Send invite"}
            </button>
          </>
        }
      >
        <form id="invite-form" className="space-y-4" onSubmit={onInvite}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Full name" htmlFor="invite-name">
              <input
                id="invite-name"
                className="field"
                value={form.name}
                placeholder="Jane Doe"
                autoFocus
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </FormField>
            <FormField label="Email" htmlFor="invite-email">
              <input
                id="invite-email"
                className="field"
                type="email"
                value={form.email}
                placeholder="jane@yourfirm.in"
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              />
            </FormField>
          </div>
          <FormField label="Temporary password" htmlFor="invite-password" hint="At least 8 characters. Ask them to change it after signing in.">
            <input
              id="invite-password"
              className="field"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
            />
          </FormField>
          <div>
            <p className="label">Role</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                ["staff", "Staff", "Reviews documents and runs reconciliation."],
                ["admin", "Admin", "Everything, plus clients, exports, team and settings."]
              ].map(([value, label, help]) => (
                <label
                  key={value}
                  className={cn(
                    "flex cursor-pointer gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                    form.role === value ? "border-ui-accent/40 bg-ui-accent/[0.06]" : "border-ui-line hover:border-ui-line-strong"
                  )}
                >
                  <input
                    type="radio"
                    name="invite-role"
                    className="mt-0.5 h-4 w-4 accent-[rgb(var(--ui-accent))]"
                    checked={form.role === value}
                    onChange={() => setForm((prev) => ({ ...prev, role: value }))}
                  />
                  <span>
                    <span className="block text-[0.8125rem] font-medium text-ui-fg">{label}</span>
                    <span className="block text-xs text-ui-fg-3">{help}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          {formError ? <Alert tone="err">{formError}</Alert> : null}
        </form>
      </Modal>

      <PageHeader
        title="Team."
        tint="The people doing the work."
        description={`${rows.length} member${rows.length === 1 ? "" : "s"} · ${admins} admin${admins === 1 ? "" : "s"}`}
        actions={
          canAdmin ? (
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setShowInviteForm(true);
                setFormError("");
              }}
            >
              <IconPlus size={14} />
              Invite member
            </button>
          ) : null
        }
      />

      {error ? (
        <Alert tone="err" className="mb-5" onDismiss={() => setError("")}>
          {error}
        </Alert>
      ) : null}
      {toast ? (
        <Alert tone="ok" className="mb-5" onDismiss={() => setToast("")}>
          {toast}
        </Alert>
      ) : null}

      <Card className="overflow-hidden">
        {loading ? (
          <TableScroll>
            <table className="ui-table">
              <tbody>
                <TableRowsSkeleton rows={4} cols={4} />
              </tbody>
            </table>
          </TableScroll>
        ) : rows.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No team members yet" description="Invite your first colleague to share the review load." />
          </div>
        ) : (
          <ul className="divide-y divide-ui-line">
            {rows.map((member) => {
              const isCurrentUser = currentUser?.id === member.id;
              const isAdminRole = String(member.role).toLowerCase() === "admin";
              return (
                <li key={member.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                  <Avatar name={member.name} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-[0.875rem] font-medium text-ui-fg">
                      <span className="truncate">{member.name}</span>
                      {isCurrentUser ? <span className="text-xs font-normal text-ui-fg-4">You</span> : null}
                    </p>
                    <p className="truncate text-[0.8125rem] text-ui-fg-3">{member.email}</p>
                  </div>
                  <div className="hidden text-right text-xs text-ui-fg-3 sm:block">
                    Joined {formatDate(member.createdAt || member.created_at)}
                  </div>
                  <Badge tone={isAdminRole ? "accent" : "neutral"}>{isAdminRole ? "Admin" : "Staff"}</Badge>
                  <div className="w-24 text-right">
                    {canAdmin && !isCurrentUser ? (
                      <button type="button" className="btn-ghost btn-sm hover:text-ui-err" onClick={() => setConfirmDeleteId(member.id)}>
                        <IconTrash size={13} />
                        Remove
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </AppShell>
  );
};

export default TeamPage;
