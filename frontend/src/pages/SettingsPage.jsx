import { useEffect, useState } from "react";
import { z } from "zod";
import AppShell from "../components/layout/AppShell";
import LoadingState from "../components/ui/LoadingState";
import { firmsApi } from "../api/firms-api";
import { parseApiError } from "../lib/utils";
import { useAuth } from "../contexts/AuthContext";

const firmSchema = z.object({
  name: z.string().min(2, "Firm name must be at least 2 characters").max(255, "Firm name is too long")
});

const planStyles = {
  starter: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  professional: "bg-indigo-500/10 text-indigo-700 border-indigo-500/30",
  enterprise: "bg-mint-500/10 text-mint-600 border-mint-500/30"
};

const PlanBadge = ({ plan }) => {
  const normalized = String(plan || "starter").toLowerCase();
  const style = planStyles[normalized] || planStyles.starter;
  const label = normalized.charAt(0).toUpperCase() + normalized.slice(1);
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${style}`}>
      {label}
    </span>
  );
};

const roleLabelMap = {
  admin: "Admin",
  staff: "Staff",
  owner: "Owner"
};

const roleStyles = {
  admin: "bg-indigo-500/10 text-indigo-700 border-indigo-500/30",
  staff: "bg-ink-900/10 text-ink-700 border-ink-700/30",
  owner: "bg-mint-500/10 text-mint-600 border-mint-500/30"
};

const RoleBadge = ({ role }) => {
  const normalized = String(role || "staff").toLowerCase();
  const style = roleStyles[normalized] || roleStyles.staff;
  const label = roleLabelMap[normalized] || normalized;
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${style}`}>
      {label}
    </span>
  );
};

const SettingsPage = () => {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState({ name: "" });

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const result = await firmsApi.getSettings();
        if (active) {
          setSettings(result);
          setForm({ name: result.name || "" });
        }
      } catch (loadError) {
        if (active) {
          setError(parseApiError(loadError, "Unable to load firm settings"));
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const onSaveFirm = async (event) => {
    event.preventDefault();
    setError("");
    setToast("");

    const validation = firmSchema.safeParse(form);
    if (!validation.success) {
      setError(validation.error.issues[0]?.message || "Invalid form values");
      return;
    }

    setSaving(true);
    try {
      const updated = await firmsApi.updateSettings(validation.data);
      setSettings((prev) => ({ ...prev, ...updated }));
      setToast("Firm settings saved successfully.");
    } catch (saveError) {
      setError(parseApiError(saveError, "Unable to save firm settings"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell title="Settings" subtitle="Manage your firm details and account preferences.">
      {loading ? (
        <LoadingState message="Loading settings..." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Firm Settings */}
          <article className="panel p-6">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-ink-900">Firm Settings</h2>
                <p className="mt-0.5 text-sm text-ink-500">Update your firm name and view plan details.</p>
              </div>
              {settings?.plan && <PlanBadge plan={settings.plan} />}
            </div>

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

            <form className="space-y-4" onSubmit={onSaveFirm}>
              <div>
                <label className="label">Firm name</label>
                <input
                  className="field"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Sharma & Associates"
                />
              </div>

              <div>
                <label className="label">Owner email</label>
                <input
                  className="field bg-sand-50 text-ink-500"
                  value={settings?.ownerEmail || settings?.owner_email || ""}
                  readOnly
                  disabled
                />
                <p className="mt-1 text-xs text-ink-500">Contact support to change the owner email.</p>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-[#e7dcc8] bg-sand-50/60 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-ink-900">Current plan</p>
                  <p className="text-xs text-ink-500 mt-0.5">
                    {settings?.plan === "enterprise"
                      ? "Full access with priority support"
                      : settings?.plan === "professional"
                      ? "Extended limits and team features"
                      : "Entry-level plan for small firms"}
                  </p>
                </div>
                <PlanBadge plan={settings?.plan} />
              </div>

              <button type="submit" className="btn-primary w-full" disabled={saving}>
                {saving ? "Saving..." : "Save changes"}
              </button>
            </form>
          </article>

          {/* My Profile */}
          <article className="panel p-6">
            <div className="mb-5">
              <h2 className="text-lg font-bold text-ink-900">My Profile</h2>
              <p className="mt-0.5 text-sm text-ink-500">Your account details for this firm.</p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-4 rounded-xl border border-[#e7dcc8] bg-sand-50/60 px-4 py-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-mint-500 to-mint-600 text-sm font-bold text-white shadow-sm">
                  {(user?.name || "U")
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ink-900">{user?.name || "-"}</p>
                  <p className="truncate text-xs text-ink-500">{user?.email || "-"}</p>
                </div>
                <div className="ml-auto flex-shrink-0">
                  <RoleBadge role={user?.role} />
                </div>
              </div>

              <div>
                <label className="label">Full name</label>
                <input
                  className="field bg-sand-50 text-ink-500"
                  value={user?.name || ""}
                  readOnly
                  disabled
                />
              </div>

              <div>
                <label className="label">Email address</label>
                <input
                  className="field bg-sand-50 text-ink-500"
                  value={user?.email || ""}
                  readOnly
                  disabled
                />
              </div>

              <div>
                <label className="label">Role</label>
                <div className="field flex items-center bg-sand-50">
                  <RoleBadge role={user?.role} />
                </div>
              </div>

              <p className="text-xs text-ink-500">
                To update your profile details, contact your firm administrator.
              </p>
            </div>
          </article>
        </div>
      )}
    </AppShell>
  );
};

export default SettingsPage;
