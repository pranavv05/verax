import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import ClientPortalShell from "../components/layout/ClientPortalShell";
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
        const [me, exportsResult] = await Promise.all([
          clientPortalApi.me(),
          clientPortalApi.exports()
        ]);
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

  return (
    <ClientPortalShell title="Settings" subtitle="Your details and your password.">
      {loadError ? (
        <div className="mb-6 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-base font-medium text-rose-700">
          {loadError}
        </div>
      ) : null}

      {loading ? (
        <p className="text-base text-[#607086]">Loading your details...</p>
      ) : (
        <>
          <section className="rounded-2xl border border-[#e7dcc8] bg-white p-5">
            <h2 className="text-xl font-bold text-ink-900">Your details</h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-semibold uppercase tracking-wide text-[#6a7b90]">
                  Business
                </dt>
                <dd className="text-base font-semibold text-ink-900">{profile?.name || "-"}</dd>
              </div>
              <div>
                <dt className="text-sm font-semibold uppercase tracking-wide text-[#6a7b90]">
                  Email
                </dt>
                <dd className="break-all text-base font-semibold text-ink-900">
                  {profile?.email || "-"}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-semibold uppercase tracking-wide text-[#6a7b90]">
                  GST number
                </dt>
                <dd className="text-base font-semibold text-ink-900">{profile?.gstin || "-"}</dd>
              </div>
              <div>
                <dt className="text-sm font-semibold uppercase tracking-wide text-[#6a7b90]">
                  Your accountant
                </dt>
                <dd className="text-base font-semibold text-ink-900">
                  {profile?.firmName || "-"}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-sm font-semibold uppercase tracking-wide text-[#6a7b90]">
                  Last signed in
                </dt>
                <dd className="text-base font-semibold text-ink-900">
                  {profile?.portalLastLoginAt
                    ? formatDateTime(profile.portalLastLoginAt)
                    : "This is your first visit"}
                </dd>
              </div>
            </dl>
          </section>

          <section className="mt-6 rounded-2xl border border-[#e7dcc8] bg-white p-5">
            <h2 className="text-xl font-bold text-ink-900">Filed to your accounts</h2>
            <p className="mt-1 text-base text-[#607086]">
              Each time your accountant files a batch of your documents, it shows up here.
            </p>
            {exportsList.length === 0 ? (
              <p className="mt-4 rounded-xl border border-[#e7dcc8] bg-sand-50 px-4 py-4 text-base text-[#607086]">
                Nothing has been filed yet.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {exportsList.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#e7dcc8] px-4 py-3"
                  >
                    <div>
                      <p className="text-base font-semibold text-ink-900">
                        {entry.documentCount} document{entry.documentCount === 1 ? "" : "s"}
                      </p>
                      <p className="text-sm text-[#607086]">{entry.period || "-"}</p>
                    </div>
                    <p className="text-sm text-[#607086]">{formatDateTime(entry.exportedAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-6 rounded-2xl border border-[#e7dcc8] bg-white p-5">
            <h2 className="text-xl font-bold text-ink-900">Change your password</h2>

            {done ? (
              <div className="mt-4 rounded-xl border border-mint-300 bg-mint-500/10 px-4 py-4 text-base text-mint-700">
                Password changed. Please sign in again with your new password — taking you back to
                the sign-in page now.
              </div>
            ) : (
              <form className="mt-4 space-y-5" onSubmit={onChangePassword}>
                <div>
                  <label className="label" htmlFor="current-password">
                    Current password
                  </label>
                  <input
                    id="current-password"
                    className="field py-3 text-base"
                    type="password"
                    autoComplete="current-password"
                    value={form.currentPassword}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, currentPassword: event.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="label" htmlFor="new-password">
                    New password
                  </label>
                  <input
                    id="new-password"
                    className="field py-3 text-base"
                    type="password"
                    autoComplete="new-password"
                    value={form.newPassword}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, newPassword: event.target.value }))
                    }
                  />
                  <p className="mt-1 text-sm text-[#607086]">At least 8 characters.</p>
                </div>
                <div>
                  <label className="label" htmlFor="confirm-password">
                    Repeat new password
                  </label>
                  <input
                    id="confirm-password"
                    className="field py-3 text-base"
                    type="password"
                    autoComplete="new-password"
                    value={form.confirmPassword}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, confirmPassword: event.target.value }))
                    }
                  />
                </div>

                {formError ? (
                  <div className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-base font-medium text-rose-700">
                    {formError}
                  </div>
                ) : null}

                <button type="submit" className="btn-primary w-full py-3 text-base" disabled={saving}>
                  {saving ? "Saving..." : "Change password"}
                </button>
              </form>
            )}
          </section>
        </>
      )}
    </ClientPortalShell>
  );
};

export default ClientPortalSettingsPage;
