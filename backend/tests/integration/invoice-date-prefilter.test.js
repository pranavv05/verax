/**
 * documents.invoice_date is a pre-filter for GST reconciliation and the ITC
 * Desk: it lets them read one period's invoices instead of a firm's whole
 * history. It must never change what reconciles, so these tests write through
 * the least-privilege app role (RLS on, like production) and check:
 *   - the trigger keeps the column in step with the extraction (insert, edit,
 *     key precedence), never failing a write on a bad date;
 *   - invoices whose date the column can't read (non-ISO, impossible, missing)
 *     still reach the exact JS filter and reconcile as before;
 *   - out-of-window invoices are not read at all.
 *
 * Skipped automatically when DATABASE_URL/APP_DATABASE_URL aren't set.
 */
const { Pool } = require("pg");

const ADMIN_URL = process.env.DATABASE_URL;
const APP_URL = process.env.APP_DATABASE_URL;
const describeIfDb = ADMIN_URL && APP_URL ? describe : describe.skip;

const sharedAppPool = require("../../src/db/pool");
const { withTenantTransaction } = require("../../src/db/tenant-context");
const {
  getPeriodWindow,
  loadPeriodInvoiceDocuments,
  toPeriodDocuments
} = require("../../src/services/reconciliation.service");

describeIfDb("documents.invoice_date pre-filter — live database, app role", () => {
  let adminPool;
  const firm = "dddd0000-0000-4000-8000-000000000001";
  const client = "dddd0000-0000-4000-8000-000000000101";
  const docId = (n) => `dddd0000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const asFirm = (fn) => withTenantTransaction({ firmId: firm }, fn);

  const addInvoice = (n, structuredData) =>
    asFirm(async (db) => {
      await db.query(
        `INSERT INTO documents (id, client_id, firm_id, file_name, s3_key, doc_type, status)
         VALUES ($1, $2, $3, $4, $5, 'invoice', 'reviewed')`,
        [docId(n), client, firm, `inv-${n}.pdf`, `prefilter/inv-${n}.pdf`]
      );
      await db.query(`INSERT INTO extractions (document_id, structured_data) VALUES ($1, $2::jsonb)`, [
        docId(n),
        JSON.stringify({ vendor_gstin: "27SUPP10000S1Z5", taxable_amount: 1000, cgst: 90, sgst: 90, ...structuredData })
      ]);
    });

  const storedDate = async (n) => {
    const r = await adminPool.query(`SELECT to_char(invoice_date, 'YYYY-MM-DD') AS d FROM documents WHERE id = $1`, [
      docId(n)
    ]);
    return r.rows[0].d;
  };

  beforeAll(async () => {
    adminPool = new Pool({ connectionString: ADMIN_URL });
    await adminPool.query(
      `INSERT INTO firms (id, name, owner_email) VALUES ($1, 'Prefilter Firm', 'prefilter@test.local')
       ON CONFLICT (id) DO NOTHING`,
      [firm]
    );
    await adminPool.query(
      `INSERT INTO clients (id, firm_id, name, gstin, upload_token, status)
       VALUES ($1, $2, 'Prefilter Co', '27AAAAA0000A1Z5', 'pf_tok_0000000000000000000000000000000000000000000', 'active')
       ON CONFLICT (id) DO NOTHING`,
      [client, firm]
    );

    await addInvoice(1, { invoice_number: "IN-MAY", invoice_date: "2026-05-10" });
    await addInvoice(2, { invoice_number: "OLD", invoice_date: "2024-01-15" });
    await addInvoice(3, { invoice_number: "CAMEL", invoiceDate: "2026-05-20" });
    await addInvoice(4, { invoice_number: "PRECEDENCE", invoice_date: "", date: "2026-05-03", document_date: "2025-01-01" });
    await addInvoice(5, { invoice_number: "IMPOSSIBLE", invoice_date: "2026-02-30" });
    await addInvoice(6, { invoice_number: "SLASHED", invoice_date: "May 10, 2026" });
    await addInvoice(7, { invoice_number: "NODATE" });
    await addInvoice(8, { invoice_number: "EDGE-OFFSET", invoice_date: "2026-06-01T02:00:00+05:30" });
  });

  afterAll(async () => {
    await adminPool.query(`DELETE FROM extractions WHERE document_id IN (SELECT id FROM documents WHERE firm_id = $1)`, [
      firm
    ]);
    await adminPool.query(`DELETE FROM documents WHERE firm_id = $1`, [firm]);
    await adminPool.query(`DELETE FROM clients WHERE firm_id = $1`, [firm]);
    await adminPool.query(`DELETE FROM firms WHERE id = $1`, [firm]);
    await adminPool.end();
    await sharedAppPool.end();
  });

  test("the trigger stores the extraction's ISO date, with the same key precedence as reconciliation", async () => {
    expect(await storedDate(1)).toBe("2026-05-10");
    expect(await storedDate(2)).toBe("2024-01-15");
    expect(await storedDate(3)).toBe("2026-05-20");
    expect(await storedDate(4)).toBe("2026-05-03"); // empty invoice_date falls through to date
    expect(await storedDate(8)).toBe("2026-06-01");
  });

  test("unreadable dates are NULL, and never fail the extraction write", async () => {
    expect(await storedDate(5)).toBeNull();
    expect(await storedDate(6)).toBeNull();
    expect(await storedDate(7)).toBeNull();
  });

  test("editing the extraction (as a reviewer would) moves the date", async () => {
    await asFirm((db) =>
      db.query(
        `UPDATE extractions SET structured_data = structured_data || '{"invoice_date":"2025-12-31"}'::jsonb
         WHERE document_id = $1`,
        [docId(3)]
      )
    );
    expect(await storedDate(3)).toBe("2025-12-31");
    await asFirm((db) =>
      db.query(
        `UPDATE extractions SET structured_data = structured_data - 'invoice_date' WHERE document_id = $1`,
        [docId(3)]
      )
    );
    expect(await storedDate(3)).toBe("2026-05-20"); // back to invoiceDate
  });

  test("May 2026 reads in-window and undated invoices, skips old ones, and reconciles exactly as before", async () => {
    const window = getPeriodWindow("052026");
    const rows = await asFirm((db) => loadPeriodInvoiceDocuments(db, { firmId: firm, clientId: client, ...window }));
    const read = rows.map((r) => r.structured_data.invoice_number).sort();

    // OLD (2024) is never read. Undated / unparseable ones are read and left to JS.
    expect(read).not.toContain("OLD");
    expect(read).toEqual(
      expect.arrayContaining(["IN-MAY", "CAMEL", "PRECEDENCE", "IMPOSSIBLE", "SLASHED", "NODATE", "EDGE-OFFSET"])
    );

    // The exact period cut is unchanged JS: "May 10, 2026" parses and counts,
    // the June-1-IST invoice (May 31 UTC) counts as before, garbage doesn't.
    const inPeriod = toPeriodDocuments(rows, window)
      .map((d) => d.invoice.invoiceNumber)
      .sort();
    expect(inPeriod).toEqual(["CAMEL", "EDGE-OFFSET", "IN-MAY", "PRECEDENCE", "SLASHED"]);
  });

  test("another firm reads none of these through the pre-filter", async () => {
    const other = "dddd0000-0000-4000-8000-0000000000ff";
    const window = getPeriodWindow("052026");
    const rows = await withTenantTransaction({ firmId: other }, (db) =>
      loadPeriodInvoiceDocuments(db, { firmId: firm, clientId: null, ...window })
    );
    expect(rows).toHaveLength(0);
  });
});
