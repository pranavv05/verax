/**
 * GSTR-2B data source resolution.
 *
 * Reconciliation needs the supplier records from a client's GSTR-2B for a
 * period. Those records can come from two places:
 *   1. An offline snapshot a firm uploaded from the GST portal (gstr2b_snapshots).
 *   2. A live GSP pull (gsp.service.fetchGstr2bRecords).
 *
 * This module is the single place that decides which source to use, so every
 * caller (compliance routes, reconciliation service, client portal) matches
 * against one consistently-chosen source. Preference order: newest uploaded
 * snapshot first (it is explicit and free), then live GSP, then "unavailable".
 *
 * All DB access goes through a tenant-scoped `db` (req.withTenantTransaction),
 * so RLS on gstr2b_snapshots enforces firm isolation; the queries still filter
 * by firm_id in defence-in-depth, matching the rest of the codebase.
 */

const env = require("../config/env");
const gspService = require("./gsp.service");
const sandbox = require("./sandbox-gsp.service");
const taxpayerSession = require("./gstr2b-taxpayer-session.service");
const { matchInvoices, unavailableResults } = require("./gstr2b-matching");

/**
 * Load the newest uploaded snapshot for a (firm, client, period), or null.
 * Returns the stored normalised records plus provenance for display.
 */
const getLatestSnapshot = async (db, { firmId, clientId, period }) => {
  const result = await db.query(
    `
      SELECT id, source, source_filename, records, record_count,
             total_taxable, total_gst, created_at
      FROM gstr2b_snapshots
      WHERE firm_id = $1
        AND client_id = $2
        AND period = $3
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [firmId, clientId, period]
  );

  if (result.rowCount === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    source: row.source,
    sourceFilename: row.source_filename,
    records: Array.isArray(row.records) ? row.records : [],
    recordCount: row.record_count,
    totalTaxable: Number(row.total_taxable),
    totalGst: Number(row.total_gst),
    createdAt: row.created_at
  };
};

/**
 * Store a parsed snapshot. Called by the upload route (source "offline_upload")
 * and, later, by a GSP sync job (source "gsp"). Returns the created row id.
 */
const storeSnapshot = async (
  db,
  { firmId, clientId, period, source, sourceFilename, records, summary, uploadedBy }
) => {
  const result = await db.query(
    `
      INSERT INTO gstr2b_snapshots (
        firm_id, client_id, period, source, source_filename,
        records, record_count, total_taxable, total_gst, uploaded_by
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10)
      RETURNING id, created_at
    `,
    [
      firmId,
      clientId,
      period,
      source,
      sourceFilename ?? null,
      JSON.stringify(records),
      summary.recordCount,
      summary.totalTaxable,
      summary.totalGst,
      uploadedBy ?? null
    ]
  );
  return result.rows[0];
};

/**
 * Try a live Sandbox GSTR-2B pull for a client that has an active taxpayer
 * session. Returns normalised records, or null when Sandbox isn't the provider,
 * isn't configured, or the client has no usable session (needs OTP) — all of
 * which are non-fatal: reconciliation then falls back to the next source rather
 * than erroring. A successful pull is persisted as a snapshot so it is cached
 * for the period and visible/auditable like an upload.
 */
const trySandboxLive = async (db, { firmId, clientId, period }) => {
  if (env.GSP_PROVIDER !== "sandbox" || !sandbox.isSandboxConfigured()) {
    return null;
  }
  let token;
  try {
    ({ token } = await taxpayerSession.getUsableToken(db, { firmId, clientId }));
  } catch {
    // No active session (needs OTP), expired, or unrefreshable — fall back.
    return null;
  }
  try {
    const { records } = await sandbox.fetchGstr2b({ taxpayerToken: token, period });
    const summary = {
      recordCount: records.length,
      totalTaxable: Number(records.reduce((a, r) => a + (r.taxableAmount || 0), 0).toFixed(2)),
      totalGst: Number(records.reduce((a, r) => a + (r.gstAmount || 0), 0).toFixed(2))
    };
    // Cache as a snapshot so repeat reconciliations in the period are free and
    // the pull is auditable alongside uploads.
    await storeSnapshot(db, {
      firmId,
      clientId,
      period,
      source: "gsp",
      sourceFilename: null,
      records,
      summary,
      uploadedBy: null
    });
    return records;
  } catch {
    return null;
  }
};

/**
 * Resolve the best available GSTR-2B record set for a client+period.
 * Returns { records, source, snapshot } where source is one of:
 *   "offline_upload" | "gsp" | "unavailable".
 * records is [] when unavailable.
 *
 * Preference: an explicit uploaded snapshot first (CA-controlled, newest),
 * then a live Sandbox pull when the client has an active taxpayer session,
 * then the legacy adaequare GSP, then unavailable.
 */
const resolveGstr2bRecords = async (db, { firmId, clientId, gstin, period }) => {
  const snapshot = await getLatestSnapshot(db, { firmId, clientId, period });
  if (snapshot) {
    return { records: snapshot.records, source: snapshot.source, snapshot };
  }

  const sandboxRecords = await trySandboxLive(db, { firmId, clientId, period });
  if (sandboxRecords !== null) {
    return { records: sandboxRecords, source: "gsp", snapshot: null };
  }

  if (gstin) {
    const liveRecords = await gspService.fetchGstr2bRecords(gstin, period);
    if (liveRecords !== null) {
      return { records: liveRecords, source: "gsp", snapshot: null };
    }
  }

  return { records: [], source: "unavailable", snapshot: null };
};

/**
 * Match a set of extracted invoices against the best available source.
 * Returns { matches, source }. When no source is available, every invoice
 * comes back "unavailable", exactly as the old gsp-only path did.
 */
const matchAgainstBestSource = async (db, { firmId, clientId, gstin, period, invoices }) => {
  const { records, source } = await resolveGstr2bRecords(db, { firmId, clientId, gstin, period });
  if (source === "unavailable") {
    return { matches: unavailableResults(invoices), source };
  }
  return { matches: matchInvoices(invoices, records), source };
};

module.exports = {
  getLatestSnapshot,
  storeSnapshot,
  resolveGstr2bRecords,
  matchAgainstBestSource
};
