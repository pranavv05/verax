/**
 * Live Tally connector — agent registry + sync job queue.
 *
 * Verax can generate TallyPrime import XML but only as a file the CA imports by
 * hand. Every serious competitor posts vouchers straight into TallyPrime. Tally
 * exposes an HTTP XML server on the firm's own machine (default localhost:9000),
 * which is not reachable from our cloud backend. The bridge is a small Windows
 * AGENT the firm installs next to Tally: it holds an OUTBOUND connection to
 * Verax, pulls queued sync jobs, POSTs the voucher XML to localhost:9000, reads
 * Tally's response, and reports the result back. No inbound ports, no VPN.
 *
 * Two tables:
 *
 *  - tally_agents: one row per installed agent (per firm). Carries a hashed
 *    agent token (never the plaintext, same discipline as refresh tokens),
 *    which Tally company it targets, and a heartbeat so the UI can show
 *    online/offline. Firm-scoped RLS.
 *
 *  - tally_sync_jobs: the work queue. One row per document (or bank txn batch)
 *    the firm asked to push. Carries the generated voucher XML, a STABLE
 *    remote_id derived from the document so a re-push updates rather than
 *    duplicates in Tally, a status lifecycle, attempt count, and the parsed
 *    Tally response (created/altered/errors, LINEERROR text). Firm-scoped RLS.
 *
 * Both follow the narration_mappings pattern: ENABLE + FORCE ROW LEVEL
 * SECURITY, firm isolation via app.current_firm_id, qualified
 * app.set_updated_at() trigger, ca_app grants via default privileges.
 */

exports.up = async function up(knex) {
  await knex.raw(`
    CREATE TABLE tally_agents (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      firm_id         UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
      name            VARCHAR(120) NOT NULL,
      -- SHA-256 of the agent token; the plaintext is shown once at creation and
      -- never stored, exactly like client refresh tokens.
      token_hash      CHAR(64) NOT NULL UNIQUE,
      -- The Tally company this agent imports into (the firm configures it in
      -- the agent). Informational for display and audit.
      tally_company   VARCHAR(255),
      status          VARCHAR(20) NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'revoked')),
      last_seen_at    TIMESTAMPTZ,
      -- Free-form version/host string the agent reports on heartbeat.
      agent_version   VARCHAR(50),
      created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_tally_agents_firm ON tally_agents (firm_id);
    CREATE UNIQUE INDEX idx_tally_agents_token ON tally_agents (token_hash);

    ALTER TABLE tally_agents ENABLE ROW LEVEL SECURITY;
    ALTER TABLE tally_agents FORCE ROW LEVEL SECURITY;

    -- Firm users see their firm's agents (app.current_firm_id). The agent itself
    -- authenticates BEFORE its firm is known, by presenting its token: the
    -- agent-auth middleware opens a transaction that sets app.agent_token_hash
    -- (and app.auth_context='tally_agent'), and this policy lets exactly the
    -- matching active agent row be read so the backend can learn its firm_id.
    -- Same technique as the client-portal magic-link policy (app.upload_token).
    CREATE POLICY tally_agents_firm_isolation
    ON tally_agents
    FOR ALL
    USING (
      firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid
      OR (
        current_setting('app.auth_context', true) = 'tally_agent'
        AND token_hash = NULLIF(current_setting('app.agent_token_hash', true), '')
        AND status = 'active'
      )
    )
    WITH CHECK (firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid);

    CREATE TRIGGER set_updated_at_tally_agents
      BEFORE UPDATE ON tally_agents
      FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
  `);

  await knex.raw(`
    CREATE TABLE tally_sync_jobs (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      firm_id         UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
      client_id       UUID REFERENCES clients(id) ON DELETE SET NULL,
      document_id     UUID REFERENCES documents(id) ON DELETE CASCADE,
      agent_id        UUID REFERENCES tally_agents(id) ON DELETE SET NULL,
      -- Stable idempotency key: the same document always produces the same
      -- remote_id, so a re-push carries VCHTYPE ACTION with this REMOTEID and
      -- Tally updates the existing voucher instead of creating a duplicate.
      remote_id       VARCHAR(100) NOT NULL,
      voucher_xml     TEXT NOT NULL,
      status          VARCHAR(20) NOT NULL DEFAULT 'queued'
                        CHECK (status IN ('queued', 'claimed', 'succeeded', 'failed', 'cancelled')),
      attempts        INTEGER NOT NULL DEFAULT 0,
      -- When an agent claims a job, to detect and requeue abandoned claims.
      claimed_at      TIMESTAMPTZ,
      completed_at    TIMESTAMPTZ,
      -- Parsed Tally response: { created, altered, errors, lineError, raw }.
      result          JSONB,
      last_error      TEXT,
      created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      -- One live (non-terminal) job per document: a document can be re-queued
      -- after a terminal result, but not queued twice at once. Enforced by a
      -- partial unique index below rather than a table constraint.
      UNIQUE (id)
    );

    CREATE INDEX idx_tally_sync_jobs_firm ON tally_sync_jobs (firm_id);
    CREATE INDEX idx_tally_sync_jobs_queue
      ON tally_sync_jobs (firm_id, status, created_at)
      WHERE status IN ('queued', 'claimed');
    -- At most one in-flight job per document (queued or claimed). A new push is
    -- allowed once the previous job reaches a terminal state.
    CREATE UNIQUE INDEX idx_tally_sync_jobs_one_live_per_doc
      ON tally_sync_jobs (document_id)
      WHERE status IN ('queued', 'claimed') AND document_id IS NOT NULL;

    ALTER TABLE tally_sync_jobs ENABLE ROW LEVEL SECURITY;
    ALTER TABLE tally_sync_jobs FORCE ROW LEVEL SECURITY;

    CREATE POLICY tally_sync_jobs_firm_isolation
    ON tally_sync_jobs
    FOR ALL
    USING (firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid)
    WITH CHECK (firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid);

    CREATE TRIGGER set_updated_at_tally_sync_jobs
      BEFORE UPDATE ON tally_sync_jobs
      FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`DROP TABLE IF EXISTS tally_sync_jobs CASCADE;`);
  await knex.raw(`DROP TABLE IF EXISTS tally_agents CASCADE;`);
};
