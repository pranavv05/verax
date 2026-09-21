/**
 * updateExtraction previously only rejected edits once a document's status
 * was 'exported' — after approval, status becomes 'reviewed', not
 * 'exported', so a PUT sent directly against an approved-but-not-yet-
 * exported document silently overwrote the approved data with no error.
 * The frontend hid the edit UI once reviewed, but that was cosmetic only.
 * This is the regression guard for the backend-side fix.
 *
 * Requires a live Postgres with migrations applied. Skipped automatically
 * if DATABASE_URL/APP_DATABASE_URL aren't set, same as rls.test.js.
 */
const { Pool } = require("pg");

const ADMIN_URL = process.env.DATABASE_URL;
const APP_URL = process.env.APP_DATABASE_URL;

const describeIfDb = ADMIN_URL && APP_URL ? describe : describe.skip;

// Required at module scope (not inside each test) so env.js's Joi
// validation — triggered the first time src/db/pool.js is required — reads
// DATABASE_URL/APP_DATABASE_URL from an env already populated by the
// `npm run test:integration` invocation, matching rls.test.js's convention.
const { withTenantTransaction } = require("../../src/db/tenant-context");
const { updateExtraction } = require("../../src/services/extractions.service");
// The service under test runs through the app-wide shared pool (not a
// per-test Pool like adminPool below), so it has to be closed explicitly or
// Jest hangs after the run waiting on that open handle.
const sharedAppPool = require("../../src/db/pool");

describeIfDb("Extraction edit lock after approval", () => {
  let adminPool;
  const firmId = "12121212-0000-4000-8000-000000000001";
  const clientId = "12121212-0000-4000-8000-000000000011";
  const documentId = "12121212-0000-4000-8000-000000000111";

  beforeAll(async () => {
    adminPool = new Pool({ connectionString: ADMIN_URL });
    await adminPool.query(
      `INSERT INTO firms (id, name, owner_email) VALUES ($1, 'Lock Test Firm', 'lock-test@test.local')
       ON CONFLICT (id) DO NOTHING`,
      [firmId]
    );
    await adminPool.query(
      `INSERT INTO clients (id, firm_id, name, upload_token) VALUES
         ($1, $2, 'Lock Test Client', 'lock_test_token_00000000000000000000000000000000000000000')
       ON CONFLICT (id) DO NOTHING`,
      [clientId, firmId]
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

  const setDocumentStatus = (status) =>
    adminPool.query(
      `INSERT INTO documents (id, client_id, firm_id, file_name, s3_key, status)
       VALUES ($1, $2, $3, 'lock-test.pdf', 'lock-test-key', $4)
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status`,
      [documentId, clientId, firmId, status]
    );

  const ensureExtraction = () =>
    adminPool.query(
      `INSERT INTO extractions (document_id, structured_data)
       VALUES ($1, '{}'::jsonb)
       ON CONFLICT (document_id) DO NOTHING`,
      [documentId]
    );

  test("rejects an edit once the document is 'reviewed' (approved but not yet exported)", async () => {
    await setDocumentStatus("reviewed");
    await ensureExtraction();

    await expect(
      withTenantTransaction({ firmId }, (db) =>
        updateExtraction(db, {
          firmId,
          documentId,
          structuredData: { vendor_name: "Overwritten" },
          userId: null
        })
      )
    ).rejects.toThrow(/already been approved or exported/);
  });

  test("rejects an edit once the document is 'exported'", async () => {
    await setDocumentStatus("exported");
    await ensureExtraction();

    await expect(
      withTenantTransaction({ firmId }, (db) =>
        updateExtraction(db, {
          firmId,
          documentId,
          structuredData: { vendor_name: "Overwritten" },
          userId: null
        })
      )
    ).rejects.toThrow(/already been approved or exported/);
  });

  test("still allows an edit while the document is only 'extracted' (not yet reviewed)", async () => {
    await setDocumentStatus("extracted");
    await ensureExtraction();

    const result = await withTenantTransaction({ firmId }, (db) =>
      updateExtraction(db, {
        firmId,
        documentId,
        structuredData: { vendor_name: "Legitimate edit" },
        userId: null
      })
    );
    expect(result).toEqual({ success: true });
  });
});
