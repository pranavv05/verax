/**
 * Six simultaneous Approve requests on one document (a double-clicked button,
 * two tabs, a retry after a slow response) used to race: some returned 500 and
 * more than one approval was recorded. approveExtraction now locks the document
 * row, so the first request approves and the rest see "already reviewed" and
 * return success without repeating the snapshot or the audit entry.
 *
 * Requires a live Postgres with migrations applied. Skipped automatically
 * if DATABASE_URL/APP_DATABASE_URL aren't set, same as rls.test.js.
 */
const { Pool } = require("pg");

const ADMIN_URL = process.env.DATABASE_URL;
const APP_URL = process.env.APP_DATABASE_URL;

const describeIfDb = ADMIN_URL && APP_URL ? describe : describe.skip;

const { withTenantTransaction } = require("../../src/db/tenant-context");
const { approveExtraction } = require("../../src/services/extractions.service");
const sharedAppPool = require("../../src/db/pool");

describeIfDb("Concurrent approval of one document", () => {
  let adminPool;
  const firmId = "13131313-0000-4000-8000-000000000001";
  const clientId = "13131313-0000-4000-8000-000000000011";
  const documentId = "13131313-0000-4000-8000-000000000111";

  beforeAll(async () => {
    adminPool = new Pool({ connectionString: ADMIN_URL });
    await adminPool.query(
      `INSERT INTO firms (id, name, owner_email) VALUES ($1, 'Approve Race Firm', 'approve-race@test.local')
       ON CONFLICT (id) DO NOTHING`,
      [firmId]
    );
    await adminPool.query(
      `INSERT INTO clients (id, firm_id, name, upload_token) VALUES
         ($1, $2, 'Approve Race Client', 'approve_race_token_0000000000000000000000000000000000000')
       ON CONFLICT (id) DO NOTHING`,
      [clientId, firmId]
    );
    await adminPool.query(
      `INSERT INTO documents (id, client_id, firm_id, file_name, s3_key, status)
       VALUES ($1, $2, $3, 'race.pdf', 'race-key', 'extracted')
       ON CONFLICT (id) DO UPDATE SET status = 'extracted'`,
      [documentId, clientId, firmId]
    );
    await adminPool.query(
      `INSERT INTO extractions (document_id, structured_data)
       VALUES ($1, '{"vendor_name":"Race Co"}'::jsonb)
       ON CONFLICT (document_id) DO NOTHING`,
      [documentId]
    );
  });

  afterAll(async () => {
    await adminPool.query(`DELETE FROM audit_logs WHERE firm_id = $1`, [firmId]);
    await adminPool.query(`DELETE FROM extractions WHERE document_id = $1`, [documentId]);
    await adminPool.query(`DELETE FROM document_versions WHERE document_id = $1`, [documentId]);
    await adminPool.query(`DELETE FROM documents WHERE firm_id = $1`, [firmId]);
    await adminPool.query(`DELETE FROM clients WHERE firm_id = $1`, [firmId]);
    await adminPool.query(`DELETE FROM firms WHERE id = $1`, [firmId]);
    await adminPool.end();
    await sharedAppPool.end();
  });

  test("six parallel approvals all succeed and the approval is recorded once", async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () =>
        withTenantTransaction({ firmId }, (db) =>
          approveExtraction(db, { firmId, documentId, userId: null, nameMappingService: null })
        )
      )
    );

    expect(results.map((r) => r.status)).toEqual(Array(6).fill("fulfilled"));

    const audit = await adminPool.query(
      `SELECT count(*)::int AS n FROM audit_logs WHERE firm_id = $1 AND action = 'extraction_approved'`,
      [firmId]
    );
    expect(audit.rows[0].n).toBe(1);

    const doc = await adminPool.query(`SELECT status FROM documents WHERE id = $1`, [documentId]);
    expect(doc.rows[0].status).toBe("reviewed");
  });
});
