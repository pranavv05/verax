import { useEffect, useState } from "react";
import ClientPortalShell from "../components/layout/ClientPortalShell";
import LoadingState from "../components/ui/LoadingState";
import { Alert, Card, FormField, StatTile } from "../components/app/primitives";
import { IconTable } from "../components/app/icons";
import { clientPortalApi } from "../api/client-portal-api";
import { parseApiError } from "../lib/utils";

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];

// Defaults to last month — the period a client is most likely asking about.
const getDefaultPeriod = () => {
  const now = new Date();
  const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return { month: previous.getMonth() + 1, year: previous.getFullYear() };
};

const formatCurrency = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

const ClientPortalReconciliationPage = () => {
  const initialPeriod = getDefaultPeriod();
  const [month, setMonth] = useState(initialPeriod.month);
  const [year, setYear] = useState(initialPeriod.year);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  const period = `${String(month).padStart(2, "0")}${year}`;

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await clientPortalApi.reconciliation({ period });
        if (!active) return;
        setResult(data);
      } catch (loadError) {
        if (!active) return;
        setResult(null);
        setError(parseApiError(loadError, "We couldn't load your GST summary just now."));
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [period]);

  const onExport = async () => {
    setExporting(true);
    setError("");
    try {
      const blob = await clientPortalApi.reconciliationExport({ period });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `gst-summary-${period}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (exportError) {
      setError(parseApiError(exportError, "We couldn't prepare that download."));
    } finally {
      setExporting(false);
    }
  };

  const years = Array.from({ length: 5 }, (_, index) => new Date().getFullYear() - index);
  const summary = result?.summary;
  const unavailable = result && result.available === false;

  return (
    <ClientPortalShell
      title="GST summary."
      subtitle="How the invoices we hold compare against what your suppliers filed with the GST portal."
    >
      <Card>
        <div className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <FormField label="Month" htmlFor="period-month">
            <select id="period-month" className="field py-2.5 text-[0.9375rem]" value={month} onChange={(event) => setMonth(Number(event.target.value))}>
              {months.map((name, index) => (
                <option key={name} value={index + 1}>
                  {name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Year" htmlFor="period-year">
            <select id="period-year" className="field py-2.5 text-[0.9375rem]" value={year} onChange={(event) => setYear(Number(event.target.value))}>
              {years.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </FormField>
          <button
            type="button"
            className="btn-secondary py-2.5 text-[0.875rem]"
            disabled={exporting || loading || unavailable}
            onClick={onExport}
          >
            <IconTable size={15} />
            {exporting ? "Preparing…" : "Download Excel"}
          </button>
        </div>
      </Card>

      {error ? (
        <Alert tone="err" className="mt-6">
          {error}
        </Alert>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-16">
          <LoadingState message="Checking your invoices…" />
        </div>
      ) : unavailable ? (
        <Alert tone="warn" className="mt-6">
          {result.message}
        </Alert>
      ) : summary ? (
        <div className="mt-6 space-y-6">
          <Card className="relative overflow-hidden">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(55% 90% at 100% 0%, rgb(20 184 166 / 0.10), transparent 70%), radial-gradient(45% 80% at 0% 100%, rgb(102 87 217 / 0.07), transparent 70%)"
              }}
            />
            <div className="relative px-6 py-6">
              <p className="text-[0.9375rem] font-medium text-ui-fg-2">GST you can claim back</p>
              <p className="mt-2 text-[2.5rem] font-semibold leading-none tracking-[-0.04em] text-ui-fg">
                {formatCurrency(summary.totalITC)}
              </p>
              <p className="mt-4 max-w-xl text-[0.9375rem] leading-relaxed text-ui-fg-3">
                The total GST on the invoices below for {months[month - 1]} {year}. Anything not matched may need your supplier
                to file before you can claim it — your accountant will follow up.
              </p>
            </div>
          </Card>

          <section aria-label="Invoice checks" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Invoices checked" value={summary.totalDocuments} hint={`${months[month - 1]} ${year}`} />
            <StatTile label="Matched" value={summary.matched} tone="ok" hint="Found and agreeing" />
            <StatTile label="Don't agree" value={summary.mismatched} tone={summary.mismatched > 0 ? "warn" : "neutral"} hint="Amounts differ" />
            <StatTile label="Not found" value={summary.notFound} tone={summary.notFound > 0 ? "warn" : "neutral"} hint="Supplier hasn't filed yet" />
          </section>
        </div>
      ) : null}
    </ClientPortalShell>
  );
};

export default ClientPortalReconciliationPage;
