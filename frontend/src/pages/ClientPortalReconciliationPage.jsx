import { useEffect, useState } from "react";
import ClientPortalShell from "../components/layout/ClientPortalShell";
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

const SummaryTile = ({ label, value, hint, tone = "neutral" }) => {
  const tones = {
    neutral: "border-[#e7dcc8] bg-white",
    good: "border-mint-300 bg-mint-500/5",
    warn: "border-amber-200 bg-amber-50"
  };
  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <p className="text-3xl font-extrabold text-ink-900">{value}</p>
      <p className="mt-1 text-base font-semibold text-ink-800">{label}</p>
      {hint ? <p className="mt-1 text-sm text-[#607086]">{hint}</p> : null}
    </div>
  );
};

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
      title="GST summary"
      subtitle="How the invoices we hold compare against what your suppliers filed with the GST portal."
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <label className="label" htmlFor="period-month">
            Month
          </label>
          <select
            id="period-month"
            className="field py-3 text-base"
            value={month}
            onChange={(event) => setMonth(Number(event.target.value))}
          >
            {months.map((name, index) => (
              <option key={name} value={index + 1}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="period-year">
            Year
          </label>
          <select
            id="period-year"
            className="field py-3 text-base"
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
          >
            {years.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="btn-secondary py-3 text-base"
          disabled={exporting || loading || unavailable}
          onClick={onExport}
        >
          {exporting ? "Preparing..." : "Download Excel"}
        </button>
      </div>

      {error ? (
        <div className="mt-6 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-base font-medium text-rose-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="mt-6 text-base text-[#607086]">Checking your invoices...</p>
      ) : unavailable ? (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-6 text-base text-amber-900">
          {result.message}
        </div>
      ) : summary ? (
        <>
          <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryTile
              label="Invoices checked"
              value={summary.totalDocuments}
              hint={`For ${months[month - 1]} ${year}`}
            />
            <SummaryTile
              label="Matched"
              value={summary.matched}
              tone="good"
              hint="Found and agreeing"
            />
            <SummaryTile
              label="Don't agree"
              value={summary.mismatched}
              tone="warn"
              hint="Amounts differ"
            />
            <SummaryTile
              label="Not found"
              value={summary.notFound}
              tone="warn"
              hint="Supplier hasn't filed"
            />
          </section>

          <section className="mt-6 rounded-2xl border border-[#e7dcc8] bg-white p-5">
            <p className="text-base font-semibold text-ink-800">GST you can claim back</p>
            <p className="mt-1 text-3xl font-extrabold text-ink-900">
              {formatCurrency(summary.totalITC)}
            </p>
            <p className="mt-3 text-base text-[#607086]">
              This is the total GST on the invoices above. Anything not matched may need your
              supplier to file before you can claim it — your accountant will follow up.
            </p>
          </section>
        </>
      ) : null}
    </ClientPortalShell>
  );
};

export default ClientPortalReconciliationPage;
