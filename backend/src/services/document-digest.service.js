const env = require("../config/env");
const { withTenantTransaction } = require("../db/tenant-context");
const { sendEmail } = require("./email.service");
const { documentDigestSubject, documentDigestTemplate } = require("../templates/documentDigest.template");

/**
 * Daily "documents ready" email (DOCUMENT_READY_EMAILS=digest). Replaces one
 * email per processed document, which for a busy firm meant hundreds a month
 * per admin and put the sending domain at risk of being flagged as spam.
 *
 * Each firm's digest covers documents processed since its last digest was
 * sent (recorded in audit_logs), looking back at most MAX_LOOKBACK_HOURS so a
 * missed day is caught up without resending. Only documents still waiting
 * for review are listed; if there are none, nothing is sent.
 */

const DIGEST_AUDIT_ACTION = "document_digest_emailed";
const MAX_LOOKBACK_HOURS = 48;

const listFirmIdsForDigest = async () =>
  withTenantTransaction({ authContext: "scheduler" }, async (db) => {
    const result = await db.query("SELECT id FROM firms WHERE deleted_at IS NULL ORDER BY created_at ASC");
    return result.rows.map((row) => row.id);
  });

const getFirmDigest = async (db, { firmId }) => {
  const windowResult = await db.query(
    `
      SELECT
        NOW() AS window_end,
        GREATEST(
          NOW() - make_interval(hours => $2::integer),
          COALESCE(
            (
              SELECT MAX((metadata->>'windowEnd')::timestamptz)
              FROM audit_logs
              WHERE firm_id = $1
                AND action = $3
            ),
            '-infinity'::timestamptz
          )
        ) AS window_start
    `,
    [firmId, MAX_LOOKBACK_HOURS, DIGEST_AUDIT_ACTION]
  );
  const { window_start: windowStart, window_end: windowEnd } = windowResult.rows[0];

  const documentsResult = await db.query(
    `
      SELECT d.id, d.file_name, d.status, c.name AS client_name
      FROM documents d
      JOIN clients c ON c.id = d.client_id
      WHERE d.firm_id = $1
        AND d.deleted_at IS NULL
        AND c.deleted_at IS NULL
        AND d.status IN ('extracted', 'review_required')
        AND EXISTS (
          SELECT 1
          FROM audit_logs a
          WHERE a.firm_id = $1
            AND a.action = 'document_processed'
            AND a.entity_id = d.id
            AND a.created_at > $2
            AND a.created_at <= $3
        )
      ORDER BY c.name ASC, d.file_name ASC
    `,
    [firmId, windowStart, windowEnd]
  );

  if (documentsResult.rowCount === 0) {
    return { windowEnd, documents: [], admins: [], firmName: null };
  }

  const firmResult = await db.query("SELECT name FROM firms WHERE id = $1 AND deleted_at IS NULL", [firmId]);
  const adminsResult = await db.query(
    `
      SELECT id, email
      FROM users
      WHERE firm_id = $1
        AND role = 'admin'
        AND deleted_at IS NULL
      ORDER BY created_at ASC
    `,
    [firmId]
  );

  return {
    windowEnd,
    firmName: firmResult.rows[0] ? firmResult.rows[0].name : "",
    admins: adminsResult.rows,
    documents: documentsResult.rows.map((row) => ({
      id: row.id,
      fileName: row.file_name,
      clientName: row.client_name,
      needsAttention: row.status === "review_required"
    }))
  };
};

const recordDigestSent = async (db, { firmId, windowEnd, documentCount, results }) => {
  await db.query(
    `
      INSERT INTO audit_logs (firm_id, user_id, action, entity_type, entity_id, metadata)
      VALUES ($1, NULL, $2, 'firm', $1, $3::jsonb)
    `,
    [
      firmId,
      DIGEST_AUDIT_ACTION,
      JSON.stringify({
        windowEnd: new Date(windowEnd).toISOString(),
        documentCount,
        recipients: results
      })
    ]
  );
};

const defaultDeps = () => ({
  withTenantTransaction,
  listFirmIdsForDigest,
  getFirmDigest,
  recordDigestSent,
  sendEmail,
  mode: env.DOCUMENT_READY_EMAILS,
  frontendUrl: env.FRONTEND_URL,
  logError: (message) => process.stderr.write(`${message}\n`)
});

/**
 * Sends one firm's digest. Returns the number of emails delivered. The window
 * only advances when at least one admin actually got the email, so a
 * provider outage means tomorrow's digest includes today's documents.
 */
const sendFirmDigest = async ({ firmId }, deps) => {
  const digest = await deps.withTenantTransaction({ firmId }, (db) => deps.getFirmDigest(db, { firmId }));
  if (digest.documents.length === 0 || digest.admins.length === 0) return 0;

  const subject = documentDigestSubject({ documentCount: digest.documents.length });
  const html = documentDigestTemplate({
    firmName: digest.firmName,
    documents: digest.documents,
    frontendUrl: deps.frontendUrl
  });

  const results = [];
  for (const admin of digest.admins) {
    try {
      const emailResult = await deps.sendEmail({ to: admin.email, subject, html });
      results.push({ email: admin.email, sent: Boolean(emailResult && emailResult.sent), error: emailResult?.error ?? null });
    } catch (error) {
      results.push({ email: admin.email, sent: false, error: String(error.message || error) });
    }
  }

  const delivered = results.filter((result) => result.sent).length;
  if (delivered > 0) {
    await deps.withTenantTransaction({ firmId }, (db) =>
      deps.recordDigestSent(db, {
        firmId,
        windowEnd: digest.windowEnd,
        documentCount: digest.documents.length,
        results
      })
    );
  } else {
    deps.logError(`Document digest for firm ${firmId} was not delivered to any admin`);
  }
  return delivered;
};

const processDocumentDigests = async (overrides = {}) => {
  const deps = { ...defaultDeps(), ...overrides };
  if (deps.mode !== "digest") {
    return { firms: 0, emailsSent: 0, failures: 0, skipped: true };
  }

  const firmIds = await deps.listFirmIdsForDigest();
  let emailsSent = 0;
  let failures = 0;
  for (const firmId of firmIds) {
    try {
      emailsSent += await sendFirmDigest({ firmId }, deps);
    } catch (error) {
      failures += 1;
      deps.logError(`Document digest for firm ${firmId} failed: ${String(error.message || error)}`);
    }
  }

  return { firms: firmIds.length, emailsSent, failures, skipped: false };
};

module.exports = {
  DIGEST_AUDIT_ACTION,
  MAX_LOOKBACK_HOURS,
  getFirmDigest,
  processDocumentDigests
};
