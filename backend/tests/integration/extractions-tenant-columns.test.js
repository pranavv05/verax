/**
 * extractions.firm_id / client_id are set by triggers from the document, and
 * the RLS policy relies on them. These tests attack that from the
 * least-privilege app role: spoofed tenant columns, extractions for another
 * firm's document, a document moving client, and the client-portal scope.
 *
 * Skipped automatically when DATABASE_URL/APP_DATABASE_URL aren't set.
 */
const { Pool } = require("pg");

const ADMIN_URL = process.env.DATABASE_URL;
const APP_URL = process.env.APP_DATABASE_URL;
const describeIfDb = ADMIN_URL && APP_URL ? describe : describe.skip;

describeIfDb("extractions tenant columns — live database, app role", () => {
  let adminPool;
  let appPool;
  const firmA = "cccc0000-0000-4000-8000-00000000000a";
  const firmB = "cccc0000-0000-4000-8000-00000000000b";
  const clientA1 = "cccc0000-0000-4000-8000-0000000000a1";
  const clientA2 = "cccc0000-0000-4000-8000-0000000000a2";
  const clientB1 = "cccc0000-0000-4000-8000-0000000000b1";
  const docA = "cccc0000-0000-4000-8000-000000000a01";
  const docA2 = "cccc0000-0000-4000-8000-000000000a02";
  const docB = "cccc0000-0000-4000-8000-000000000b01";

  // Runs fn inside a transaction as ca_app with the given tenant context.
  const as = async ({ firmId, clientId = null }, fn) => {
    const client = await appPool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.current_firm_id', $1, true)", [firmId]);
      if (clientId) await client.query("SELECT set_config('app.current_client_id', $1, true)", [clientId]);
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  };

  const tenantOf = async (documentId) =>
    (await adminPool.query(`SELECT firm_id, client_id FROM extractions WHERE document_id = $1`, [documentId])).rows[0];

  beforeAll(async () => {
    adminPool = new Pool({ connectionString: ADMIN_URL });
    appPool = new Pool({ connectionString: APP_URL });
    await adminPool.query(
      `INSERT INTO firms (id, name, owner_email) VALUES ($1,'Ext A','ext-a@test.local'), ($2,'Ext B','ext-b@test.local')`,
      [firmA, firmB]
    );
    await adminPool.query(
      `INSERT INTO clients (id, firm_id, name, upload_token) VALUES
        ($1,$4,'A1','ext_tok_a1_000000000000000000000000000000000000000000'),
        ($2,$4,'A2','ext_tok_a2_000000000000000000000000000000000000000000'),
        ($3,$5,'B1','ext_tok_b1_000000000000000000000000000000000000000000')`,
      [clientA1, clientA2, clientB1, firmA, firmB]
    );
    await adminPool.query(
      `INSERT INTO documents (id, client_id, firm_id, file_name, s3_key) VALUES
        ($1,$4,$6,'a.pdf','ext/a'), ($2,$5,$6,'a2.pdf','ext/a2'), ($3,$7,$8,'b.pdf','ext/b')`,
      [docA, docA2, docB, clientA1, clientA2, firmA, clientB1, firmB]
    );
  });

  afterAll(async () => {
    await adminPool.query(`DELETE FROM extractions WHERE document_id IN ($1,$2,$3)`, [docA, docA2, docB]);
    await adminPool.query(`DELETE FROM documents WHERE firm_id IN ($1,$2)`, [firmA, firmB]);
    await adminPool.query(`DELETE FROM clients WHERE firm_id IN ($1,$2)`, [firmA, firmB]);
    await adminPool.query(`DELETE FROM firms WHERE id IN ($1,$2)`, [firmA, firmB]);
    await adminPool.end();
    await appPool.end();
  });

  test("an insert gets its tenant from the document, whatever the writer supplies", async () => {
    await as({ firmId: firmA }, (db) =>
      db.query(`INSERT INTO extractions (document_id, firm_id, client_id) VALUES ($1, $2, $3)`, [docA, firmB, clientB1])
    );
    expect(await tenantOf(docA)).toEqual({ firm_id: firmA, client_id: clientA1 });
  });

  test("an update cannot repoint the tenant columns", async () => {
    await as({ firmId: firmA }, (db) =>
      db.query(`UPDATE extractions SET firm_id = $2, client_id = $3 WHERE document_id = $1`, [docA, firmB, clientB1])
    );
    expect(await tenantOf(docA)).toEqual({ firm_id: firmA, client_id: clientA1 });
  });

  test("firm A cannot create an extraction for firm B's document", async () => {
    await expect(
      as({ firmId: firmA }, (db) => db.query(`INSERT INTO extractions (document_id) VALUES ($1)`, [docB]))
    ).rejects.toThrow(/row-level security|null value/);
    expect(await tenantOf(docB)).toBeUndefined();
  });

  test("firm B sees none of firm A's extractions", async () => {
    const rows = await as({ firmId: firmB }, (db) => db.query(`SELECT document_id FROM extractions`));
    expect(rows.rows.map((r) => r.document_id)).not.toContain(docA);
  });

  test("client-portal scope: client A2 sees only its own extractions", async () => {
    await as({ firmId: firmA }, (db) => db.query(`INSERT INTO extractions (document_id) VALUES ($1)`, [docA2]));
    const a2 = await as({ firmId: firmA, clientId: clientA2 }, (db) => db.query(`SELECT document_id FROM extractions`));
    expect(a2.rows.map((r) => r.document_id)).toEqual([docA2]);
    const a1 = await as({ firmId: firmA, clientId: clientA1 }, (db) => db.query(`SELECT document_id FROM extractions`));
    expect(a1.rows.map((r) => r.document_id)).toEqual([docA]);
  });

  test("moving a document to another client moves its extraction's visibility with it", async () => {
    await as({ firmId: firmA }, (db) => db.query(`UPDATE documents SET client_id = $2 WHERE id = $1`, [docA2, clientA1]));
    expect(await tenantOf(docA2)).toEqual({ firm_id: firmA, client_id: clientA1 });
    const a2 = await as({ firmId: firmA, clientId: clientA2 }, (db) => db.query(`SELECT document_id FROM extractions`));
    expect(a2.rows).toHaveLength(0);
  });
});
