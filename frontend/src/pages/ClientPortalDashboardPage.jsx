import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ClientPortalShell from "../components/layout/ClientPortalShell";
import ClientStatusBadge from "../components/ui/ClientStatusBadge";
import { clientPortalApi } from "../api/client-portal-api";
import { useClientPortalAuth } from "../contexts/ClientPortalAuthContext";
import { formatDate, parseApiError } from "../lib/utils";

const StatTile = ({ label, value, hint }) => (
  <div className="rounded-2xl border border-[#e7dcc8] bg-white p-4">
    <p className="text-3xl font-extrabold text-ink-900">{value}</p>
    <p className="mt-1 text-base font-semibold text-ink-800">{label}</p>
    {hint ? <p className="mt-1 text-sm text-[#607086]">{hint}</p> : null}
  </div>
);

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

  return (
    <ClientPortalShell
      title={`Hello${clientName ? ` ${clientName}` : ""}, here's your status`}
      subtitle="A quick look at everything your accountant is working on for you."
    >
      {error ? (
        <div className="mb-6 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-base font-medium text-rose-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="text-base text-[#607086]">Loading your summary...</p>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Total documents" value={stats?.totalDocuments ?? 0} />
            <StatTile
              label="Processing"
              value={stats?.processingCount ?? 0}
              hint="Being read right now"
            />
            <StatTile
              label="Under review"
              value={stats?.reviewCount ?? 0}
              hint="With your accountant"
            />
            <StatTile label="Complete" value={stats?.completedCount ?? 0} hint="Filed and done" />
          </section>

          <p className="mt-4 text-base text-[#607086]">
            {stats?.thisMonthDocuments ?? 0} document
            {(stats?.thisMonthDocuments ?? 0) === 1 ? "" : "s"} added this month.
          </p>

          <section className="mt-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-ink-900">Recent documents</h2>
              <Link
                className="text-base font-semibold text-ink-700 underline"
                to="/client-portal/documents"
              >
                See all
              </Link>
            </div>

            {recent.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-[#e7dcc8] bg-sand-50 px-4 py-6 text-base text-[#607086]">
                Nothing here yet. Documents will appear as soon as they're sent in.
              </div>
            ) : (
              <ul className="mt-4 space-y-3">
                {recent.map((document) => (
                  <li
                    key={document.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e7dcc8] bg-white p-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-ink-900">
                        {document.originalFilename}
                      </p>
                      <p className="text-sm text-[#607086]">{formatDate(document.createdAt)}</p>
                    </div>
                    <ClientStatusBadge status={document.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-8 grid gap-4 sm:grid-cols-2">
            <Link
              className="rounded-2xl border border-[#e7dcc8] bg-white p-5 transition hover:bg-sand-50"
              to="/client-portal/documents"
            >
              <p className="text-lg font-bold text-ink-900">Your documents</p>
              <p className="mt-1 text-base text-[#607086]">
                See everything we hold and download your originals.
              </p>
            </Link>
            <Link
              className="rounded-2xl border border-[#e7dcc8] bg-white p-5 transition hover:bg-sand-50"
              to="/client-portal/reconciliation"
            >
              <p className="text-lg font-bold text-ink-900">GST summary</p>
              <p className="mt-1 text-base text-[#607086]">
                Check how your invoices compare against the GST portal.
              </p>
            </Link>
          </section>
        </>
      )}
    </ClientPortalShell>
  );
};

export default ClientPortalDashboardPage;
