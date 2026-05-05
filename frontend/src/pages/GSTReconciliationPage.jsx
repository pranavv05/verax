import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import EmptyState from "../components/ui/EmptyState";
import { complianceApi } from "../api/compliance-api";
import { useAuth } from "../contexts/AuthContext";
import { parseApiError } from "../lib/utils";
import { isAdmin } from "../utils/permissions";

const MONTHS = [
  ["01", "Jan"],
  ["02", "Feb"],
  ["03", "Mar"],
  ["04", "Apr"],
  ["05", "May"],
  ["06", "Jun"],
  ["07", "Jul"],
  ["08", "Aug"],
  ["09", "Sep"],
  ["10", "Oct"],
  ["11", "Nov"],
  ["12", "Dec"]
];

const statusStyles = {
  matched: "bg-mint-500/10 text-mint-700",
  partial: "bg-amber-100 text-amber-700",
  mismatch: "bg-rose-100 text-rose-700",
  not_found: "bg-orange-100 text-orange-700",
  unavailable: "bg-slate-100 text-slate-600"
};

const statusLabels = {
  matched: "Matched",
  partial: "Partial",
  mismatch: "Mismatch",
  not_found: "Not Found",
  unavailable: "Unavailable"
};

const getDefaultPeriod = () => {
  const date = new Date();
  date.setMonth(date.getMonth() - 1);
  return {
    month: String(date.getMonth() + 1).padStart(2, "0"),
    year: String(date.getFullYear())
  };
};

const formatCurrency = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

const formatFieldName = (field) =>
  ({
    taxableAmount: "Taxable",
    gstAmount: "GST",
    supplierGSTIN: "Supplier GSTIN",
    invoiceDate: "Invoice Date"
  }[field] || field);

const mismatchText = (row, field) => {
  if (field === "taxableAmount") {
    return `Taxable: ${formatCurrency(row.taxableAmount)} (yours) vs ${formatCurrency(row.gstr2bTaxableAmount)} (GSTR-2B)`;
  }
  if (field === "gstAmount") {
    return `GST: ${formatCurrency(row.gstAmount)} (yours) vs ${formatCurrency(row.gstr2bGstAmount)} (GSTR-2B)`;
  }
  return formatFieldName(field);
};

const percent = (count, total) => (total ? `${Math.round((count / total) * 100)}%` : "0%");

const GSTReconciliationPage = () => {
  const { clientId } = useParams();
  const { user } = useAuth();
  const canAdmin = isAdmin(user);
  const defaultPeriod = getDefaultPeriod();
  const [month, setMonth] = useState(defaultPeriod.month);
  const [year, setYear] = useState(defaultPeriod.year);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [filter, setFilter] = useState("all");

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return [String(current), String(current - 1), String(current - 2)];
  }, []);

  const period = `${month}${year}`;
  const summary = result?.summary || {};
  const mismatchCount = Number(summary.mismatched || 0) + Number(summary.partial || 0);

  const filteredRows = useMemo(() => {
    const rows = result?.rows || [];
    if (filter === "matched") return rows.filter((row) => row.matchStatus === "matched");
    if (filter === "not_found") return rows.filter((row) => row.matchStatus === "not_found");
    if (filter === "mismatches") {
      return rows.filter((row) => ["mismatch", "partial"].includes(row.matchStatus));
    }
    return rows;
  }, [result, filter]);

  const runReconciliation = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await complianceApi.getReconciliation({ clientId, period });
      setResult(data);
      setFilter("all");
    } catch (reconcileError) {
      setResult(null);
      setError(parseApiError(reconcileError, "Unable to run GST reconciliation"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runReconciliation();
  }, [clientId]);

  const onExport = async () => {
    setExporting(true);
    setError("");
    try {
      await complianceApi.downloadReconciliationExcel({ clientId, period });
    } catch (exportError) {
      setError(exportError.message || "Unable to export reconciliation");
    } finally {
      setExporting(false);
    }
  };

  const unavailableOnly = result?.rows?.length > 0 && result.rows.every((row) => row.matchStatus === "unavailable");

  return (
    <AppShell title="GST Reconciliation" subtitle="Match client purchase invoices against GSTR-2B.">
      <div className="mb-4 text-sm font-semibold text-[#607086]">
        <Link to="/clients" className="text-indigo-600 hover:text-indigo-800">Clients</Link>
        <span className="mx-2">/</span>
        {result?.client ? (
          <Link to={`/clients/${result.client.id}`} className="text-indigo-600 hover:text-indigo-800">
            {result.client.name}
          </Link>
        ) : (
          <span>Client</span>
        )}
        <span className="mx-2">/</span>
        <span>GST Reconciliation</span>
      </div>

      <section className="panel p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Month</label>
              <select className="field" value={month} onChange={(event) => setMonth(event.target.value)}>
                {MONTHS.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Year</label>
              <select className="field" value={year} onChange={(event) => setYear(event.target.value)}>
                {years.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" className="btn-primary" disabled={loading} onClick={runReconciliation}>
              {loading ? "Running..." : "Run Reconciliation"}
            </button>
            {canAdmin && (
              <button
                type="button"
                className="btn-secondary"
                disabled={!result || exporting}
                onClick={onExport}
              >
                {exporting ? "Exporting..." : "Export to Excel"}
              </button>
            )}
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {error}
          </div>
        ) : null}
      </section>

      {result ? (
        <>
          {unavailableOnly && (
            <div className="mt-4 rounded-lg border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
              GST portal is currently unreachable. Showing local data only. Match status unavailable.
            </div>
          )}

          <section className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Total Invoices", summary.total || 0, "100%", "border-indigo-200 bg-indigo-50 text-indigo-700"],
              ["Matched", summary.matched || 0, percent(summary.matched || 0, summary.total || 0), "border-mint-300 bg-mint-500/10 text-mint-700"],
              ["Not Found in GSTR-2B", summary.notFound || 0, percent(summary.notFound || 0, summary.total || 0), "border-orange-200 bg-orange-50 text-orange-700"],
              ["Mismatches", mismatchCount, percent(mismatchCount, summary.total || 0), "border-rose-200 bg-rose-50 text-rose-700"]
            ].map(([label, value, pct, className]) => (
              <article key={label} className={`rounded-xl border p-4 ${className}`}>
                <p className="text-xs font-bold uppercase tracking-wide">{label}</p>
                <p className="mt-2 text-2xl font-extrabold">{value}</p>
                <p className="text-xs font-semibold">{pct} of total</p>
              </article>
            ))}
          </section>

          <section className="panel mt-4 p-4">
            <div className="mb-4 flex flex-wrap gap-2">
              {[
                ["all", `All (${summary.total || 0})`],
                ["matched", `Matched (${summary.matched || 0})`],
                ["not_found", `Not Found (${summary.notFound || 0})`],
                ["mismatches", `Mismatches (${mismatchCount})`]
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    filter === value ? "bg-ink-900 text-white" : "bg-sand-100 text-ink-700 hover:bg-sand-200"
                  }`}
                  onClick={() => setFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>

            {filteredRows.length === 0 ? (
              <EmptyState title="No invoices found for this period." description="Try another month or year." />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-0">
                  <thead>
                    <tr className="bg-sand-100 text-left text-xs uppercase tracking-wide text-[#6d7e95]">
                      <th className="rounded-l-lg px-3 py-3">Invoice No.</th>
                      <th className="px-3 py-3">Supplier</th>
                      <th className="px-3 py-3">Invoice Date</th>
                      <th className="px-3 py-3 text-right">Taxable Amt</th>
                      <th className="px-3 py-3 text-right">GST Amt</th>
                      <th className="px-3 py-3">Match Status</th>
                      <th className="rounded-r-lg px-3 py-3">Mismatch Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row) => (
                      <tr key={row.documentId} className="border-t border-[#eadfcf] align-top">
                        <td className="px-3 py-3 text-sm font-semibold text-ink-900">{row.invoiceNumber}</td>
                        <td className="px-3 py-3 text-sm text-[#5f6f84]">
                          <div className="font-semibold text-ink-800">{row.supplierName || "-"}</div>
                          <div className="font-mono text-xs">{row.supplierGSTIN}</div>
                        </td>
                        <td className="px-3 py-3 text-sm text-[#5f6f84]">{row.invoiceDate}</td>
                        <td className="px-3 py-3 text-right text-sm text-[#5f6f84]">{formatCurrency(row.taxableAmount)}</td>
                        <td className="px-3 py-3 text-right text-sm text-[#5f6f84]">{formatCurrency(row.gstAmount)}</td>
                        <td className="px-3 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[row.matchStatus] || statusStyles.unavailable}`}>
                            {statusLabels[row.matchStatus] || "Unavailable"}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-xs text-[#607086]">
                          {row.mismatchFields.length > 0 ? (
                            <div className="space-y-1">
                              {row.mismatchFields.map((field) => (
                                <p key={field}>{mismatchText(row, field)}</p>
                              ))}
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </AppShell>
  );
};

export default GSTReconciliationPage;
