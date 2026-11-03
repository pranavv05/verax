/**
 * Adversarial / isolation tests for the merged GSTR-2B snapshot and Tally
 * connector features, against a live Postgres with migrations applied.
 *
 * Proves the security-critical properties that unit tests (mocked DB) cannot:
 *  - firm isolation on gstr2b_snapshots, tally_agents, tally_sync_jobs under the
 *    real least-privilege ca_app role;
 *  - the agent token-hash RLS escape hatch exposes ONLY the matching active
 *    agent, and only in the tally_agent auth context;
 *  - one-live-sync-job-per-document is enforced;
 *  - concurrent agent claims never hand the same job to two agents.
 *
 * Skipped automatically when DATABASE_URL/APP_DATABASE_URL aren't set.
 */
const crypto = require("crypto");
const { Pool } = require("pg");

const ADMIN_URL = process.env.DATABASE_URL;
const APP_URL = process.env.APP_DATABASE_URL;
const describeIfDb = ADMIN_URL && APP_URL ? describe : describe.skip;

const sharedAppPool = require("../../src/db/pool");
const { withTenantTransaction } = require("../../src/db/tenant-context");
const { claimNextJob } = require("../../src/services/tally-connector.service");

describeIfDb("GSTR-2B snapshots + Tally connector — isolation & concurrency", () => {
  let adminPool;
  let appPool;

  const firmA = "aaaaaaaa-1111-4000-8000-000000000001";
  const firmB = "bbbbbbbb-1111-4000-8000-000000000002";
  const clientA = "aaaaaaaa-1111-4000-8000-000000000011";
  const docA = "aaaaaaaa-1111-4000-8000-000000000111";

  const hash = (t) => crypto.createHash("sha256").update(t).digest("hex");

  // Read-only firm context that rolls back (for isolation assertions).
  const asFirm = async (firmId, extraSettings, fn) => {
    const client = await appPool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.current_firm_id', $1, true)", [firmId ?? ""]);
      for (const [k, v] of Object.entries(extraSettings || {})) {
        await client.query("SELECT set_config($1, $2, true)", [k, v ?? ""]);
      }
      return await fn(client);
    } finally {
      await client.query("ROLLBACK").catch(() => {});
      client.release();
    }
  };

  // Firm context that COMMITS, mirroring one app request. Used where a later
  // statement must see an earlier committed row (e.g. the unique-index test).
  const asFirmCommitted = async (firmId, fn) => {
    const client = await appPool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.current_firm_id', $1, true)", [firmId ?? ""]);
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  };

  beforeAll(async () => {
    adminPool = new Pool({ connectionString: ADMIN_URL });
    appPool = new Pool({ connectionString: APP_URL });

    await adminPool.query(
      `INSERT INTO firms (id, name, owner_email) VALUES
         ($1, 'Conn Test Firm A', 'conn-a@test.local'),
         ($2, 'Conn Test Firm B', 'conn-b@test.local')
       ON CONFLICT (id) DO NOTHING`,
      [firmA, firmB]
    );
    await adminPool.query(
      `INSERT INTO clients (id, firm_id, name, upload_token) VALUES
         ($1, $2, 'Conn Client A', 'conn_test_token_a_000000000000000000000000000000000000')
       ON CONFLICT (id) DO NOTHING`,
      [clientA, firmA]
    );
    await adminPool.query(
      `INSERT INTO documents (id, client_id, firm_id, file_name, s3_key, status) VALUES
         ($1, $2, $3, 'conn-doc-a.pdf', 'conn-test-key-a', 'reviewed')
       ON CONFLICT (id) DO NOTHING`,
      [docA, clientA, firmA]
    );
  });

  afterAll(async () => {
    await adminPool.query(`DELETE FROM tally_sync_jobs WHERE firm_id IN ($1,$2)`, [firmA, firmB]);
    await adminPool.query(`DELETE FROM tally_agents WHERE firm_id IN ($1,$2)`, [firmA, firmB]);
    await adminPool.query(`DELETE FROM gstr2b_snapshots WHERE firm_id IN ($1,$2)`, [firmA, firmB]);
    await adminPool.query(`DELETE FROM documents WHERE firm_id IN ($1,$2)`, [firmA, firmB]);
    await adminPool.query(`DELETE FROM clients WHERE firm_id IN ($1,$2)`, [firmA, firmB]);
    await adminPool.query(`DELETE FROM firms WHERE id IN ($1,$2)`, [firmA, firmB]);
    await adminPool.end();
    await appPool.end();
    await sharedAppPool.end();
  });

  test("gstr2b_snapshots: firm B cannot read firm A's snapshot", async () => {
    await asFirmCommitted(firmA, (client) =>
      client.query(
        `INSERT INTO gstr2b_snapshots (firm_id, client_id, period, source, records, record_count, total_taxable, total_gst)
         VALUES ($1,$2,'052026','offline_upload','[]'::jsonb,0,0,0)`,
        [firmA, clientA]
      )
    );
    const bSees = await asFirm(firmB, {}, (client) =>
      client.query(`SELECT id FROM gstr2b_snapshots WHERE firm_id = $1`, [firmA])
    );
    expect(bSees.rows).toHaveLength(0);
  });

  test("tally_agents: firm B cannot read firm A's agent rows", async () => {
    await asFirmCommitted(firmA, (client) =>
      client.query(
        `INSERT INTO tally_agents (firm_id, name, token_hash) VALUES ($1,'Agent A',$2)`,
        [firmA, hash("tokenA")]
      )
    );
    const bSees = await asFirm(firmB, {}, (client) =>
      client.query(`SELECT id FROM tally_agents WHERE firm_id = $1`, [firmA])
    );
    expect(bSees.rows).toHaveLength(0);
  });

  test("agent token-hash escape hatch exposes only the matching active agent, only in tally_agent context", async () => {
    // With the auth context + correct hash, exactly the one agent is visible
    // even with NO current_firm_id set (the pre-auth lookup).
    const found = await asFirm(
      "",
      { "app.auth_context": "tally_agent", "app.agent_token_hash": hash("tokenA") },
      (client) => client.query(`SELECT id, firm_id FROM tally_agents`)
    );
    expect(found.rows).toHaveLength(1);
    expect(found.rows[0].firm_id).toBe(firmA);

    // Wrong hash -> nothing.
    const none = await asFirm(
      "",
      { "app.auth_context": "tally_agent", "app.agent_token_hash": hash("wrong") },
      (client) => client.query(`SELECT id FROM tally_agents`)
    );
    expect(none.rows).toHaveLength(0);

    // Right hash but WITHOUT the tally_agent auth context -> nothing (the hash
    // alone is not an escape hatch).
    const noCtx = await asFirm(
      "",
      { "app.agent_token_hash": hash("tokenA") },
      (client) => client.query(`SELECT id FROM tally_agents`)
    );
    expect(noCtx.rows).toHaveLength(0);
  });

  test("a revoked agent is not exposed by the token-hash escape hatch", async () => {
    await asFirmCommitted(firmA, (client) =>
      client.query(
        `INSERT INTO tally_agents (firm_id, name, token_hash, status) VALUES ($1,'Revoked',$2,'revoked')`,
        [firmA, hash("revokedToken")]
      )
    );
    const found = await asFirm(
      "",
      { "app.auth_context": "tally_agent", "app.agent_token_hash": hash("revokedToken") },
      (client) => client.query(`SELECT id FROM tally_agents`)
    );
    expect(found.rows).toHaveLength(0);
  });

  test("one live sync job per document is enforced by the partial unique index", async () => {
    await asFirmCommitted(firmA, (client) =>
      client.query(
        `INSERT INTO tally_sync_jobs (firm_id, client_id, document_id, remote_id, voucher_xml, status)
         VALUES ($1,$2,$3,'verax-doc-dup','<x/>','queued')`,
        [firmA, clientA, docA]
      )
    );
    await expect(
      asFirmCommitted(firmA, (client) =>
        client.query(
          `INSERT INTO tally_sync_jobs (firm_id, client_id, document_id, remote_id, voucher_xml, status)
           VALUES ($1,$2,$3,'verax-doc-dup2','<x/>','queued')`,
          [firmA, clientA, docA]
        )
      )
    ).rejects.toThrow(/duplicate key|unique/i);

    // Once the first job reaches a terminal state, a new job is allowed.
    await adminPool.query(
      `UPDATE tally_sync_jobs SET status='succeeded', completed_at=NOW() WHERE document_id=$1`,
      [docA]
    );
    await expect(
      asFirmCommitted(firmA, (client) =>
        client.query(
          `INSERT INTO tally_sync_jobs (firm_id, client_id, document_id, remote_id, voucher_xml, status)
           VALUES ($1,$2,$3,'verax-doc-again','<x/>','queued')`,
          [firmA, clientA, docA]
        )
      )
    ).resolves.toBeDefined();
  });

  test("tally_sync_jobs: firm B cannot see firm A's jobs", async () => {
    const bSees = await asFirm(firmB, {}, (client) =>
      client.query(`SELECT id FROM tally_sync_jobs WHERE firm_id = $1`, [firmA])
    );
    expect(bSees.rows).toHaveLength(0);
  });

  test("two agents racing claimNextJob on one queued job: exactly one wins, through the real service function", async () => {
    const agent1 = "aaaaaaaa-2222-4000-8000-000000000001";
    const agent2 = "aaaaaaaa-2222-4000-8000-000000000002";
    const raceDoc = "aaaaaaaa-2222-4000-8000-000000000111";

    await adminPool.query(
      `INSERT INTO documents (id, client_id, firm_id, file_name, s3_key, status) VALUES
         ($1, $2, $3, 'conn-doc-race.pdf', 'conn-test-key-race', 'reviewed')
       ON CONFLICT (id) DO NOTHING`,
      [raceDoc, clientA, firmA]
    );
    await adminPool.query(
      `INSERT INTO tally_agents (id, firm_id, name, token_hash) VALUES
         ($1, $2, 'Race Agent 1', $3), ($4, $2, 'Race Agent 2', $5)
       ON CONFLICT (id) DO NOTHING`,
      [agent1, firmA, hash("raceAgent1"), agent2, hash("raceAgent2")]
    );
    // The earlier "one live sync job per document" test leaves its own queued
    // row behind (verax-doc-again) — settle it so this firm has exactly the
    // one queued job below for the two agents to actually contend over.
    await adminPool.query(
      `UPDATE tally_sync_jobs SET status = 'succeeded', completed_at = NOW()
       WHERE firm_id = $1 AND status = 'queued'`,
      [firmA]
    );
    await adminPool.query(
      `INSERT INTO tally_sync_jobs (firm_id, client_id, document_id, remote_id, voucher_xml, status)
       VALUES ($1,$2,$3,'verax-doc-race','<x/>','queued')`,
      [firmA, clientA, raceDoc]
    );

    // Fire both claims genuinely concurrently — each opens its own connection
    // and transaction, like two real agent processes polling at once — so the
    // SKIP LOCKED row lock is actually contended, not just logically argued.
    const [resultA, resultB] = await Promise.all([
      withTenantTransaction({ firmId: firmA }, (db) => claimNextJob(db, { firmId: firmA, agentId: agent1 })),
      withTenantTransaction({ firmId: firmA }, (db) => claimNextJob(db, { firmId: firmA, agentId: agent2 }))
    ]);

    const claims = [resultA, resultB].filter(Boolean);
    expect(claims).toHaveLength(1);
    expect(claims[0].remote_id).toBe("verax-doc-race");

    const row = await adminPool.query(`SELECT agent_id, status FROM tally_sync_jobs WHERE document_id = $1`, [
      raceDoc
    ]);
    expect(row.rows[0].status).toBe("claimed");
    expect([agent1, agent2]).toContain(row.rows[0].agent_id);
  });
});
