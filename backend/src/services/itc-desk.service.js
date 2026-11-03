/**
 * ITC Desk — portfolio view of input-tax-credit at risk across every client.
 *
 * This is the product wedge: instead of reconciling one client at a time, a
 * partner sees, for a return period, how much ITC is at risk across the whole
 * book and which clients drive it — so nothing slips before the GSTR-3B / Sec
 * 16(4) deadline.
 *
 * It reads the period's invoices and saved GSTR-2B for the whole firm in a few
 * queries, then runs the same matching and summary logic as the per-client
 * reconciliation (reconciliation.service) in memory, and rolls the per-client
 * summaries up. Nothing is written to the audit log for a portfolio view. One
 * client failing (bad data, missing GSTIN) never sinks the whole view — that
 * client is reported with an error flag instead.
 *
 * "ITC at risk" = GST on invoices in the client's books that do not cleanly
 * match GSTR-2B (not_found / mismatch / partial). A client with no 2B source
 * yet is surfaced separately as "needs data", not as zero-risk, so the absence
 * of data is never mistaken for a clean book.
 */

const {
  getPeriodWindow,
  loadPeriodInvoiceDocuments,
  toPeriodDocuments,
  toMatchableInvoices,
  buildReconciliationRows
} = require("./reconciliation.service");
const { matchInvoices, unavailableResults } = require("./gstr2b-matching");

const PERIOD_PATTERN = /^(0[1-9]|1[0-2])\d{4}$/;

/**
 * The Section 16(4) cut-off: ITC for a financial year (Apr–Mar) can be claimed
 * only up to the GSTR-3B of the following November (or the annual return, if
 * earlier). Returns context the UI uses to warn when a period's ITC is near or
 * past its deadline. Dates are informational — the authoritative rule can shift,
 * so this is a prompt to act, not a compliance guarantee.
 */
const sec16DeadlineForPeriod = (period) => {
  const month = Number(period.slice(0, 2));
  const year = Number(period.slice(2));
  // Indian FY starts in April. A period in Jan–Mar belongs to the FY that began
  // the previous April; Apr–Dec belongs to the FY beginning that April.
  const fyStartYear = month >= 4 ? year : year - 1;
  // Deadline: 30 November of the year AFTER the FY start (FY2025-26 -> 30 Nov 2026).
  const deadline = new Date(Date.UTC(fyStartYear + 1, 10, 30, 23, 59, 59, 999)); // month 10 = November
  return {
    financialYear: `${fyStartYear}-${String((fyStartYear + 1) % 100).padStart(2, "0")}`,
    deadline: deadline.toISOString(),
    daysToDeadline: Math.ceil((deadline.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
  };
};

const listActiveClients = async (db, { firmId }) => {
  const result = await db.query(
    `SELECT id, name, gstin
     FROM clients
     WHERE firm_id = $1 AND deleted_at IS NULL AND status = 'active'
     ORDER BY name ASC`,
    [firmId]
  );
  return result.rows;
};

/**
 * Build the portfolio ITC view for a period. Returns per-client rows (sorted by
 * ITC at risk, highest first) and firm-level totals, plus deadline context.
 */
const getItcDeskOverview = async (db, { firmId, period }) => {
  if (typeof period !== "string" || !PERIOD_PATTERN.test(period)) {
    const error = new Error("period must be in MMYYYY format");
    error.statusCode = 400;
    throw error;
  }

  const clients = await listActiveClients(db, { firmId });

  // Three firm-wide queries instead of three per client: at 300 clients the
  // per-client loop was ~900 round trips and ~2.5s, growing with history.
  const window = getPeriodWindow(period);
  const documentRows = await loadPeriodInvoiceDocuments(db, { firmId, ...window });
  const docsByClient = new Map();
  for (const row of documentRows) {
    if (!docsByClient.has(row.client_id)) docsByClient.set(row.client_id, []);
    docsByClient.get(row.client_id).push(row);
  }
  // Saved GSTR-2B only. The portfolio view deliberately never pulls live from
  // the GSP: that would be one paid, slow (up to 20s) Sandbox call per client
  // on every page load. A client without a saved 2B shows "needs data"; the
  // client's own reconciliation page fetches live and saves it, after which
  // it appears here.
  const snapshotResult = await db.query(
    `
      SELECT DISTINCT ON (client_id) client_id, source, records
      FROM gstr2b_snapshots
      WHERE firm_id = $1 AND period = $2
      ORDER BY client_id, created_at DESC
    `,
    [firmId, period]
  );
  const snapshots = new Map(snapshotResult.rows.map((r) => [r.client_id, r]));

  const rows = [];
  for (const client of clients) {
    if (!client.gstin) {
      rows.push({
        clientId: client.id,
        clientName: client.name,
        gstin: null,
        status: "no_gstin",
        source: "unavailable",
        itcAtRisk: 0,
        totalGst: 0,
        invoiceCount: 0,
        exceptions: 0
      });
      continue;
    }

    try {
      const documents = toPeriodDocuments(docsByClient.get(client.id) || [], window);
      const invoices = toMatchableInvoices(documents);
      const snapshot = snapshots.get(client.id);
      const source = snapshot ? snapshot.source : "unavailable";
      const matches = snapshot ? matchInvoices(invoices, snapshot.records) : unavailableResults(invoices);
      const { summary: s } = buildReconciliationRows(documents, matches);
      const exceptions =
        Number(s.notFound || 0) + Number(s.mismatched || 0) + Number(s.partial || 0);
      rows.push({
        clientId: client.id,
        clientName: client.name,
        gstin: client.gstin,
        // "needs_data" when there's no 2B source yet — distinct from a clean book.
        status: source === "unavailable" ? "needs_data" : "reconciled",
        source,
        itcAtRisk: Number(s.itcAtRisk || 0),
        totalGst: Number(s.totalGstAmount || 0),
        invoiceCount: Number(s.total || 0),
        exceptions
      });
    } catch (clientError) {
      // A single client's bad data must not break the whole portfolio view.
      rows.push({
        clientId: client.id,
        clientName: client.name,
        gstin: client.gstin,
        status: "error",
        source: "unavailable",
        itcAtRisk: 0,
        totalGst: 0,
        invoiceCount: 0,
        exceptions: 0,
        error: clientError.message || "reconciliation failed"
      });
    }
  }

  rows.sort((a, b) => b.itcAtRisk - a.itcAtRisk);

  const totals = rows.reduce(
    (acc, r) => {
      acc.clients += 1;
      acc.itcAtRisk += r.itcAtRisk;
      acc.exceptions += r.exceptions;
      if (r.status === "reconciled") acc.reconciled += 1;
      if (r.status === "needs_data") acc.needsData += 1;
      if (r.status === "no_gstin") acc.noGstin += 1;
      if (r.status === "error") acc.errors += 1;
      if (r.itcAtRisk > 0) acc.clientsAtRisk += 1;
      return acc;
    },
    {
      clients: 0,
      clientsAtRisk: 0,
      reconciled: 0,
      needsData: 0,
      noGstin: 0,
      errors: 0,
      itcAtRisk: 0,
      exceptions: 0
    }
  );
  totals.itcAtRisk = Number(totals.itcAtRisk.toFixed(2));

  return {
    period,
    deadline: sec16DeadlineForPeriod(period),
    totals,
    clients: rows
  };
};

module.exports = {
  getItcDeskOverview,
  // exported for tests
  sec16DeadlineForPeriod
};
