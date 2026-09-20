/**
 * Verifies the single most important security invariant in this codebase:
 * a firm can never see another firm's rows, and this holds under the actual
 * least-privilege `ca_app` role the app is meant to run as in production —
 * not just under whatever superuser happens to run the test.
 *
 * Requires a live Postgres with migrations applied (`npm run migrate:latest`)
 * before this runs. See `npm run test:integration`. Skipped automatically if
 * DATABASE_URL/APP_DATABASE_URL aren't set, so `npm test` (unit tests) stays
 * fast and DB-free.
 */
const { Pool } = require("pg");

const ADMIN_URL = process.env.DATABASE_URL;
const APP_URL = process.env.APP_DATABASE_URL;

const describeIfDb = ADMIN_URL && APP_URL ? describe : describe.skip;

describeIfDb("Row Level Security — tenant isolation", () => {
  let adminPool;
  let appPool;

  const firmA = "aaaaaaaa-0000-4000-8000-000000000001";
  const firmB = "bbbbbbbb-0000-4000-8000-000000000002";
  const clientA = "aaaaaaaa-0000-4000-8000-000000000011";
  const clientB = "bbbbbbbb-0000-4000-8000-000000000022";
  const docA = "aaaaaaaa-0000-4000-8000-000000000111";
  const docB = "bbbbbbbb-0000-4000-8000-000000000222";

  beforeAll(async () => {
    adminPool = new Pool({ connectionString: ADMIN_URL });
    appPool = new Pool({ connectionString: APP_URL });

    await adminPool.query(
      `INSERT INTO firms (id, name, owner_email) VALUES ($1, 'RLS Test Firm A', 'rls-a@test.local'), ($2, 'RLS Test Firm B', 'rls-b@test.local')
       ON CONFLICT (id) DO NOTHING`,
      [firmA, firmB]
    );
    await adminPool.query(
      `INSERT INTO clients (id, firm_id, name, upload_token) VALUES
         ($1, $3, 'Client A', 'rls_test_token_a_0000000000000000000000000000000000000000'),
         ($2, $4, 'Client B', 'rls_test_token_b_0000000000000000000000000000000000000000')
       ON CONFLICT (id) DO NOTHING`,
      [clientA, clientB, firmA, firmB]
    );
    await adminPool.query(
      `INSERT INTO documents (id, client_id, firm_id, file_name, s3_key) VALUES
         ($1, $3, $5, 'doc-a.pdf', 'rls-test-key-a'),
         ($2, $4, $6, 'doc-b.pdf', 'rls-test-key-b')
       ON CONFLICT (id) DO NOTHING`,
      [docA, docB, clientA, clientB, firmA, firmB]
    );
  });

  afterAll(async () => {
    await adminPool.query(`DELETE FROM documents WHERE firm_id IN ($1, $2)`, [firmA, firmB]);
    await adminPool.query(`DELETE FROM clients WHERE firm_id IN ($1, $2)`, [firmA, firmB]);
    await adminPool.query(`DELETE FROM firms WHERE id IN ($1, $2)`, [firmA, firmB]);
    await adminPool.end();
    await appPool.end();
  });

  const asFirm = async (firmId, fn) => {
    const client = await appPool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.current_firm_id', $1, true)", [firmId ?? ""]);
      return await fn(client);
    } finally {
      await client.query("ROLLBACK").catch(() => {});
      client.release();
    }
  };

  test("the app role is not a Postgres superuser (a superuser bypasses RLS entirely)", async () => {
    const result = await appPool.query("SELECT usesuper FROM pg_user WHERE usename = current_user");
    expect(result.rows[0].usesuper).toBe(false);
  });

  test("firm A only sees its own document, never firm B's", async () => {
    const rows = await asFirm(firmA, async (client) => {
      const result = await client.query("SELECT id, firm_id FROM documents ORDER BY file_name");
      return result.rows;
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(docA);
  });

  test("firm B only sees its own document, never firm A's", async () => {
    const rows = await asFirm(firmB, async (client) => {
      const result = await client.query("SELECT id, firm_id FROM documents ORDER BY file_name");
      return result.rows;
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(docB);
  });

  test("with no tenant context set, zero rows are visible (fails closed, not open)", async () => {
    const rows = await asFirm(null, async (client) => {
      const result = await client.query(
        "SELECT id FROM documents WHERE id IN ($1, $2)",
        [docA, docB]
      );
      return result.rows;
    });
    expect(rows).toHaveLength(0);
  });

  test("firm A cannot read firm B's client records either", async () => {
    const rows = await asFirm(firmA, async (client) => {
      const result = await client.query("SELECT id FROM clients WHERE id = $1", [clientB]);
      return result.rows;
    });
    expect(rows).toHaveLength(0);
  });

  test("firm A cannot insert a document scoped to firm B (RLS WITH CHECK rejects it)", async () => {
    await expect(
      asFirm(firmA, async (client) => {
        await client.query(
          `INSERT INTO documents (id, client_id, firm_id, file_name, s3_key)
           VALUES ('cccccccc-0000-4000-8000-000000000999', $1, $2, 'malicious.pdf', 'rls-test-key-x')`,
          [clientB, firmB]
        );
      })
    ).rejects.toThrow();
  });
});
