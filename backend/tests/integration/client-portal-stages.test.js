/**
 * The client portal groups documents into three stages. "Being read" used to
 * include documents already read and waiting on the accountant (extracted),
 * and documents Verax had given up on, which also told the client "It's
 * queued to be read" forever. The stats, the status filter and each
 * document's label must all agree on one definition.
 *
 * Requires a live Postgres with migrations applied. Skipped automatically
 * if DATABASE_URL/APP_DATABASE_URL aren't set, same as rls.test.js.
 */
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const request = require("supertest");

const ADMIN_URL = process.env.DATABASE_URL;
const APP_URL = process.env.APP_DATABASE_URL;

const describeIfDb = ADMIN_URL && APP_URL ? describe : describe.skip;

const sharedAppPool = require("../../src/db/pool");

describeIfDb("Client portal document stages", () => {
  let adminPool;
  let app;
  let accessToken;
  const firmId = "15151515-0000-4000-8000-000000000001";
  const clientId = "15151515-0000-4000-8000-000000000002";
  const portalEmail = "stages-test@example.com";
  const password = "correct horse battery staple";

  // [file, status, processing_error, processing_attempts]
  const documents = [
    ["queued.pdf", "uploaded", null, 0],
    ["retrying.pdf", "uploaded", "Groq 503", 1],
    ["reading.pdf", "processing", null, 1],
    ["read.pdf", "extracted", null, 1],
    ["flagged.pdf", "review_required", null, 1],
    ["approved.pdf", "reviewed", null, 1],
    ["unreadable.pdf", "uploaded", "OCR did not return usable text", 3],
    ["filed.pdf", "exported", null, 1]
  ];

  beforeAll(async () => {
    adminPool = new Pool({ connectionString: ADMIN_URL });
    await adminPool.query(
      `INSERT INTO firms (id, name, owner_email) VALUES ($1, 'Stages Test Firm', 'stages-owner@test.local')
       ON CONFLICT (id) DO NOTHING`,
      [firmId]
    );
    await adminPool.query(
      `INSERT INTO clients (id, firm_id, name, upload_token, portal_email, portal_password_hash, portal_enabled)
       VALUES ($1, $2, 'Stages Test Client', 'stagestesttoken000000000000000000000001', $3, $4, true)
       ON CONFLICT (id) DO UPDATE SET portal_password_hash = EXCLUDED.portal_password_hash`,
      [clientId, firmId, portalEmail, await bcrypt.hash(password, 10)]
    );
    // Counts are exact, so rows left by an interrupted earlier run must go.
    await adminPool.query(`DELETE FROM documents WHERE client_id = $1`, [clientId]);
    for (const [file, status, error, attempts] of documents) {
      await adminPool.query(
        `INSERT INTO documents (client_id, firm_id, file_name, s3_key, status, processing_error, processing_attempts)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [clientId, firmId, file, `stages/${file}`, status, error, attempts]
      );
    }

    app = require("../../src/app");
    const login = await request(app)
      .post("/api/client-portal/auth/login")
      .send({ email: portalEmail, password });
    accessToken = login.body.accessToken;
    if (!accessToken) throw new Error(`portal login failed: ${login.status} ${JSON.stringify(login.body).slice(0, 200)}`);
  });

  afterAll(async () => {
    await adminPool.query(`DELETE FROM audit_logs WHERE firm_id = $1`, [firmId]);
    await adminPool.query(`DELETE FROM client_refresh_tokens WHERE client_id = $1`, [clientId]);
    await adminPool.query(`DELETE FROM documents WHERE firm_id = $1`, [firmId]);
    await adminPool.query(`DELETE FROM clients WHERE firm_id = $1`, [firmId]);
    await adminPool.query(`DELETE FROM firms WHERE id = $1`, [firmId]);
    await adminPool.end();
    await sharedAppPool.end();
  });

  const get = (path) =>
    request(app).get(`/api/client-portal${path}`).set("Authorization", `Bearer ${accessToken}`);

  const filesIn = async (stage) => {
    const res = await get(`/documents?status=${stage}&limit=100`);
    expect(res.status).toBe(200);
    return res.body.data.map((doc) => doc.originalFilename).sort();
  };

  test("stats count only Verax's own work as 'being read'", async () => {
    const res = await get("/stats");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ totalDocuments: 8, processingCount: 3, reviewCount: 4, completedCount: 1 });
  });

  test("the status filter matches the stats", async () => {
    expect(await filesIn("processing")).toEqual(["queued.pdf", "reading.pdf", "retrying.pdf"]);
    expect(await filesIn("under_review")).toEqual(["approved.pdf", "flagged.pdf", "read.pdf", "unreadable.pdf"]);
    expect(await filesIn("complete")).toEqual(["filed.pdf"]);
  });

  test("a document Verax couldn't read says so instead of 'queued'", async () => {
    const list = await get("/documents?limit=100");
    const unreadable = list.body.data.find((doc) => doc.originalFilename === "unreadable.pdf");
    expect(unreadable.status).toBe("Under Review");

    const detail = await get(`/documents/${unreadable.id}`);
    expect(detail.body.statusMessage).toMatch(/couldn't read this document/);
  });
});
