import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import ClientPortalShell from "../components/layout/ClientPortalShell";
import LoadingState from "../components/ui/LoadingState";
import { Alert, Card, CardHeader, FormField } from "../components/app/primitives";
import { IconCheckCircle, IconLock, IconUser } from "../components/app/icons";
import { clientPortalApi } from "../api/client-portal-api";
import { useClientPortalAuth } from "../contexts/ClientPortalAuthContext";
import { formatDateTime, parseApiError } from "../lib/utils";

const passwordSchema = z
  .object({
    currentPassword: z.string().min(8, "Enter your current password"),
    newPassword: z.string().min(8, "Your new password must be at least 8 characters"),
    confirmPassword: z.string()
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: "The two new passwords don't match",
    path: ["confirmPassword"]
  });

const ClientPortalSettingsPage = () => {
  const { clearSession } = useClientPortalAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [exportsList, setExportsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setLoadError("");
      try {
        const [me, exportsResult] = await Promise.all([clientPortalApi.me(), clientPortalApi.exports()]);
        if (!active) return;
        setProfile(me);
        setExportsList(exportsResult.data || []);
      } catch (error) {
        if (!active) return;
        setLoadError(parseApiError(error, "We couldn't load your details just now."));
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  const onChangePassword = async (event) => {
    event.preventDefault();
    setFormError("");

    const validation = passwordSchema.safeParse(form);
    if (!validation.success) {
      setFormError(validation.error.issues[0]?.message || "Check the passwords you entered");
      return;
    }

    setSaving(true);
    try {
      await clientPortalApi.changePassword({
        currentPassword: validation.data.currentPassword,
        newPassword: validation.data.newPassword
      });
      // Changing the password revokes every session, including this one.
      setDone(true);
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      clearSession();
      window.setTimeout(() => navigate("/client-portal/login", { replace: true }), 2500);
    } catch (error) {
      setFormError(parseApiError(error, "We couldn't change your password."));
    } finally {
      setSaving(false);
    }
  };

  const details = [
    ["Business", profile?.name],
    ["Email", profile?.email],
    ["GST number", profile?.gstin, true],
    ["Your accountant", profile?.firmName],
    ["Last signed in", profile?.portalLastLoginAt ? formatDateTime(profile.portalLastLoginAt) : "This is your first visit"]
  ];

  return (
    <ClientPortalShell title="Settings." subtitle="Your details and your password.">
      {loadError ? (
        <Alert tone="err" className="mb-6">
          {loadError}
        </Alert>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-16">
          <LoadingState message="Loading your details…" />
        </div>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader title="Your details" icon={<IconUser size={14} />} />
            <dl className="grid gap-x-6 gap-y-5 px-5 py-5 sm:grid-cols-2">
              {details.map(([label, value, mono]) => (
                <div key={label}>
                  <dt className="text-sm text-ui-fg-3">{label}</dt>
                  <dd className={`mt-1 break-all text-base font-medium text-ui-fg ${mono ? "ui-mono" : ""}`}>{value || "—"}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title="Filed to your accounts" description="Each time your accountant files a batch of your documents, it shows up here." />
            {exportsList.length === 0 ? (
              <p className="px-5 py-8 text-center text-[0.9375rem] text-ui-fg-3">Nothing has been filed yet.</p>
            ) : (
              <ul className="divide-y divide-ui-line">
                {exportsList.map((entry) => (
                  <li key={entry.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                    <IconCheckCircle size={18} className="text-ui-ok" />
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-medium text-ui-fg">
                        {entry.documentCount} document{entry.documentCount === 1 ? "" : "s"}
                      </p>
                      <p className="text-sm text-ui-fg-3">{entry.period || "—"}</p>
                    </div>
                    <p className="text-sm text-ui-fg-3">{formatDateTime(entry.exportedAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Change your password" icon={<IconLock size={14} />} />
            <div className="px-5 py-5">
              {done ? (
                <Alert tone="ok" title="Password changed">
                  Please sign in again with your new password — taking you back to the sign-in page now.
                </Alert>
              ) : (
                <form className="max-w-md space-y-5" onSubmit={onChangePassword}>
                  <FormField label="Current password" htmlFor="current-password">
                    <input
                      id="current-password"
                      className="field py-2.5 text-[0.9375rem]"
                      type="password"
                      autoComplete="current-password"
                      value={form.currentPassword}
                      onChange={(event) => setForm((prev) => ({ ...prev, currentPassword: event.target.value }))}
                    />
                  </FormField>
                  <FormField label="New password" htmlFor="new-password" hint="At least 8 characters.">
                    <input
                      id="new-password"
                      className="field py-2.5 text-[0.9375rem]"
                      type="password"
                      autoComplete="new-password"
                      value={form.newPassword}
                      onChange={(event) => setForm((prev) => ({ ...prev, newPassword: event.target.value }))}
                    />
                  </FormField>
                  <FormField label="Repeat new password" htmlFor="confirm-password">
                    <input
                      id="confirm-password"
                      className="field py-2.5 text-[0.9375rem]"
                      type="password"
                      autoComplete="new-password"
                      value={form.confirmPassword}
                      onChange={(event) => setForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                    />
                  </FormField>

                  {formError ? <Alert tone="err">{formError}</Alert> : null}

                  <button type="submit" className="btn-primary py-2.5 text-[0.875rem]" disabled={saving}>
                    {saving ? "Saving…" : "Change password"}
                  </button>
                </form>
              )}
            </div>
          </Card>
        </div>
      )}
    </ClientPortalShell>
  );
};

export default ClientPortalSettingsPage;
