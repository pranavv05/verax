import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import EmptyState from "../components/ui/EmptyState";
import LoadingState from "../components/ui/LoadingState";
import StatCard from "../components/ui/StatCard";
import StatusBadge from "../components/ui/StatusBadge";
import { dashboardApi } from "../api/dashboard-api";
import { formatDateTime, parseApiError } from "../lib/utils";

const DashboardPage = () => {
  const [data, setData] = useState({
    totalClients: 0,
    pendingDocs: 0,
    exportedThisMonth: 0,
    activity: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const result = await dashboardApi.getOverview();
        if (active) {
          setData(result);
        }
      } catch (loadError) {
        if (active) {
          setError(parseApiError(loadError, "Unable to load dashboard"));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const cards = useMemo(
    () => [
      {
        label: "Total clients",
        value: data.totalClients,
        hint: "All active and inactive client records"
      },
      {
        label: "Docs pending review",
        value: data.pendingDocs,
        hint: "Uploaded documents waiting in queue",
        tone: "warning"
      },
      {
        label: "Docs exported this month",
        value: data.exportedThisMonth,
        hint: "Generated and downloaded tally exports",
        tone: "success"
      }
    ],
    [data]
  );

  return (
    <AppShell
      title="Dashboard"
      subtitle="Portfolio-wide snapshot for your CA firm, including pending reviews and export activity."
    >
      {loading ? <LoadingState message="Loading dashboard metrics..." /> : null}
      {error ? (
        <div className="mb-4 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <article className="panel p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-ink-900">Recent export activity</h2>
            <Link to="/export" className="text-sm font-semibold text-ink-800 underline">
              Open export center
            </Link>
          </div>

          {data.activity.length === 0 ? (
            <EmptyState
              title="No recent activity"
              description="Once exports are generated, activity entries will appear here."
            />
          ) : (
            <div className="space-y-3">
              {data.activity.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-2 rounded-xl border border-[#eadfcf] bg-sand-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-ink-900">
                      Export <span className="font-mono text-xs">{item.id.slice(0, 8)}</span>
                    </p>
                    <p className="text-xs text-[#6d7d93]">{formatDateTime(item.exportedAt || item.createdAt)}</p>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="panel p-5">
          <h2 className="text-lg font-bold text-ink-900">Quick actions</h2>
          <div className="mt-4 space-y-3 text-sm">
            <Link className="block rounded-lg border border-[#dccdb0] bg-white px-4 py-3 font-semibold hover:bg-sand-100" to="/clients">
              Manage clients and request documents
            </Link>
            <Link className="block rounded-lg border border-[#dccdb0] bg-white px-4 py-3 font-semibold hover:bg-sand-100" to="/export">
              Generate Tally XML export
            </Link>
            <Link className="block rounded-lg border border-[#dccdb0] bg-white px-4 py-3 font-semibold hover:bg-sand-100" to="/upload/sample-token">
              Preview public upload flow
            </Link>
          </div>
        </article>
      </section>
    </AppShell>
  );
};

export default DashboardPage;
