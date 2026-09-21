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

describeIfDb("Row Level Security — client-portal sibling isolation", () => {
  // Distinct from the firm-vs-firm suite above: this covers the case a
  // client-portal session (app.current_client_id set) reading documents,
  // extractions and tally_exports for a SIBLING client within the SAME
  // firm — the failure mode that mattered most, since documents/
  // extractions/tally_exports RLS policies only checked firm_id until
  // migration 20260921000000_client_portal_rls_backstop.js. Before that
  // fix, isolation between siblings depended entirely on every route
  // remembering its own client_id filter, with nothing at the database
  // level to catch a mistake.
  let adminPool;
  let appPool;

  const firm = "dddddddd-0000-4000-8000-000000000001";
  const clientX = "eeeeeeee-0000-4000-8000-000000000011";
  const clientY = "ffffffff-0000-4000-8000-000000000022";
  const docX = "eeeeeeee-0000-4000-8000-000000000111";
  const docY = "ffffffff-0000-4000-8000-000000000222";
  const extractionX = "eeeeeeee-0000-4000-8000-000000000333";
  const extractionY = "ffffffff-0000-4000-8000-000000000444";
  const exportX = "eeeeeeee-0000-4000-8000-000000000555";
  const exportY = "ffffffff-0000-4000-8000-000000000666";

  beforeAll(async () => {
    adminPool = new Pool({ connectionString: ADMIN_URL });
    appPool = new Pool({ connectionString: APP_URL });

    await adminPool.query(
      `INSERT INTO firms (id, name, owner_email) VALUES ($1, 'RLS Sibling Test Firm', 'rls-sibling@test.local')
       ON CONFLICT (id) DO NOTHING`,
      [firm]
    );
    await adminPool.query(
      `INSERT INTO clients (id, firm_id, name, upload_token) VALUES
         ($1, $3, 'Client X', 'rls_sibling_token_x_000000000000000000000000000000000000000'),
         ($2, $3, 'Client Y', 'rls_sibling_token_y_000000000000000000000000000000000000000')
       ON CONFLICT (id) DO NOTHING`,
      [clientX, clientY, firm]
    );
    await adminPool.query(
      `INSERT INTO documents (id, client_id, firm_id, file_name, s3_key) VALUES
         ($1, $3, $5, 'doc-x.pdf', 'rls-sibling-key-x'),
         ($2, $4, $5, 'doc-y.pdf', 'rls-sibling-key-y')
       ON CONFLICT (id) DO NOTHING`,
      [docX, docY, clientX, clientY, firm]
    );
    await adminPool.query(
      `INSERT INTO extractions (id, document_id, structured_data) VALUES
         ($1, $3, '{}'::jsonb), ($2, $4, '{}'::jsonb)
       ON CONFLICT (id) DO NOTHING`,
      [extractionX, extractionY, docX, docY]
    );
    await adminPool.query(
      `INSERT INTO tally_exports (id, firm_id, client_id, xml_s3_key) VALUES
         ($1, $3, $4, 'rls-sibling-export-x.xml'),
         ($2, $3, $5, 'rls-sibling-export-y.xml')
       ON CONFLICT (id) DO NOTHING`,
      [exportX, exportY, firm, clientX, clientY]
    );
  });

  afterAll(async () => {
    await adminPool.query(`DELETE FROM tally_exports WHERE firm_id = $1`, [firm]);
    await adminPool.query(`DELETE FROM extractions WHERE document_id IN ($1, $2)`, [docX, docY]);
    await adminPool.query(`DELETE FROM documents WHERE firm_id = $1`, [firm]);
    await adminPool.query(`DELETE FROM clients WHERE firm_id = $1`, [firm]);
    await adminPool.query(`DELETE FROM firms WHERE id = $1`, [firm]);
    await adminPool.end();
    await appPool.end();
  });

  const asClientPortalSession = async (firmId, clientId, fn) => {
    const client = await appPool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.current_firm_id', $1, true)", [firmId]);
      await client.query("SELECT set_config('app.current_client_id', $1, true)", [clientId]);
      return await fn(client);
    } finally {
      await client.query("ROLLBACK").catch(() => {});
      client.release();
    }
  };

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

  test("client X's portal session sees only its own document, not sibling client Y's", async () => {
    const rows = await asClientPortalSession(firm, clientX, async (client) => {
      const result = await client.query("SELECT id FROM documents ORDER BY file_name");
      return result.rows;
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(docX);
  });

  test("client X's portal session sees only its own extraction, not sibling client Y's", async () => {
    const rows = await asClientPortalSession(firm, clientX, async (client) => {
      const result = await client.query("SELECT id, document_id FROM extractions");
      return result.rows;
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].document_id).toBe(docX);
  });

  test("client X's portal session sees only its own Tally export, not sibling client Y's", async () => {
    const rows = await asClientPortalSession(firm, clientX, async (client) => {
      const result = await client.query("SELECT id, client_id FROM tally_exports");
      return result.rows;
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].client_id).toBe(clientX);
  });

  test("client Y's portal session symmetrically cannot see client X's rows", async () => {
    const rows = await asClientPortalSession(firm, clientY, async (client) => {
      const docs = await client.query("SELECT id FROM documents");
      const extractions = await client.query("SELECT id FROM extractions");
      const exports = await client.query("SELECT id FROM tally_exports");
      return { docs: docs.rows, extractions: extractions.rows, exports: exports.rows };
    });
    expect(rows.docs).toEqual([{ id: docY }]);
    expect(rows.extractions).toEqual([{ id: extractionY }]);
    expect(rows.exports).toEqual([{ id: exportY }]);
  });

  test("an ordinary firm/staff session (no client_id set) still sees both siblings' documents", async () => {
    const rows = await asFirm(firm, async (client) => {
      const result = await client.query(
        "SELECT id FROM documents WHERE firm_id = $1 ORDER BY file_name",
        [firm]
      );
      return result.rows;
    });
    expect(rows.map((r) => r.id).sort()).toEqual([docX, docY].sort());
  });
});
