/**
 * Hard end-to-end + adversarial tests for ITC Desk and IMS action tracking,
 * driving the REAL services against a live Postgres with migrations applied.
 *
 * Builds a realistic firm: clients (with/without GSTIN), reviewed invoices, an
 * uploaded GSTR-2B snapshot — then exercises reconciliation -> ITC Desk roll-up
 * -> IMS sync/action, and attacks isolation and edge cases a user could hit.
 *
 * Skipped automatically when DATABASE_URL/APP_DATABASE_URL aren't set.
 */
const { Pool } = require("pg");

const ADMIN_URL = process.env.DATABASE_URL;
const APP_URL = process.env.APP_DATABASE_URL;
const describeIfDb = ADMIN_URL && APP_URL ? describe : describe.skip;

const sharedAppPool = require("../../src/db/pool");
const { withTenantTransaction } = require("../../src/db/tenant-context");
const { getItcDeskOverview } = require("../../src/services/itc-desk.service");
const ims = require("../../src/services/ims-action.service");
const { storeSnapshot } = require("../../src/services/gstr2b-source.service");

describeIfDb("ITC Desk + IMS — end to end on a live database", () => {
  let adminPool;

  const firmA = "eeee0000-0000-4000-8000-000000000001";
  const firmB = "eeee0000-0000-4000-8000-000000000002";
  const cGood = "eeee0000-0000-4000-8000-000000000101"; // has GSTIN + snapshot + invoices
  const cNoGstin = "eeee0000-0000-4000-8000-000000000102"; // no GSTIN
  const cNoData = "eeee0000-0000-4000-8000-000000000103"; // GSTIN but no snapshot
  const period = "052026";

  const asFirm = (firmId, fn) => withTenantTransaction({ firmId }, fn);

  beforeAll(async () => {
    adminPool = new Pool({ connectionString: ADMIN_URL });
    await adminPool.query(
      `INSERT INTO firms (id, name, owner_email) VALUES
        ($1,'ITC Firm A','itc-a@test.local'), ($2,'ITC Firm B','itc-b@test.local')
       ON CONFLICT (id) DO NOTHING`,
      [firmA, firmB]
    );
    await adminPool.query(
      `INSERT INTO clients (id, firm_id, name, gstin, upload_token, status) VALUES
        ($1,$4,'Good Co','27AAAAA0000A1Z5','itc_tok_good_0000000000000000000000000000000000000','active'),
        ($2,$4,'No GSTIN Co',NULL,'itc_tok_nog_00000000000000000000000000000000000000000','active'),
        ($3,$4,'No Data Co','27CCCCC0000C1Z5','itc_tok_nod_00000000000000000000000000000000000000','active')
       ON CONFLICT (id) DO NOTHING`,
      [cGood, cNoGstin, cNoData, firmA]
    );
    // Two reviewed invoices for Good Co in-period: one will match 2B, one won't.
    await adminPool.query(
      `INSERT INTO documents (id, client_id, firm_id, file_name, s3_key, doc_type, status, uploaded_at) VALUES
        ('eeee0000-0000-4000-8000-000000000201',$1,$2,'inv1.pdf','k1','invoice','reviewed','2026-05-10'),
        ('eeee0000-0000-4000-8000-000000000202',$1,$2,'inv2.pdf','k2','invoice','reviewed','2026-05-12')
       ON CONFLICT (id) DO NOTHING`,
      [cGood, firmA]
    );
    await adminPool.query(
      `INSERT INTO extractions (document_id, structured_data) VALUES
        ('eeee0000-0000-4000-8000-000000000201','{"invoice_number":"MATCH-1","vendor_gstin":"27SUPP10000S1Z5","taxable_amount":1000,"cgst":90,"sgst":90,"total_amount":1180,"invoice_date":"2026-05-10"}'::jsonb),
        ('eeee0000-0000-4000-8000-000000000202','{"invoice_number":"MISSING-1","vendor_gstin":"27SUPP20000S1Z5","taxable_amount":5000,"igst":900,"total_amount":5900,"invoice_date":"2026-05-12"}'::jsonb)
       ON CONFLICT (document_id) DO NOTHING`
    );
    // Upload a 2B snapshot containing only MATCH-1 -> MISSING-1 is not_found -> ITC at risk.
    await asFirm(firmA, (db) =>
      storeSnapshot(db, {
        firmId: firmA,
        clientId: cGood,
        period,
        source: "offline_upload",
        records: [
          {
            invoiceNumber: "MATCH-1",
            supplierGSTIN: "27SUPP10000S1Z5",
            taxableAmount: 1000,
            gstAmount: 180,
            invoiceDate: "2026-05-10",
            imsStatus: "N"
          }
        ],
        summary: { recordCount: 1, totalTaxable: 1000, totalGst: 180 },
        uploadedBy: null
      })
    );
  });

  afterAll(async () => {
    for (const f of [firmA, firmB]) {
      await adminPool.query(`DELETE FROM ims_actions WHERE firm_id=$1`, [f]);
      await adminPool.query(`DELETE FROM gstr2b_snapshots WHERE firm_id=$1`, [f]);
      await adminPool.query(
        `DELETE FROM extractions WHERE document_id IN (SELECT id FROM documents WHERE firm_id=$1)`,
        [f]
      );
      await adminPool.query(`DELETE FROM documents WHERE firm_id=$1`, [f]);
      await adminPool.query(`DELETE FROM clients WHERE firm_id=$1`, [f]);
      await adminPool.query(`DELETE FROM firms WHERE id=$1`, [f]);
    }
    await adminPool.end();
    await sharedAppPool.end();
  });

  test("ITC Desk rolls up risk, flags no-GSTIN and needs-data clients", async () => {
    const out = await asFirm(firmA, (db) => getItcDeskOverview(db, { firmId: firmA, period }));

    expect(out.totals.clients).toBe(3);
    // Good Co: MISSING-1 (igst 900) is not_found -> ITC at risk = 900.
    expect(out.totals.itcAtRisk).toBe(900);
    const good = out.clients.find((c) => c.clientName === "Good Co");
    expect(good.itcAtRisk).toBe(900);
    expect(good.exceptions).toBe(1);
    expect(out.clients.find((c) => c.clientName === "No GSTIN Co").status).toBe("no_gstin");
    expect(out.clients.find((c) => c.clientName === "No Data Co").status).toBe("needs_data");
    // Highest-risk first.
    expect(out.clients[0].clientName).toBe("Good Co");
  });

  test("ITC Desk is firm-isolated: firm B sees none of firm A's clients", async () => {
    const out = await asFirm(firmB, (db) => getItcDeskOverview(db, { firmId: firmB, period }));
    expect(out.totals.clients).toBe(0);
    expect(out.totals.itcAtRisk).toBe(0);
  });

  test("IMS sync creates one row per 2B invoice and computes deemed-accept risk", async () => {
    const out = await asFirm(firmA, (db) =>
      ims.listActions(db, { firmId: firmA, clientId: cGood, period })
    );
    // Snapshot has 1 record (MATCH-1), imsStatus N, no action yet -> deemed-accept risk = its GST.
    expect(out.summary.total).toBe(1);
    expect(out.summary.unactioned).toBe(1);
    expect(out.summary.deemedAcceptGst).toBe(180);
    expect(out.rows[0].invoiceNumber).toBe("MATCH-1");
  });

  test("recording an IMS action clears it from deemed-accept risk and persists", async () => {
    const list = await asFirm(firmA, (db) => ims.listActions(db, { firmId: firmA, clientId: cGood, period }));
    const rowId = list.rows[0].id;

    await asFirm(firmA, (db) =>
      ims.setAction(db, { firmId: firmA, clientId: cGood, actionId: rowId, action: "accept", userId: null })
    );

    const after = await asFirm(firmA, (db) => ims.listActions(db, { firmId: firmA, clientId: cGood, period }));
    expect(after.summary.accept).toBe(1);
    expect(after.summary.unactioned).toBe(0);
    expect(after.summary.deemedAcceptGst).toBe(0);
  });

  test("IMS sync is idempotent: re-listing doesn't duplicate rows", async () => {
    const a = await asFirm(firmA, (db) => ims.listActions(db, { firmId: firmA, clientId: cGood, period }));
    const b = await asFirm(firmA, (db) => ims.listActions(db, { firmId: firmA, clientId: cGood, period }));
    expect(a.summary.total).toBe(b.summary.total);
    expect(b.summary.total).toBe(1);
  });

  test("a firm cannot set an IMS action on another firm's record", async () => {
    const list = await asFirm(firmA, (db) => ims.listActions(db, { firmId: firmA, clientId: cGood, period }));
    const rowId = list.rows[0].id;
    // Firm B tries to act on firm A's row (and A's client) -> client not found under B.
    await expect(
      asFirm(firmB, (db) =>
        ims.setAction(db, { firmId: firmB, clientId: cGood, actionId: rowId, action: "reject", userId: null })
      )
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  test("IMS on a client with no snapshot returns an empty, safe result", async () => {
    const out = await asFirm(firmA, (db) => ims.listActions(db, { firmId: firmA, clientId: cNoData, period }));
    expect(out.summary.total).toBe(0);
    expect(out.summary.deemedAcceptGst).toBe(0);
  });
});
