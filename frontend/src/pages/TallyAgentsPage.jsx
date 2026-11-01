import { useEffect, useRef, useState } from "react";
import AppShell from "../components/layout/AppShell";
import EmptyState from "../components/ui/EmptyState";
import LoadingState from "../components/ui/LoadingState";
import { Alert, Badge, Card, CardHeader, FormField, PageHeader } from "../components/app/primitives";
import { tallyApi } from "../api/tally-api";
import { useAuth } from "../contexts/AuthContext";
import { parseApiError } from "../lib/utils";
import { isAdmin } from "../utils/permissions";

const relativeTime = (iso) => {
  if (!iso) return "never";
  const diffMs = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diffMs)) return "never";
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)} d ago`;
};

// An agent seen within 2 minutes is considered online (it heartbeats on a short
// poll). Anything older is offline/idle.
const isOnline = (iso) => {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() < 2 * 60 * 1000;
};

const TallyAgentsPage = () => {
  const { user } = useAuth();
  const canAdmin = isAdmin(user);

  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [tallyCompany, setTallyCompany] = useState("");
  const [registering, setRegistering] = useState(false);
  const [newToken, setNewToken] = useState(null);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await tallyApi.listAgents();
      setAgents(data.agents || []);
    } catch (loadError) {
      setError(parseApiError(loadError, "Unable to load Tally agents"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  const onRegister = async (event) => {
    event.preventDefault();
    if (!name.trim()) return;
    setRegistering(true);
    setError("");
    setNewToken(null);
    try {
      const result = await tallyApi.registerAgent({ name: name.trim(), tallyCompany: tallyCompany.trim() });
      setNewToken({ token: result.token, name: result.agent?.name });
      setName("");
      setTallyCompany("");
      await load();
    } catch (registerError) {
      setError(parseApiError(registerError, "Unable to register the agent"));
    } finally {
      setRegistering(false);
    }
  };

  const onRevoke = async (agentId) => {
    setError("");
    try {
      await tallyApi.revokeAgent(agentId);
      await load();
    } catch (revokeError) {
      setError(parseApiError(revokeError, "Unable to revoke the agent"));
    }
  };

  const onCopyToken = async () => {
    if (!newToken?.token) return;
    try {
      await navigator.clipboard.writeText(newToken.token);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the token is visible for manual copy.
    }
  };

  return (
    <AppShell>
      <PageHeader
        breadcrumbs={[{ label: "Settings", to: "/settings" }, { label: "Tally agent" }]}
        title="Tally agent."
        tint="Push vouchers straight into TallyPrime."
        description="Install the Verax agent next to TallyPrime on the machine that runs your books. It pulls approved vouchers from Verax and posts them into Tally — no manual XML import."
      />

      {!canAdmin ? (
        <Alert tone="info">Only firm admins can manage Tally agents.</Alert>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <Card>
            <CardHeader title="Add an agent" description="Register one agent per machine running Tally." />
            <form className="flex flex-col gap-4 px-5 py-5" onSubmit={onRegister}>
              <FormField label="Agent name" htmlFor="agent-name" hint="Something you'll recognise, e.g. 'Front desk PC'.">
                <input
                  id="agent-name"
                  className="field"
                  value={name}
                  maxLength={120}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Office desktop"
                  required
                />
              </FormField>
              <FormField label="Tally company (optional)" htmlFor="agent-company" hint="The exact company name the agent should import into.">
                <input
                  id="agent-company"
                  className="field"
                  value={tallyCompany}
                  maxLength={255}
                  onChange={(event) => setTallyCompany(event.target.value)}
                  placeholder="Acme Traders (2026-27)"
                />
              </FormField>
              <div>
                <button type="submit" className="btn-primary" disabled={registering || !name.trim()}>
                  {registering ? "Creating…" : "Create agent"}
                </button>
              </div>
            </form>

            {newToken ? (
              <div className="border-t border-ui-line px-5 py-4">
                <Alert tone="warn" title="Copy this token now — it is shown only once">
                  <p className="mb-2 text-ui-fg-2">
                    Paste it into the Verax agent on <span className="font-medium">{newToken.name}</span>. It cannot be
                    retrieved later; if you lose it, revoke the agent and create a new one.
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="ui-mono block flex-1 overflow-x-auto rounded-md border border-ui-line bg-ui-inset px-3 py-2 text-[0.72rem] text-ui-fg">
                      {newToken.token}
                    </code>
                    <button type="button" className="btn-secondary btn-sm shrink-0" onClick={onCopyToken}>
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                </Alert>
              </div>
            ) : null}
          </Card>

          <Card>
            <CardHeader title="Your agents" description="Status updates as each agent checks in." />
            {loading ? (
              <div className="p-6">
                <LoadingState message="Loading agents…" />
              </div>
            ) : error ? (
              <div className="px-5 py-4">
                <Alert tone="err">{error}</Alert>
              </div>
            ) : agents.length === 0 ? (
              <div className="p-4">
                <EmptyState compact title="No agents yet" description="Create one to start pushing vouchers into Tally." />
              </div>
            ) : (
              <ul className="divide-y divide-ui-line">
                {agents.map((agent) => {
                  const online = agent.status === "active" && isOnline(agent.last_seen_at);
                  return (
                    <li key={agent.id} className="flex items-center justify-between gap-3 px-5 py-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium text-ui-fg">{agent.name}</span>
                          {agent.status === "revoked" ? (
                            <Badge tone="neutral">Revoked</Badge>
                          ) : (
                            <Badge tone={online ? "ok" : "warn"} dot>
                              {online ? "Online" : "Offline"}
                            </Badge>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-ui-fg-3">
                          {agent.tally_company ? `${agent.tally_company} · ` : ""}
                          last seen {relativeTime(agent.last_seen_at)}
                          {agent.agent_version ? ` · ${agent.agent_version}` : ""}
                        </p>
                      </div>
                      {agent.status !== "revoked" ? (
                        <button type="button" className="btn-ghost btn-sm shrink-0" onClick={() => onRevoke(agent.id)}>
                          Revoke
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      )}
    </AppShell>
  );
};

export default TallyAgentsPage;
