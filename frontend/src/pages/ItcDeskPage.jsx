import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import EmptyState from "../components/ui/EmptyState";
import LoadingState from "../components/ui/LoadingState";
import { TableScroll } from "../components/app/TableKit";
import { Alert, Badge, Card, FormField, PageHeader, StatTile } from "../components/app/primitives";
import { IconRefresh } from "../components/app/icons";
import { complianceApi } from "../api/compliance-api";
import { parseApiError } from "../lib/utils";

const MONTHS = [
  ["01", "Jan"], ["02", "Feb"], ["03", "Mar"], ["04", "Apr"], ["05", "May"], ["06", "Jun"],
  ["07", "Jul"], ["08", "Aug"], ["09", "Sep"], ["10", "Oct"], ["11", "Nov"], ["12", "Dec"]
];

const formatCurrency = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const getDefaultPeriod = () => {
  // Default to the previous month — the one a firm is usually reconciling.
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return { month: String(d.getMonth() + 1).padStart(2, "0"), year: String(d.getFullYear()) };
};

const STATUS_BADGE = {
  reconciled: { tone: "ok", label: "Reconciled" },
  needs_data: { tone: "warn", label: "Needs GSTR-2B" },
  no_gstin: { tone: "neutral", label: "No GSTIN" },
  error: { tone: "err", label: "Error" }
};

const ItcDeskPage = () => {
  const def = getDefaultPeriod();
  const [month, setMonth] = useState(def.month);
  const [year, setYear] = useState(def.year);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return [String(current), String(current - 1), String(current - 2)];
  }, []);

  const period = `${month}${year}`;

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await complianceApi.getItcDesk({ period });
      setData(result);
    } catch (loadError) {
      setData(null);
      setError(parseApiError(loadError, "Unable to load the ITC Desk"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = data?.totals;
  const deadline = data?.deadline;
  const deadlineSoon = deadline && deadline.daysToDeadline <= 30;
  const deadlinePast = deadline && deadline.daysToDeadline < 0;

  return (
    <AppShell>
      <PageHeader
        title="ITC Desk."
        tint="Every client's input tax credit at risk, in one view."
        description="How much ITC is at risk across your whole book this period, and which clients drive it — so nothing slips before the deadline."
      />

      <Card className="mb-5">
        <div className="flex flex-wrap items-end gap-3 px-5 py-5">
          <FormField label="Return period" htmlFor="itc-month" className="sm:w-40">
            <select id="itc-month" className="field" value={month} onChange={(e) => setMonth(e.target.value)}>
              {MONTHS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Year" htmlFor="itc-year" className="sm:w-32">
            <select id="itc-year" className="field" value={year} onChange={(e) => setYear(e.target.value)}>
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </FormField>
          <button type="button" className="btn-primary sm:mb-px" disabled={loading} onClick={load}>
            <IconRefresh size={14} className={loading ? "animate-spin" : ""} />
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
        {error ? (
          <div className="border-t border-ui-line px-5 py-4">
            <Alert tone="err">{error}</Alert>
          </div>
        ) : null}
      </Card>

      {deadline ? (
        <Alert tone={deadlinePast ? "err" : deadlineSoon ? "warn" : "info"} className="mb-5">
          FY {deadline.financialYear} ITC can be claimed up to the November GSTR-3B.{" "}
          {deadlinePast
            ? "That deadline has passed — unclaimed ITC for this FY may be lost."
            : `About ${deadline.daysToDeadline} day${deadline.daysToDeadline === 1 ? "" : "s"} left to act.`}
        </Alert>
      ) : null}

      {totals ? (
        <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile label="ITC at risk this period" value={formatCurrency(totals.itcAtRisk)} />
          <StatTile label="Clients at risk" value={`${totals.clientsAtRisk} / ${totals.clients}`} />
          <StatTile label="Exceptions to review" value={String(totals.exceptions)} />
          <StatTile
            label="Need GSTR-2B"
            value={String(totals.needsData + totals.noGstin)}
          />
        </div>
      ) : null}

      {loading && !data ? (
        <LoadingState label="Reconciling every client…" />
      ) : data && data.clients.length > 0 ? (
        <Card>
          <TableScroll>
            <table className="w-full text-left text-[0.8125rem]">
              <thead>
                <tr className="border-b border-ui-line text-ui-fg-3">
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Exceptions</th>
                  <th className="px-4 py-3 text-right font-medium">ITC at risk</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ui-line">
                {data.clients.map((c) => {
                  const badge = STATUS_BADGE[c.status] || STATUS_BADGE.needs_data;
                  return (
                    <tr key={c.clientId}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-ui-fg">{c.clientName}</div>
                        {c.gstin ? <div className="ui-mono text-xs text-ui-fg-3">{c.gstin}</div> : null}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={badge.tone}>{badge.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{c.exceptions || 0}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        {c.itcAtRisk > 0 ? (
                          <span className="text-ui-warn">{formatCurrency(c.itcAtRisk)}</span>
                        ) : (
                          formatCurrency(0)
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/clients/${c.clientId}/gst-reconciliation`}
                          className="inline-flex items-center gap-1.5 rounded text-ui-accent-text hover:underline"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableScroll>
        </Card>
      ) : data ? (
        <EmptyState title="No active clients" description="Add clients with a GSTIN to see ITC at risk across your book." />
      ) : null}
    </AppShell>
  );
};

export default ItcDeskPage;
