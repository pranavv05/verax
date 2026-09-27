import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ClientPortalShell from "../components/layout/ClientPortalShell";
import ClientStatusBadge from "../components/ui/ClientStatusBadge";
import LoadingState from "../components/ui/LoadingState";
import { Alert, Card, CardHeader, Progress, StatTile } from "../components/app/primitives";
import { IconArrowRight, IconFile, IconFiles, IconScale } from "../components/app/icons";
import { clientPortalApi } from "../api/client-portal-api";
import { useClientPortalAuth } from "../contexts/ClientPortalAuthContext";
import { formatDate, parseApiError } from "../lib/utils";

const ClientPortalDashboardPage = () => {
  const { clientName } = useClientPortalAuth();
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [statsResult, documentsResult] = await Promise.all([
          clientPortalApi.stats(),
          clientPortalApi.documents({ page: 1, limit: 5 })
        ]);
        if (!active) return;
        setStats(statsResult);
        setRecent(documentsResult.data || []);
      } catch (loadError) {
        if (!active) return;
        setError(parseApiError(loadError, "We couldn't load your summary just now."));
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  const total = stats?.totalDocuments ?? 0;
  const completed = stats?.completedCount ?? 0;
  const thisMonth = stats?.thisMonthDocuments ?? 0;

  return (
    <ClientPortalShell
      title={`Hello${clientName ? `, ${clientName}` : ""}.`}
      subtitle="A quick look at everything your accountant is working on for you."
    >
      {error ? (
        <Alert tone="err" className="mb-6">
          {error}
        </Alert>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-16">
          <LoadingState message="Loading your summary…" />
        </div>
      ) : (
        <div className="space-y-6">
          <section aria-label="Summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="All documents" value={total} hint={`${thisMonth} added this month`} />
            <StatTile label="Being read" value={stats?.processingCount ?? 0} tone="accent" hint="Verax is reading these now" />
            <StatTile label="With your accountant" value={stats?.reviewCount ?? 0} tone="warn" hint="Being checked" />
            <StatTile label="Complete" value={completed} tone="ok" hint="Filed into your accounts" />
          </section>

          {total > 0 ? (
            <Card>
              <div className="px-5 py-5">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[0.9375rem] font-medium text-ui-fg">Filed so far</p>
                  <p className="text-[0.9375rem] font-semibold tabular-nums text-ui-fg">
                    {completed} <span className="font-normal text-ui-fg-3">of {total}</span>
                  </p>
                </div>
                <Progress value={completed} max={total} className="mt-3 h-2" label="Documents filed" />
              </div>
            </Card>
          ) : null}

          <Card className="overflow-hidden">
            <CardHeader
              title="Recent documents"
              action={
                <Link to="/client-portal/documents" className="link-action text-[0.875rem]">
                  See all
                  <IconArrowRight size={14} />
                </Link>
              }
            />
            {recent.length === 0 ? (
              <p className="px-5 py-10 text-center text-[0.9375rem] text-ui-fg-3">
                Nothing here yet. Documents appear as soon as they're sent in.
              </p>
            ) : (
              <ul className="divide-y divide-ui-line">
                {recent.map((document) => (
                  <li key={document.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-ui-line bg-ui-subtle text-ui-fg-3">
                      <IconFile size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.9375rem] font-medium text-ui-fg">{document.originalFilename}</p>
                      <p className="text-sm text-ui-fg-3">{formatDate(document.createdAt)}</p>
                    </div>
                    <ClientStatusBadge status={document.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <section className="grid gap-4 sm:grid-cols-2">
            {[
              {
                to: "/client-portal/documents",
                icon: IconFiles,
                title: "Your documents",
                body: "See everything we hold and download your originals."
              },
              {
                to: "/client-portal/reconciliation",
                icon: IconScale,
                title: "GST summary",
                body: "Check how your invoices compare against the GST portal."
              }
            ].map(({ to, icon: Icon, title, body }) => (
              <Link
                key={to}
                to={to}
                className="panel group flex items-start gap-4 p-5 transition-[border-color,box-shadow,transform] hover:-translate-y-px hover:border-ui-line-strong hover:shadow-ui-pop focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-accent"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-ui-line bg-ui-subtle text-ui-fg-3">
                  <Icon size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-semibold text-ui-fg">{title}</span>
                  <span className="mt-1 block text-[0.9375rem] text-ui-fg-3">{body}</span>
                </span>
                <IconArrowRight size={16} className="mt-1 text-ui-fg-4 transition-transform group-hover:translate-x-0.5 group-hover:text-ui-fg-2" />
              </Link>
            ))}
          </section>
        </div>
      )}
    </ClientPortalShell>
  );
};

export default ClientPortalDashboardPage;
