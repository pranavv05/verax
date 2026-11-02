/**
 * IMS action tracking service.
 *
 * Populates and maintains ims_actions rows from a client's latest GSTR-2B
 * snapshot for a period, lets the firm record Accept/Reject/Pending per invoice,
 * and summarises deemed-accept risk (unactioned records whose GST would flow
 * into the return by default).
 *
 * Reads the snapshot via the source service (the same records reconciliation
 * uses), so IMS tracking and reconciliation always see the same data. All DB
 * access is tenant-scoped; RLS enforces firm isolation.
 */

const ApiError = require("../utils/api-error");
const { getLatestSnapshot } = require("./gstr2b-source.service");

const PERIOD_PATTERN = /^(0[1-9]|1[0-2])\d{4}$/;
const VALID_ACTIONS = new Set(["none", "accept", "reject", "pending"]);

const assertPeriod = (period) => {
  if (typeof period !== "string" || !PERIOD_PATTERN.test(period)) {
    throw ApiError.badRequest("period must be in MMYYYY format");
  }
};

const assertClient = async (db, { firmId, clientId }) => {
  const result = await db.query(
    `SELECT id FROM clients WHERE id = $1 AND firm_id = $2 AND deleted_at IS NULL LIMIT 1`,
    [clientId, firmId]
  );
  if (result.rowCount === 0) throw ApiError.notFound("Client not found");
};

/**
 * Sync ims_actions rows from the latest snapshot for a client+period. Inserts a
 * row per 2B invoice that isn't tracked yet, and refreshes the GSTN ims_status
 * and gst_amount on existing rows WITHOUT clobbering a firm's recorded action.
 * Returns the number of rows upserted. Idempotent.
 */
const syncFromSnapshot = async (db, { firmId, clientId, period }) => {
  assertPeriod(period);
  await assertClient(db, { firmId, clientId });

  const snapshot = await getLatestSnapshot(db, { firmId, clientId, period });
  if (!snapshot || !Array.isArray(snapshot.records) || snapshot.records.length === 0) {
    return { synced: 0, hasSnapshot: Boolean(snapshot) };
  }

  let synced = 0;
  for (const rec of snapshot.records) {
    const supplierGstin = (rec.supplierGSTIN || "").toUpperCase();
    const invoiceNumber = rec.invoiceNumber || "";
    if (!supplierGstin || !invoiceNumber) continue; // can't key an IMS row without both
    const gst = Number(rec.gstAmount || 0);
    const imsStatus = rec.imsStatus ?? null;

    await db.query(
      `INSERT INTO ims_actions
         (firm_id, client_id, period, supplier_gstin, invoice_number, ims_status, gst_amount)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (firm_id, client_id, period, supplier_gstin, invoice_number)
       DO UPDATE SET
         ims_status = EXCLUDED.ims_status,
         gst_amount = EXCLUDED.gst_amount,
         updated_at = NOW()`,
      [firmId, clientId, period, supplierGstin, invoiceNumber, imsStatus, gst]
    );
    synced += 1;
  }
  return { synced, hasSnapshot: true };
};

/**
 * List tracked IMS rows for a client+period with a summary. Syncs from the
 * latest snapshot first so the list reflects current 2B data.
 */
const listActions = async (db, { firmId, clientId, period }) => {
  assertPeriod(period);
  await assertClient(db, { firmId, clientId });
  await syncFromSnapshot(db, { firmId, clientId, period });

  const result = await db.query(
    `SELECT id, supplier_gstin, invoice_number, ims_status, action, gst_amount, note, acted_at
     FROM ims_actions
     WHERE firm_id = $1 AND client_id = $2 AND period = $3
     ORDER BY gst_amount DESC`,
    [firmId, clientId, period]
  );

  const rows = result.rows.map((r) => ({
    id: r.id,
    supplierGstin: r.supplier_gstin,
    invoiceNumber: r.invoice_number,
    imsStatus: r.ims_status,
    action: r.action,
    gstAmount: Number(r.gst_amount),
    note: r.note,
    actedAt: r.acted_at
  }));

  const summary = rows.reduce(
    (acc, r) => {
      acc.total += 1;
      acc.totalGst += r.gstAmount;
      acc[r.action] = (acc[r.action] || 0) + 1;
      // Deemed-accept risk: records with no recorded action AND not already
      // accepted at GSTN (ims_status 'A') — their GST flows into the return by
      // default if nobody acts.
      if (r.action === "none" && r.imsStatus !== "A") {
        acc.unactioned += 1;
        acc.deemedAcceptGst += r.gstAmount;
      }
      return acc;
    },
    { total: 0, totalGst: 0, none: 0, accept: 0, reject: 0, pending: 0, unactioned: 0, deemedAcceptGst: 0 }
  );
  summary.totalGst = Number(summary.totalGst.toFixed(2));
  summary.deemedAcceptGst = Number(summary.deemedAcceptGst.toFixed(2));

  return { period, summary, rows };
};

/**
 * Record a firm's action on one tracked IMS row.
 */
const setAction = async (db, { firmId, clientId, actionId, action, note, userId }) => {
  if (!VALID_ACTIONS.has(action)) {
    throw ApiError.badRequest("action must be one of: none, accept, reject, pending");
  }
  await assertClient(db, { firmId, clientId });

  const result = await db.query(
    `UPDATE ims_actions
     SET action = $4, note = $5, acted_by = $6, acted_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND firm_id = $2 AND client_id = $3
     RETURNING id, action`,
    [actionId, firmId, clientId, action, note ?? null, userId ?? null]
  );
  if (result.rowCount === 0) throw ApiError.notFound("IMS record not found");
  return { id: result.rows[0].id, action: result.rows[0].action };
};

module.exports = {
  syncFromSnapshot,
  listActions,
  setAction
};
