import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import EmptyState from "../components/ui/EmptyState";
import LoadingState from "../components/ui/LoadingState";
import { TableScroll, Toolbar } from "../components/app/TableKit";
import { Alert, Badge, Card, FormField, PageHeader, Segmented } from "../components/app/primitives";
import { IconRefresh, IconTable } from "../components/app/icons";
import { complianceApi } from "../api/compliance-api";
import { useAuth } from "../contexts/AuthContext";
import { cn, parseApiError } from "../lib/utils";
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

const STATUS = {
  matched: { tone: "ok", label: "Matched" },
  partial: { tone: "warn", label: "Partial" },
  mismatch: { tone: "err", label: "Mismatch" },
  not_found: { tone: "warn", label: "Not in 2B" },
  unavailable: { tone: "neutral", label: "Unavailable" }
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
    invoiceDate: "Invoice date"
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
  const total = Number(summary.total || 0);
  const breakdown = [
    { key: "matched", label: "Matched", value: Number(summary.matched || 0), bar: "bg-ui-ok" },
    { key: "mismatches", label: "Mismatch", value: mismatchCount, bar: "bg-ui-err" },
    { key: "not_found", label: "Not in GSTR-2B", value: Number(summary.notFound || 0), bar: "bg-ui-warn" }
  ];

  return (
    <AppShell>
      <PageHeader
        breadcrumbs={[
          { label: "Clients", to: "/clients" },
          result?.client ? { label: result.client.name, to: `/clients/${result.client.id}` } : { label: "Client" },
          { label: "GST reconciliation" }
        ]}
        title="GST reconciliation."
        tint="Purchases against GSTR-2B."
        description="Every purchase invoice Verax read, matched line by line with what suppliers filed."
        actions={
          canAdmin ? (
            <button type="button" className="btn-secondary" disabled={!result || exporting} onClick={onExport}>
              <IconTable size={14} />
              {exporting ? "Exporting…" : "Export to Excel"}
            </button>
          ) : null
        }
      />

      <Card className="mb-5">
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-end">
          <FormField label="Return period" htmlFor="gst-month" className="sm:w-40">
            <select id="gst-month" className="field" value={month} onChange={(event) => setMonth(event.target.value)}>
              {MONTHS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Year" htmlFor="gst-year" className="sm:w-32">
            <select id="gst-year" className="field" value={year} onChange={(event) => setYear(event.target.value)}>
              {years.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </FormField>
          <button type="button" className="btn-primary sm:mb-px" disabled={loading} onClick={runReconciliation}>
            <IconRefresh size={14} className={loading ? "animate-spin" : ""} />
            {loading ? "Running…" : "Run reconciliation"}
          </button>
        </div>
        {error ? (
          <div className="border-t border-ui-line px-5 py-4">
            <Alert tone="err">{error}</Alert>
          </div>
        ) : null}
      </Card>

      {result ? (
        <>
          {unavailableOnly ? (
            <Alert tone="info" className="mb-5" title="GST portal unreachable">
              Showing local data only — match status is unavailable until the portal responds.
            </Alert>
          ) : null}

          <Card className="mb-5">
            <div className="grid grid-cols-1 gap-5 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-center">
              <div>
                <p className="text-[0.8125rem] font-medium text-ui-fg-3">Invoices this period</p>
                <p className="mt-1 text-[2.25rem] font-semibold leading-none tracking-[-0.04em] text-ui-fg">{total}</p>
                <p className="mt-2 text-xs text-ui-fg-3">
                  {total > 0 ? `${percent(summary.matched || 0, total)} matched cleanly` : "Nothing to reconcile yet"}
                </p>
              </div>
              <div>
                <div className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full bg-ui-inset" aria-hidden="true">
                  {breakdown.map((item) =>
                    item.value > 0 ? <span key={item.key} className={cn("h-full", item.bar)} style={{ flexGrow: item.value }} /> : null
                  )}
                </div>
                <ul className="mt-4 grid grid-cols-3 gap-3">
                  {breakdown.map((item) => (
                    <li key={item.key}>
                      <button
                        type="button"
                        onClick={() => setFilter(item.key)}
                        className="w-full rounded-lg px-1 py-1 text-left outline-none transition-colors hover:bg-ui-subtle focus-visible:ring-2 focus-visible:ring-ui-accent"
                      >
                        <span className="flex items-center gap-1.5 text-xs text-ui-fg-3">
                          <span aria-hidden="true" className={cn("h-2 w-2 rounded-[3px]", item.bar)} />
                          {item.label}
                        </span>
                        <span className="mt-1 block text-xl font-semibold tracking-[-0.03em] text-ui-fg">
                          {item.value}
                          <span className="ml-1.5 text-xs font-normal text-ui-fg-4">{percent(item.value, total)}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <Toolbar>
              <Segmented
                ariaLabel="Filter invoices"
                layoutId="gst-filter"
                size="sm"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "all", label: "All", count: total },
                  { value: "matched", label: "Matched", count: summary.matched || 0 },
                  { value: "not_found", label: "Not in 2B", count: summary.notFound || 0 },
                  { value: "mismatches", label: "Mismatches", count: mismatchCount }
                ]}
              />
            </Toolbar>

            {filteredRows.length === 0 ? (
              <div className="p-4">
                <EmptyState compact title="No invoices for this period" description="Try another month or year." />
              </div>
            ) : (
              <TableScroll>
                <table className="ui-table">
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Supplier</th>
                      <th>Date</th>
                      <th className="text-right">Taxable</th>
                      <th className="text-right">GST</th>
                      <th>Status</th>
                      <th>Difference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row) => {
                      const status = STATUS[row.matchStatus] || STATUS.unavailable;
                      return (
                        <tr key={row.documentId} className="align-top">
                          <td>
                            <Link to={`/review/${row.documentId}`} className="ui-mono font-medium text-ui-fg hover:text-ui-accent-text">
                              {row.invoiceNumber}
                            </Link>
                          </td>
                          <td>
                            <div className="font-medium text-ui-fg">{row.supplierName || "—"}</div>
                            <div className="ui-mono text-[0.72rem] text-ui-fg-3">{row.supplierGSTIN}</div>
                          </td>
                          <td className="whitespace-nowrap tabular-nums">{row.invoiceDate}</td>
                          <td className="whitespace-nowrap text-right tabular-nums">{formatCurrency(row.taxableAmount)}</td>
                          <td className="whitespace-nowrap text-right tabular-nums">{formatCurrency(row.gstAmount)}</td>
                          <td>
                            <Badge tone={status.tone} dot>
                              {status.label}
                            </Badge>
                          </td>
                          <td className="text-xs">
                            {row.mismatchFields.length > 0 ? (
                              <ul className="space-y-1">
                                {row.mismatchFields.map((field) => (
                                  <li key={field} className="text-ui-fg-2">
                                    {mismatchText(row, field)}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <span className="text-ui-fg-4">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TableScroll>
            )}
          </Card>
        </>
      ) : loading ? (
        <div className="flex justify-center py-16">
          <LoadingState message="Matching invoices against GSTR-2B…" />
        </div>
      ) : null}
    </AppShell>
  );
};

export default GSTReconciliationPage;
