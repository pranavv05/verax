import { Fragment, useEffect, useState } from "react";
import { z } from "zod";
import AppShell from "../components/layout/AppShell";
import { SettingsSkeleton } from "../components/ui/skeletons";
import { TableScroll } from "../components/app/TableKit";
import { Alert, Avatar, Badge, Card, CardFooter, CardHeader, FormField, PageHeader, SectionLabel } from "../components/app/primitives";
import { IconCheck } from "../components/app/icons";
import { useAppTheme } from "../contexts/ThemeContext";
import { firmsApi } from "../api/firms-api";
import { cn, parseApiError } from "../lib/utils";
import { useAuth } from "../contexts/AuthContext";
import { isAdmin } from "../utils/permissions";

const firmSchema = z.object({
  name: z.string().min(2, "Firm name must be at least 2 characters").max(255, "Firm name is too long")
});

const PLAN_TONE = { starter: "neutral", professional: "accent", enterprise: "ok" };

const PLAN_COPY = {
  starter: "Entry-level plan for small firms.",
  professional: "Extended limits and team features.",
  enterprise: "Full access with priority support."
};

const THEME_CHOICES = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" }
];

// A miniature of the app in each theme. Drawn with fixed colours so every
// card shows its own theme regardless of the current one.
const MiniApp = ({ dark }) => (
  <span className={cn("flex h-full flex-col gap-1.5 p-2.5", dark ? "bg-[#0B0C0E]" : "bg-[#F7F6F2]")}>
    <span className="flex items-center gap-1">
      <span className="h-1.5 w-1.5 rounded-full bg-[#6657D9]" />
      <span className={cn("h-1 w-8 rounded-full", dark ? "bg-white/20" : "bg-black/15")} />
    </span>
    <span className={cn("flex-1 rounded-md border p-1.5", dark ? "border-white/10 bg-[#131417]" : "border-black/[0.07] bg-white")}>
      <span className={cn("block h-1 w-10 rounded-full", dark ? "bg-white/30" : "bg-black/25")} />
      <span className={cn("mt-1 block h-1 w-14 rounded-full", dark ? "bg-white/10" : "bg-black/10")} />
      <span className="mt-2 block h-1 w-6 rounded-full bg-[#6657D9]" />
    </span>
  </span>
);

const ThemePreview = ({ variant }) => (
  <span className="block h-24 overflow-hidden">
    {variant === "system" ? (
      <span className="grid h-full grid-cols-2">
        <MiniApp />
        <MiniApp dark />
      </span>
    ) : (
      <MiniApp dark={variant === "dark"} />
    )}
  </span>
);

const roleLabelMap = {
  admin: "Admin",
  staff: "Staff",
  owner: "Owner"
};

const permissionSections = [
  {
    title: "Documents",
    rows: [
      ["Upload documents", true],
      ["View documents / clients", true],
      ["Edit extracted fields", true],
      ["Approve / mark reviewed", false],
      ["Reprocess document", false],
      ["View document version history", true]
    ]
  },
  {
    title: "Clients",
    rows: [
      ["Create client", false],
      ["Update client details", false],
      ["Delete / soft-delete client", false],
      ["Request documents from client", false],
      ["Schedule recurring requests", false],
      ["GST reconciliation view", true],
      ["GST reconciliation export", false]
    ]
  },
  {
    title: "Exports",
    rows: [
      ["Export to Tally", false],
      ["Bulk export", false],
      ["Bulk export preview", false],
      ["View export history", true]
    ]
  },
  {
    title: "Team and settings",
    rows: [
      ["View notifications", true],
      ["View audit logs", false],
      ["Manage team", false],
      ["Update firm settings", false]
    ]
  }
];

const AccessMark = ({ allowed }) =>
  allowed ? (
    <span className="inline-flex text-ui-ok" aria-label="Allowed">
      <IconCheck size={15} />
    </span>
  ) : (
    <span className="text-ui-fg-4" aria-label="Not allowed">
      —
    </span>
  );

const SettingsPage = () => {
  const { user } = useAuth();
  const canAdmin = isAdmin(user);
  const { preference, setPreference } = useAppTheme();

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
      // The top bar shows the firm name; tell it about the rename.
      window.dispatchEvent(new CustomEvent("vx-firm-updated", { detail: { ...settings, ...updated } }));
      setToast("Firm settings saved.");
    } catch (saveError) {
      setError(parseApiError(saveError, "Unable to save firm settings"));
    } finally {
      setSaving(false);
    }
  };

  const planKey = String(settings?.plan || "starter").toLowerCase();
  const sections = [
    { id: "general", label: "General" },
    { id: "plan", label: "Plan" },
    { id: "appearance", label: "Appearance" },
    { id: "profile", label: "Profile" },
    canAdmin ? { id: "permissions", label: "Permissions" } : null
  ].filter(Boolean);
  const nameChanged = (settings?.name || "") !== form.name;

  return (
    <AppShell>
      <PageHeader title="Settings." tint="Your firm, your account, your workspace." />

      {loading ? (
        <SettingsSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[12rem_minmax(0,1fr)]">
          <nav aria-label="Settings sections" className="lg:sticky lg:top-20 lg:self-start">
            <ul className="flex gap-1 overflow-x-auto lg:flex-col">
              {sections.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="block whitespace-nowrap rounded-lg px-3 py-1.5 text-[0.8125rem] font-medium text-ui-fg-3 transition-colors hover:bg-ui-inset hover:text-ui-fg"
                  >
                    {section.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="space-y-6">
            {error ? (
              <Alert tone="err" onDismiss={() => setError("")}>
                {error}
              </Alert>
            ) : null}
            {toast ? (
              <Alert tone="ok" onDismiss={() => setToast("")}>
                {toast}
              </Alert>
            ) : null}

            <Card as="section" id="general" className="scroll-mt-24">
              <form onSubmit={onSaveFirm}>
                <div className="px-6 py-6">
                  <h2 className="text-[0.9375rem] font-semibold tracking-[-0.01em] text-ui-fg">Firm</h2>
                  <p className="mt-1 text-[0.8125rem] text-ui-fg-3">
                    The name your clients see on upload links, emails and the client portal.
                  </p>
                  <div className="mt-5 grid max-w-xl gap-4">
                    <FormField label="Firm name" htmlFor="firm-name">
                      <input
                        id="firm-name"
                        className="field"
                        value={canAdmin ? form.name : settings?.name || ""}
                        disabled={!canAdmin}
                        onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                        placeholder="e.g. Sharma & Associates"
                      />
                    </FormField>
                    <FormField label="Owner email" htmlFor="firm-owner" hint="Contact support to change the owner email.">
                      <input id="firm-owner" className="field" value={settings?.ownerEmail || settings?.owner_email || ""} readOnly disabled />
                    </FormField>
                  </div>
                </div>
                <CardFooter>
                  <span>{canAdmin ? "A new name shows up for your team and clients right away." : "Contact an admin on your team to change firm settings."}</span>
                  {canAdmin ? (
                    <button type="submit" className="btn-primary btn-sm" disabled={saving || !nameChanged}>
                      {saving ? "Saving…" : "Save"}
                    </button>
                  ) : null}
                </CardFooter>
              </form>
            </Card>

            <Card as="section" id="plan" className="scroll-mt-24 overflow-hidden">
              <div className="relative px-6 py-6">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0"
                  style={{ background: "radial-gradient(50% 120% at 100% 0%, rgb(102 87 217 / 0.08), transparent 70%)" }}
                />
                <div className="relative flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-[0.9375rem] font-semibold tracking-[-0.01em] text-ui-fg">Plan</h2>
                    <p className="mt-1 text-[0.8125rem] text-ui-fg-3">{PLAN_COPY[planKey] || PLAN_COPY.starter}</p>
                  </div>
                  <Badge tone={PLAN_TONE[planKey] || "neutral"} className="text-[0.8125rem] capitalize">
                    {planKey}
                  </Badge>
                </div>
              </div>
            </Card>

            <Card as="section" id="appearance" className="scroll-mt-24">
              <div className="px-6 py-6">
                <h2 className="text-[0.9375rem] font-semibold tracking-[-0.01em] text-ui-fg">Appearance</h2>
                <p className="mt-1 text-[0.8125rem] text-ui-fg-3">Choose how Verax looks on this device.</p>
                <div role="radiogroup" aria-label="Theme" className="mt-5 grid gap-3 sm:grid-cols-3">
                  {THEME_CHOICES.map((choice) => {
                    const active = preference === choice.value;
                    return (
                      <button
                        key={choice.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setPreference(choice.value)}
                        className={cn(
                          "group overflow-hidden rounded-xl border text-left outline-none transition-[border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ui-accent",
                          active ? "border-ui-accent shadow-[0_0_0_3px_rgb(var(--ui-accent)/0.15)]" : "border-ui-line hover:border-ui-line-strong"
                        )}
                      >
                        <ThemePreview variant={choice.value} />
                        <span className="flex items-center justify-between border-t border-ui-line px-3 py-2.5">
                          <span className="text-[0.8125rem] font-medium text-ui-fg">{choice.label}</span>
                          <span
                            aria-hidden="true"
                            className={cn(
                              "flex h-4 w-4 items-center justify-center rounded-full border",
                              active ? "border-ui-accent bg-ui-accent text-white" : "border-ui-line-strong"
                            )}
                          >
                            {active ? <IconCheck size={10} strokeWidth={2.4} /> : null}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </Card>

            <Card as="section" id="profile" className="scroll-mt-24">
              <div className="px-6 py-6">
                <h2 className="text-[0.9375rem] font-semibold tracking-[-0.01em] text-ui-fg">Profile</h2>
                <p className="mt-1 text-[0.8125rem] text-ui-fg-3">Your account in this firm.</p>
                <div className="mt-5 flex items-center gap-4">
                  <Avatar name={user?.name} size={48} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.9375rem] font-medium text-ui-fg">{user?.name || "—"}</p>
                    <p className="truncate text-[0.8125rem] text-ui-fg-3">{user?.email || "—"}</p>
                  </div>
                  <Badge tone={String(user?.role).toLowerCase() === "admin" ? "accent" : "neutral"}>
                    {roleLabelMap[String(user?.role || "staff").toLowerCase()] || user?.role}
                  </Badge>
                </div>
              </div>
              <CardFooter>
                <span>To change your name or email, ask a firm admin.</span>
              </CardFooter>
            </Card>

            {canAdmin ? (
              <Card as="section" id="permissions" className="scroll-mt-24 overflow-hidden">
                <CardHeader title="Permissions" description="What admins and staff can do. For reference — roles are set per person on the Team page." />
                <TableScroll>
                  <table className="ui-table">
                    <thead>
                      <tr>
                        <th>Action</th>
                        <th className="w-24 text-center">Admin</th>
                        <th className="w-24 text-center">Staff</th>
                      </tr>
                    </thead>
                    <tbody>
                      {permissionSections.map((section) => (
                        <Fragment key={section.title}>
                          <tr className="hover:!bg-transparent">
                            <td colSpan={3} className="!border-b-0 !pb-1 !pt-5">
                              <SectionLabel>{section.title}</SectionLabel>
                            </td>
                          </tr>
                          {section.rows.map(([action, staffAllowed]) => (
                            <tr key={action}>
                              <td className="text-ui-fg">{action}</td>
                              <td className="text-center">
                                <AccessMark allowed />
                              </td>
                              <td className="text-center">
                                <AccessMark allowed={staffAllowed} />
                              </td>
                            </tr>
                          ))}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </TableScroll>
              </Card>
            ) : null}
          </div>
        </div>
      )}
    </AppShell>
  );
};

export default SettingsPage;
