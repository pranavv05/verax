/**
 * Live Tally connector — backend service.
 *
 * Bridges Verax (cloud) and TallyPrime (on the firm's Windows machine, HTTP XML
 * server on localhost:9000) through a small agent the firm installs. The agent
 * holds an OUTBOUND connection, so the backend never connects to Tally directly;
 * it only queues work and records results.
 *
 * Responsibilities here:
 *  - register / list / revoke agents (token issued once, stored hashed);
 *  - authenticate an agent by its bearer token;
 *  - enqueue a document as a sync job with a STABLE remote_id (idempotent push);
 *  - let an agent claim the next queued job and report its result;
 *  - heartbeat;
 *  - parse TallyPrime's import response into a structured result.
 *
 * All DB access is through a tenant-scoped client; RLS enforces firm isolation.
 */

const crypto = require("crypto");
const ApiError = require("../utils/api-error");
const { hashToken } = require("../utils/token-utils");
const { buildVoucherXml, wrapVouchersEnvelope } = require("./tally-xml.service");

const MAX_ATTEMPTS = 5;
// A job an agent claimed but never reported on (agent crashed / lost power) is
// requeued after this long so it is not stuck "claimed" forever.
const CLAIM_STALE_MS = 5 * 60 * 1000;

// ── Agent tokens ────────────────────────────────────────────────────────────

/**
 * A long, URL-safe agent token. Shown to the firm once at registration; only
 * its SHA-256 hash is stored (same discipline as refresh tokens).
 */
const generateAgentToken = () => `vtally_${crypto.randomBytes(32).toString("base64url")}`;

const registerAgent = async (db, { firmId, userId, name, tallyCompany }) => {
  const token = generateAgentToken();
  const tokenHash = hashToken(token);

  const result = await db.query(
    `
      INSERT INTO tally_agents (firm_id, name, token_hash, tally_company, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, name, tally_company, status, created_at
    `,
    [firmId, name, tokenHash, tallyCompany ?? null, userId ?? null]
  );

  // The plaintext token is returned exactly once, here.
  return { agent: result.rows[0], token };
};

const listAgents = async (db, { firmId }) => {
  const result = await db.query(
    `
      SELECT id, name, tally_company, status, last_seen_at, agent_version, tally_status, created_at
      FROM tally_agents
      WHERE firm_id = $1
      ORDER BY created_at DESC
    `,
    [firmId]
  );
  return result.rows;
};

const revokeAgent = async (db, { firmId, agentId }) => {
  const result = await db.query(
    `
      UPDATE tally_agents
      SET status = 'revoked', updated_at = NOW()
      WHERE id = $1 AND firm_id = $2 AND status <> 'revoked'
      RETURNING id
    `,
    [agentId, firmId]
  );
  if (result.rowCount === 0) {
    throw ApiError.notFound("Agent not found or already revoked");
  }
  return { id: result.rows[0].id };
};

/**
 * Resolve an agent by its bearer token. Returns { id, firmId } or null.
 *
 * Runs inside a tenant transaction opened with authContext 'tally_agent' and
 * agentTokenHash set (see tenant-context.js); the tally_agents RLS policy then
 * exposes exactly the one matching active agent row, from which we read the
 * firm_id to establish full tenant context for the rest of the request. The
 * token_hash filter here is belt-and-braces alongside that policy.
 */
const authenticateAgent = async (db, token) => {
  if (!token || typeof token !== "string") return null;
  const tokenHash = hashToken(token);
  const result = await db.query(
    `
      SELECT id, firm_id
      FROM tally_agents
      WHERE token_hash = $1 AND status = 'active'
      LIMIT 1
    `,
    [tokenHash]
  );
  return result.rowCount > 0 ? { id: result.rows[0].id, firmId: result.rows[0].firm_id } : null;
};

const hashAgentToken = (token) => hashToken(token);

const recordHeartbeat = async (db, { agentId, firmId, agentVersion, tallyStatus }) => {
  await db.query(
    `
      UPDATE tally_agents
      SET last_seen_at = NOW(),
          agent_version = COALESCE($3, agent_version),
          tally_status = COALESCE($4, tally_status),
          updated_at = NOW()
      WHERE id = $1 AND firm_id = $2
    `,
    [agentId, firmId, agentVersion || null, tallyStatus || null]
  );
};

// ── Sync jobs ───────────────────────────────────────────────────────────────

/**
 * Stable idempotency key for a document. The same document always yields the
 * same remote_id, so re-pushing updates the existing Tally voucher via REMOTEID
 * rather than creating a duplicate.
 */
const remoteIdForDocument = (documentId) => `verax-doc-${documentId}`;

/**
 * Queue a document for live push. Generates the voucher XML (idempotent, with a
 * stable REMOTEID) and inserts a job. The partial unique index guarantees at
 * most one in-flight job per document; a second attempt while one is live is a
 * clean 409.
 */
const enqueueDocumentSync = async (db, { firmId, userId, document }) => {
  const remoteId = remoteIdForDocument(document.id);
  const voucherXml = buildVoucherXml(document, { remoteId });
  const envelope = wrapVouchersEnvelope(voucherXml);

  try {
    const result = await db.query(
      `
        INSERT INTO tally_sync_jobs (
          firm_id, client_id, document_id, remote_id, voucher_xml, status, created_by
        ) VALUES ($1, $2, $3, $4, $5, 'queued', $6)
        RETURNING id, status, remote_id, created_at
      `,
      [firmId, document.client_id ?? null, document.id, remoteId, envelope, userId ?? null]
    );
    return result.rows[0];
  } catch (error) {
    // Unique-violation on the one-live-per-doc index.
    if (error.code === "23505") {
      throw ApiError.conflict("This document already has a pending Tally sync.");
    }
    throw error;
  }
};

/**
 * Claim the oldest queued job (or a stale claimed one) for this agent's firm.
 * Uses SKIP LOCKED so concurrent agents never grab the same job. Returns the
 * claimed job or null when the queue is empty.
 */
const claimNextJob = async (db, { firmId, agentId }) => {
  // A stale claim that has already used every attempt (the agent keeps dying
  // or can never report) would otherwise be reclaimed forever and show
  // "Pushing to Tally…" indefinitely — end it visibly instead.
  await db.query(
    `
      UPDATE tally_sync_jobs
      SET status = 'failed', completed_at = NOW(), updated_at = NOW(),
          last_error = COALESCE(last_error, 'The Tally agent stopped responding while pushing this voucher. Check the agent on the Tally PC, then push again.')
      WHERE firm_id = $1
        AND status = 'claimed'
        AND claimed_at < NOW() - ($2::int * INTERVAL '1 millisecond')
        AND attempts >= $3
    `,
    [firmId, CLAIM_STALE_MS, MAX_ATTEMPTS]
  );

  const result = await db.query(
    `
      WITH next_job AS (
        SELECT id
        FROM tally_sync_jobs
        WHERE firm_id = $1
          AND (
            status = 'queued'
            OR (status = 'claimed' AND claimed_at < NOW() - ($3::int * INTERVAL '1 millisecond') AND attempts < $4)
          )
        ORDER BY created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      UPDATE tally_sync_jobs j
      SET status = 'claimed',
          agent_id = $2,
          claimed_at = NOW(),
          attempts = attempts + 1,
          updated_at = NOW()
      FROM next_job
      WHERE j.id = next_job.id
      RETURNING j.id, j.document_id, j.remote_id, j.voucher_xml, j.attempts
    `,
    [firmId, agentId, CLAIM_STALE_MS, MAX_ATTEMPTS]
  );
  return result.rowCount > 0 ? result.rows[0] : null;
};

/**
 * Record an agent's report for a job. `report` is the parsed Tally result
 * (see parseTallyResponse). Success -> succeeded; failure -> failed, or back to
 * queued for another attempt if attempts remain and the error is retryable.
 */
const reportJobResult = async (db, { firmId, agentId, jobId, report }) => {
  const jobResult = await db.query(
    `SELECT id, attempts FROM tally_sync_jobs WHERE id = $1 AND firm_id = $2 AND agent_id = $3 LIMIT 1`,
    [jobId, firmId, agentId]
  );
  if (jobResult.rowCount === 0) {
    throw ApiError.notFound("Job not found for this agent");
  }
  const attempts = jobResult.rows[0].attempts;

  if (report.ok) {
    await db.query(
      `
        UPDATE tally_sync_jobs
        SET status = 'succeeded', result = $3::jsonb, last_error = NULL,
            completed_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND firm_id = $2
      `,
      [jobId, firmId, JSON.stringify(report)]
    );
    return { status: "succeeded" };
  }

  // Failure: retry (back to queued) while attempts remain AND the agent marked
  // it retryable (e.g. Tally was closed / company not loaded). A data error
  // (LINEERROR) is terminal — retrying the same XML will fail identically.
  const canRetry = report.retryable === true && attempts < MAX_ATTEMPTS;
  // completed_at is decided here rather than with `CASE WHEN $3 = 'failed'`:
  // reusing $3 as both the varchar column value and a text comparison made
  // Postgres reject every failure report ("inconsistent types deduced for
  // parameter $3"), so no failed push was ever recorded.
  await db.query(
    `
      UPDATE tally_sync_jobs
      SET status = $3, result = $4::jsonb, last_error = $5,
          completed_at = CASE WHEN $6::boolean THEN NOW() ELSE NULL END,
          updated_at = NOW()
      WHERE id = $1 AND firm_id = $2
    `,
    [jobId, firmId, canRetry ? "queued" : "failed", JSON.stringify(report), report.error || null, !canRetry]
  );
  return { status: canRetry ? "requeued" : "failed" };
};

const getJobStatus = async (db, { firmId, documentId }) => {
  const result = await db.query(
    `
      SELECT id, status, attempts, remote_id, result, last_error, completed_at, created_at
      FROM tally_sync_jobs
      WHERE firm_id = $1 AND document_id = $2
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [firmId, documentId]
  );
  return result.rowCount > 0 ? result.rows[0] : null;
};

// ── Tally response parsing ────────────────────────────────────────────────────

/**
 * Parse TallyPrime's import response XML into a structured result the agent can
 * report back. Tally returns a <RESPONSE> with CREATED / ALTERED / ERRORS
 * counts and, on a data error, one or more <LINEERROR> elements.
 *
 * Returns { ok, created, altered, errors, lineErrors[], retryable, error, raw }.
 * This runs agent-side in production, but lives here so it is one implementation
 * and unit-tested against real Tally response shapes.
 */
const parseTallyResponse = (xml) => {
  const text = String(xml || "");
  const num = (tag) => {
    const match = text.match(new RegExp(`<${tag}>\\s*(\\d+)\\s*</${tag}>`, "i"));
    return match ? Number(match[1]) : 0;
  };

  const created = num("CREATED");
  const altered = num("ALTERED");
  const errors = num("ERRORS") + num("EXCEPTIONS");

  const lineErrors = [];
  const lineErrorRegex = /<LINEERROR>([\s\S]*?)<\/LINEERROR>/gi;
  let match;
  while ((match = lineErrorRegex.exec(text)) !== null) {
    lineErrors.push(match[1].trim());
  }

  const ok = errors === 0 && lineErrors.length === 0 && created + altered > 0;

  return {
    ok,
    created,
    altered,
    errors,
    lineErrors,
    // A data/LINEERROR is terminal; the agent sets retryable for transport-level
    // problems (Tally closed, company not loaded) when it never got a response.
    retryable: false,
    error:
      lineErrors.length > 0
        ? lineErrors.join("; ")
        : ok
          ? null
          : errors > 0
            ? `Tally reported ${errors} error(s) importing the voucher`
            : "Tally reported no created or altered vouchers",
    raw: text.slice(0, 4000)
  };
};

module.exports = {
  MAX_ATTEMPTS,
  CLAIM_STALE_MS,
  generateAgentToken,
  remoteIdForDocument,
  registerAgent,
  listAgents,
  revokeAgent,
  authenticateAgent,
  hashAgentToken,
  recordHeartbeat,
  enqueueDocumentSync,
  claimNextJob,
  reportJobResult,
  getJobStatus,
  parseTallyResponse
};
