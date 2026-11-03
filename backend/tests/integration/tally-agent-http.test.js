/**
 * The Tally agent's routes through the real Express app and a live Postgres.
 *
 * tally-connector-and-gstr2b.test.js proves the service and RLS layers, but
 * never went through HTTP routing — and the routing was broken: the firm
 * router (requireAuth on everything) was mounted at "/" before the agent
 * router, so every agent call was rejected as an invalid firm JWT and the
 * live connector never worked. This drives the whole agent lifecycle over HTTP.
 */
process.env.TRUST_PROXY = "1";
const crypto = require("crypto");
const request = require("supertest");
const { Pool } = require("pg");

const ADMIN_URL = process.env.DATABASE_URL;
const APP_URL = process.env.APP_DATABASE_URL;
const describeIfDb = ADMIN_URL && APP_URL ? describe : describe.skip;

const app = require("../../src/app");
const sharedAppPool = require("../../src/db/pool");
const { createAccessToken } = require("../../src/utils/token-utils");

describeIfDb("Tally agent over HTTP", () => {
  let adminPool;
  const firmId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const clientId = crypto.randomUUID();
  const docId = crypto.randomUUID();
  let firmJwt;
  let agentToken;
  let agentId;

  beforeAll(async () => {
    adminPool = new Pool({ connectionString: ADMIN_URL });
    await adminPool.query(`INSERT INTO firms (id, name, owner_email) VALUES ($1,'Agent HTTP Firm','agent-http@test.local')`, [firmId]);
    await adminPool.query(
      `INSERT INTO users (id, firm_id, name, email, password_hash, role) VALUES ($1,$2,'Admin','agent-http@test.local','x','admin')`,
      [userId, firmId]
    );
    await adminPool.query(
      `INSERT INTO clients (id, firm_id, name, upload_token) VALUES ($1,$2,'Agent HTTP Client',$3)`,
      [clientId, firmId, crypto.randomBytes(32).toString("hex")]
    );
    await adminPool.query(
      `INSERT INTO documents (id, client_id, firm_id, file_name, s3_key, status, doc_type) VALUES ($1,$2,$3,'inv.pdf','k','reviewed','invoice')`,
      [docId, clientId, firmId]
    );
    await adminPool.query(
      `INSERT INTO extractions (document_id, structured_data) VALUES ($1,$2::jsonb)`,
      [docId, JSON.stringify({ vendor_name: "Acme Supplies", invoice_number: "A-1", invoice_date: "2026-10-01", total_amount: 1180, cgst: 90, sgst: 90 })]
    );
    firmJwt = createAccessToken({ userId, firmId, role: "admin" });
  });

  afterAll(async () => {
    await adminPool.query(`DELETE FROM extractions WHERE document_id = $1`, [docId]);
    for (const t of ["tally_sync_jobs", "tally_agents", "audit_logs", "documents", "clients", "users"]) {
      await adminPool.query(`DELETE FROM ${t} WHERE firm_id = $1`, [firmId]);
    }
    await adminPool.query(`DELETE FROM firms WHERE id = $1`, [firmId]);
    await adminPool.end();
    await sharedAppPool.end();
  });

  const asFirm = (req) => req.set("Authorization", `Bearer ${firmJwt}`);
  const asAgent = (req) => req.set("Authorization", `Bearer ${agentToken}`);

  it("a firm admin registers an agent and gets its token once", async () => {
    const res = await asFirm(request(app).post("/api/tally/agents")).send({ name: "Office PC", tallyCompany: "Acme" });
    expect(res.status).toBe(201);
    expect(res.body.token).toMatch(/^vtally_/);
    agentToken = res.body.token;
    agentId = res.body.agent.id;
  });

  it("the agent's heartbeat is accepted (this was a 401 before the routing fix) and its Tally status is shown", async () => {
    const hb = await asAgent(request(app).post("/api/tally/agent/heartbeat")).send({ agentVersion: "1.0.0 (windows)", tallyStatus: "ready" });
    expect(hb.status).toBe(200);
    const list = await asFirm(request(app).get("/api/tally/agents"));
    const me = list.body.agents.find((a) => a.id === agentId);
    expect(me).toMatchObject({ agent_version: "1.0.0 (windows)", tally_status: "ready" });
    expect(me.last_seen_at).toBeTruthy();
  });

  it("an empty queue answers 204", async () => {
    expect((await asAgent(request(app).post("/api/tally/agent/claim"))).status).toBe(204);
  });

  it("queue → claim → report → the firm sees the result", async () => {
    const q = await asFirm(request(app).post("/api/tally/sync")).send({ documentId: docId });
    expect(q.status).toBe(202);

    const claim = await asAgent(request(app).post("/api/tally/agent/claim"));
    expect(claim.status).toBe(200);
    expect(claim.body.job).toMatchObject({ documentId: docId, remoteId: `verax-doc-${docId}` });
    expect(claim.body.job.voucherXml).toContain(`REMOTEID="verax-doc-${docId}"`);

    const report = await asAgent(request(app).post(`/api/tally/agent/jobs/${claim.body.job.id}/result`)).send({
      ok: true, created: 1, altered: 0, errors: 0, lineErrors: [], retryable: false, error: null, raw: "<RESPONSE/>"
    });
    expect(report.status).toBe(200);
    expect(report.body.status).toBe("succeeded");

    const status = await asFirm(request(app).get(`/api/tally/sync/${docId}`));
    expect(status.body.job.status).toBe("succeeded");
  });

  const queueAndClaim = async () => {
    await adminPool.query(`DELETE FROM tally_sync_jobs WHERE firm_id = $1`, [firmId]);
    expect((await asFirm(request(app).post("/api/tally/sync")).send({ documentId: docId })).status).toBe(202);
    const claim = await asAgent(request(app).post("/api/tally/agent/claim"));
    expect(claim.status).toBe(200);
    return claim.body.job.id;
  };

  it("a LINEERROR report is recorded as failed with Tally's reason (was a 500)", async () => {
    const jobId = await queueAndClaim();
    const res = await asAgent(request(app).post(`/api/tally/agent/jobs/${jobId}/result`)).send({
      ok: false, created: 0, altered: 0, errors: 1, lineErrors: ["Ledger 'Acme Supplies' does not exist!"],
      retryable: false, error: "Ledger 'Acme Supplies' does not exist!", raw: "<RESPONSE/>"
    });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("failed");
    const status = await asFirm(request(app).get(`/api/tally/sync/${docId}`));
    expect(status.body.job).toMatchObject({ status: "failed", last_error: "Ledger 'Acme Supplies' does not exist!" });
    expect(status.body.job.completed_at).toBeTruthy();
  });

  it("a retryable failure goes back to the queue for another attempt", async () => {
    const jobId = await queueAndClaim();
    const res = await asAgent(request(app).post(`/api/tally/agent/jobs/${jobId}/result`)).send({
      ok: false, lineErrors: [], retryable: true, error: "Tally did not respond"
    });
    expect(res.body.status).toBe("requeued");
    const status = await asFirm(request(app).get(`/api/tally/sync/${docId}`));
    expect(status.body.job).toMatchObject({ status: "queued", completed_at: null });
  });

  it("a stale claim that used every attempt is failed, not reclaimed forever", async () => {
    const jobId = await queueAndClaim();
    await adminPool.query(
      `UPDATE tally_sync_jobs SET attempts = 5, claimed_at = NOW() - INTERVAL '10 minutes' WHERE id = $1`,
      [jobId]
    );
    expect((await asAgent(request(app).post("/api/tally/agent/claim"))).status).toBe(204);
    const status = await asFirm(request(app).get(`/api/tally/sync/${docId}`));
    expect(status.body.job.status).toBe("failed");
    expect(status.body.job.last_error).toMatch(/stopped responding/);
  });

  it("auth boundaries hold in both directions", async () => {
    // No token / a firm JWT on agent routes → rejected.
    expect((await request(app).post("/api/tally/agent/claim")).status).toBe(401);
    expect((await asFirm(request(app).post("/api/tally/agent/claim"))).status).toBe(401);
    // An agent token on firm routes → rejected.
    expect((await asAgent(request(app).get("/api/tally/agents"))).status).toBe(401);
  });

  it("a revoked agent is locked out immediately", async () => {
    expect((await asFirm(request(app).delete(`/api/tally/agents/${agentId}`))).status).toBe(204);
    expect((await asAgent(request(app).post("/api/tally/agent/heartbeat")).send({})).status).toBe(401);
  });
});
