import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import EmptyState from "../components/ui/EmptyState";
import LoadingState from "../components/ui/LoadingState";
import StatCard from "../components/ui/StatCard";
import StatusBadge from "../components/ui/StatusBadge";
import { dashboardApi } from "../api/dashboard-api";
import { formatDateTime, parseApiError } from "../lib/utils";

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

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
        hint: "All active and inactive client records",
        icon: (
          <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
          </svg>
        ),
        gradient: "from-indigo-500 to-indigo-600"
      },
      {
        label: "Docs pending review",
        value: data.pendingDocs,
        hint: "Uploaded documents waiting in queue",
        tone: "warning",
        icon: (
          <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        gradient: "from-ember-500 to-ember-600"
      },
      {
        label: "Docs exported this month",
        value: data.exportedThisMonth,
        hint: "Generated and downloaded tally exports",
        tone: "success",
        icon: (
          <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        gradient: "from-mint-500 to-mint-600"
      }
    ],
    [data]
  );

  return (
    <AppShell
      title=""
      subtitle=""
    >
      {/* Welcome Banner */}
      <section className="mb-6 relative overflow-hidden rounded-2xl bg-gradient-to-br from-ink-900 via-ink-800 to-ink-700 p-6 text-white sm:p-8">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-mint-500/20 blur-[60px]" />
        <div className="absolute bottom-0 left-1/3 h-24 w-24 rounded-full bg-indigo-500/15 blur-[40px]" />
        <div className="relative">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-mint-400">{getGreeting()}</p>
          <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">Dashboard Overview</h1>
          <p className="mt-1 max-w-lg text-sm text-sand-100/60">
            Portfolio-wide snapshot for your CA firm, including pending reviews and export activity.
          </p>
        </div>
      </section>

      {loading ? <LoadingState message="Loading dashboard metrics..." /> : null}
      {error ? (
        <div className="mb-4 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
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
            <Link to="/export" className="text-sm font-semibold text-mint-500 transition hover:text-mint-600">
              Open export center →
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
                  className="flex flex-col gap-2 rounded-xl border border-[#eadfcf] bg-sand-50/60 px-4 py-3 transition-all duration-200 hover:shadow-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-ink-900">
                      Export <span className="font-mono text-xs text-ink-500">{item.id.slice(0, 8)}</span>
                    </p>
                    <p className="text-xs text-ink-500">{formatDateTime(item.exportedAt || item.createdAt)}</p>
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
            <Link
              className="group flex items-center gap-3 rounded-xl border border-[#dccdb0] bg-white px-4 py-3.5 font-semibold transition-all duration-200 hover:bg-sand-100 hover:shadow-sm hover:-translate-y-0.5"
              to="/clients"
            >
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500/10 to-indigo-500/20 text-indigo-600">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                </svg>
              </div>
              <span className="flex-1">Manage clients and request documents</span>
              <svg width="16" height="16" className="text-ink-400 transition group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </Link>
            <Link
              className="group flex items-center gap-3 rounded-xl border border-[#dccdb0] bg-white px-4 py-3.5 font-semibold transition-all duration-200 hover:bg-sand-100 hover:shadow-sm hover:-translate-y-0.5"
              to="/export"
            >
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-mint-500/10 to-mint-500/20 text-mint-600">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
              </div>
              <span className="flex-1">Generate Tally XML export</span>
              <svg width="16" height="16" className="text-ink-400 transition group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </Link>
            <Link
              className="group flex items-center gap-3 rounded-xl border border-[#dccdb0] bg-white px-4 py-3.5 font-semibold transition-all duration-200 hover:bg-sand-100 hover:shadow-sm hover:-translate-y-0.5"
              to="/upload/sample-token"
            >
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-ember-500/10 to-ember-500/20 text-ember-600">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
              </div>
              <span className="flex-1">Preview public upload flow</span>
              <svg width="16" height="16" className="text-ink-400 transition group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </Link>
          </div>
        </article>
      </section>
    </AppShell>
  );
};

export default DashboardPage;
