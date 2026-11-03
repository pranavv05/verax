/**
 * Firm-level data portability and erasure: a full export of everything Verax
 * holds for a firm, and permanent deletion of the firm and all of its data.
 *
 * Under India's DPDP Act a CA firm is the data fiduciary for its clients'
 * records and Verax its processor, so a firm leaving must be able to take its
 * data with it and have it erased.
 *
 * All queries run in the firm's tenant transaction, so RLS confines both export
 * and deletion to the firm even if a query here were wrong.
 */

const crypto = require("crypto");
const path = require("path");
const archiver = require("archiver");
const jwt = require("jsonwebtoken");
const env = require("../config/env");
const ApiError = require("../utils/api-error");
const { downloadFileAsBuffer, deleteObject } = require("./s3.service");

// ── what goes into an export ─────────────────────────────────────────────────

// Columns that are credentials, not data — never exported.
const SECRET_COLUMNS = new Set([
  "password_hash",
  "portal_password_hash",
  "upload_token",
  "token_hash",
  "token_encrypted"
]);

// Each entry: file name in the archive → firm-scoped query. Session/credential
// tables (refresh_tokens, password_reset_tokens, client_refresh_tokens,
// document_upload_sessions) are deliberately absent.
const EXPORT_TABLES = [
  ["firm", `SELECT * FROM firms WHERE id = $1`],
  ["users", `SELECT * FROM users WHERE firm_id = $1 ORDER BY created_at`],
  ["clients", `SELECT * FROM clients WHERE firm_id = $1 ORDER BY created_at`],
  ["documents", `SELECT * FROM documents WHERE firm_id = $1 ORDER BY uploaded_at`],
  ["extractions", `SELECT e.* FROM extractions e JOIN documents d ON d.id = e.document_id WHERE d.firm_id = $1 ORDER BY e.created_at`],
  ["document_versions", `SELECT v.* FROM document_versions v JOIN documents d ON d.id = v.document_id WHERE d.firm_id = $1 ORDER BY v.created_at`],
  ["tally_exports", `SELECT * FROM tally_exports WHERE firm_id = $1 ORDER BY created_at`],
  ["gstr2b_snapshots", `SELECT * FROM gstr2b_snapshots WHERE firm_id = $1 ORDER BY created_at`],
  ["gstr2b_taxpayer_sessions", `SELECT * FROM gstr2b_taxpayer_sessions WHERE firm_id = $1`],
  ["ims_actions", `SELECT * FROM ims_actions WHERE firm_id = $1`],
  ["tally_agents", `SELECT * FROM tally_agents WHERE firm_id = $1`],
  ["tally_sync_jobs", `SELECT * FROM tally_sync_jobs WHERE firm_id = $1 ORDER BY created_at`],
  ["scheduled_requests", `SELECT * FROM scheduled_requests WHERE firm_id = $1`],
  ["narration_mappings", `SELECT * FROM narration_mappings WHERE firm_id = $1`],
  ["item_name_mappings", `SELECT * FROM item_name_mappings WHERE firm_id = $1`],
  ["notifications", `SELECT * FROM notifications WHERE firm_id = $1 ORDER BY created_at`],
  ["audit_logs", `SELECT * FROM audit_logs WHERE firm_id = $1 ORDER BY created_at`]
];

const stripSecrets = (row) => {
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    if (!SECRET_COLUMNS.has(key)) out[key] = value;
  }
  return out;
};

// A filename that is safe inside a zip on Windows and macOS, and can't escape
// its folder ("../", absolute paths, reserved characters).
const safeName = (name, fallback) => {
  const cleaned = String(name || "")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 120);
  return cleaned || fallback;
};

const README = (firmName, exportedAt) => `Verax data export
Firm: ${firmName}
Exported: ${exportedAt}

data/        every record Verax holds for your firm, one JSON file per table
             (passwords, login sessions, agent tokens and GST session tokens
             are credentials, not data, and are left out)
documents/   every original file your clients uploaded, by client
tally/       every Tally XML file Verax generated for you

Each document's id in documents/ matches documents.json and extractions.json.
`;

/**
 * Read every record for the firm (secrets stripped). Runs in a short tenant
 * transaction; file streaming happens afterwards, outside it, so a large
 * export never holds a pooled connection open for minutes.
 */
const collectFirmData = async (db, { firmId }) => {
  const firmResult = await db.query(`SELECT name FROM firms WHERE id = $1`, [firmId]);
  if (firmResult.rowCount === 0) throw ApiError.notFound("Firm not found");
  const tables = {};
  for (const [name, sql] of EXPORT_TABLES) {
    const result = await db.query(sql, [firmId]);
    tables[name] = result.rows.map(stripSecrets);
  }
  return { firmName: firmResult.rows[0].name, tables };
};

/**
 * Write a ZIP of the collected data plus every stored file to `output` (e.g.
 * the HTTP response). Files that can't be read from storage are listed in
 * data/missing_files.json instead of failing the whole export.
 */
const writeFirmExport = async ({ firmName, tables }, output) => {
  const archive = archiver("zip", { zlib: { level: 6 } });
  const done = new Promise((resolve, reject) => {
    archive.on("error", reject);
    output.on("error", reject);
    output.on("close", resolve);
    output.on("finish", resolve);
  });
  archive.pipe(output);

  const exportedAt = new Date().toISOString();
  archive.append(README(firmName, exportedAt), { name: "verax-export/README.txt" });
  for (const [name, rows] of Object.entries(tables)) {
    archive.append(JSON.stringify(rows, null, 2), { name: `verax-export/data/${name}.json` });
  }

  const clientNames = new Map((tables.clients || []).map((c) => [c.id, safeName(c.name, c.id)]));
  const missing = [];
  for (const doc of tables.documents || []) {
    if (!doc.s3_key) continue;
    const folder = clientNames.get(doc.client_id) || "unknown-client";
    const fileName = `${doc.id}-${safeName(doc.file_name, "document")}`;
    try {
      const buffer = await downloadFileAsBuffer({ key: doc.s3_key });
      archive.append(buffer, { name: `verax-export/documents/${folder}/${fileName}` });
    } catch (error) {
      missing.push({ documentId: doc.id, fileName: doc.file_name, reason: error.message });
    }
  }
  for (const exp of tables.tally_exports || []) {
    if (!exp.xml_s3_key) continue;
    try {
      const buffer = await downloadFileAsBuffer({ key: exp.xml_s3_key });
      archive.append(buffer, { name: `verax-export/tally/${exp.id}${path.extname(exp.xml_s3_key) || ".xml"}` });
    } catch (error) {
      missing.push({ tallyExportId: exp.id, reason: error.message });
    }
  }
  if (missing.length) {
    archive.append(JSON.stringify(missing, null, 2), { name: "verax-export/data/missing_files.json" });
  }

  await archive.finalize();
  await done;
  return {
    exportedAt,
    counts: Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length])),
    missingFiles: missing.length
  };
};

// ── signed, short-lived export links ─────────────────────────────────────────

// A separate key from the access-token secret, so an export link can never be
// replayed as a login token (and vice versa).
const exportKey = () => crypto.createHmac("sha256", env.JWT_SECRET).update("verax-firm-export-v1").digest();
const EXPORT_LINK_TTL = "10m";

const createExportToken = ({ firmId, userId }) =>
  jwt.sign({ firmId, sub: userId, purpose: "firm-export" }, exportKey(), {
    expiresIn: EXPORT_LINK_TTL,
    audience: "verax-firm-export"
  });

const verifyExportToken = (token) => {
  try {
    const payload = jwt.verify(String(token || ""), exportKey(), { audience: "verax-firm-export" });
    if (payload.purpose !== "firm-export" || !payload.firmId) throw new Error("wrong purpose");
    return { firmId: payload.firmId, userId: payload.sub };
  } catch {
    throw ApiError.unauthorized("This export link is invalid or has expired. Start the export again.");
  }
};

// ── permanent deletion ───────────────────────────────────────────────────────

// Child tables first. Mixed ON DELETE rules (some CASCADE, many NO ACTION)
// make relying on cascades unsafe, so every table is cleared explicitly.
const DELETE_STEPS = [
  ["tally_sync_jobs", `DELETE FROM tally_sync_jobs WHERE firm_id = $1`],
  ["ims_actions", `DELETE FROM ims_actions WHERE firm_id = $1`],
  ["gstr2b_taxpayer_sessions", `DELETE FROM gstr2b_taxpayer_sessions WHERE firm_id = $1`],
  ["gstr2b_snapshots", `DELETE FROM gstr2b_snapshots WHERE firm_id = $1`],
  ["scheduled_requests", `DELETE FROM scheduled_requests WHERE firm_id = $1`],
  ["notifications", `DELETE FROM notifications WHERE firm_id = $1`],
  ["narration_mappings", `DELETE FROM narration_mappings WHERE firm_id = $1`],
  ["item_name_mappings", `DELETE FROM item_name_mappings WHERE firm_id = $1`],
  ["tally_agents", `DELETE FROM tally_agents WHERE firm_id = $1`],
  ["document_versions", `DELETE FROM document_versions WHERE document_id IN (SELECT id FROM documents WHERE firm_id = $1)`],
  ["extractions", `DELETE FROM extractions WHERE document_id IN (SELECT id FROM documents WHERE firm_id = $1)`],
  ["tally_exports", `DELETE FROM tally_exports WHERE firm_id = $1`],
  ["document_upload_sessions", `DELETE FROM document_upload_sessions WHERE firm_id = $1`],
  ["documents", `DELETE FROM documents WHERE firm_id = $1`],
  ["client_refresh_tokens", `DELETE FROM client_refresh_tokens WHERE client_id IN (SELECT id FROM clients WHERE firm_id = $1)`],
  ["clients", `DELETE FROM clients WHERE firm_id = $1`],
  ["password_reset_tokens", `DELETE FROM password_reset_tokens WHERE firm_id = $1`],
  ["refresh_tokens", `DELETE FROM refresh_tokens WHERE firm_id = $1`],
  ["audit_logs", `DELETE FROM audit_logs WHERE firm_id = $1`],
  ["users", `DELETE FROM users WHERE firm_id = $1`],
  ["firms", `DELETE FROM firms WHERE id = $1`]
];

/**
 * Delete every row belonging to the firm. Runs inside the caller's
 * transaction: all or nothing. Returns the storage keys to remove once the
 * transaction has committed (files are deleted after, so a rollback can never
 * leave rows pointing at files that are gone).
 */
const deleteFirmData = async (db, { firmId }) => {
  const keys = await db.query(
    `SELECT s3_key AS key FROM documents WHERE firm_id = $1 AND s3_key IS NOT NULL
     UNION SELECT s3_key FROM document_upload_sessions WHERE firm_id = $1 AND s3_key IS NOT NULL
     UNION SELECT xml_s3_key FROM tally_exports WHERE firm_id = $1 AND xml_s3_key IS NOT NULL`,
    [firmId]
  );
  const counts = {};
  for (const [table, sql] of DELETE_STEPS) {
    const result = await db.query(sql, [firmId]);
    counts[table] = result.rowCount;
  }
  if (counts.firms !== 1) {
    throw ApiError.notFound("Firm not found");
  }
  return { storageKeys: keys.rows.map((r) => r.key), counts };
};

/** Best-effort removal of stored files; returns the keys that could not be deleted. */
const deleteStoredFiles = async (keys, { concurrency = 8 } = {}) => {
  const failed = [];
  let next = 0;
  const worker = async () => {
    while (next < keys.length) {
      const key = keys[next++];
      try {
        await deleteObject({ key });
      } catch (error) {
        failed.push({ key, error: error.message });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, keys.length) }, worker));
  return failed;
};

module.exports = {
  EXPORT_TABLES,
  SECRET_COLUMNS,
  collectFirmData,
  writeFirmExport,
  createExportToken,
  verifyExportToken,
  deleteFirmData,
  deleteStoredFiles,
  safeName
};
