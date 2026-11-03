// The ITC Desk runs the real reconciliation + matching logic in memory over a
// fake database: three firm-wide queries, whatever the number of clients.
jest.mock("../../src/services/sandbox-gsp.service", () => ({
  fetchGstr2b: jest.fn(() => {
    throw new Error("the ITC Desk must never pull GSTR-2B live");
  }),
  isSandboxConfigured: () => true
}));
jest.mock("../../src/services/gsp.service", () => ({
  fetchGstr2bRecords: jest.fn(() => {
    throw new Error("the ITC Desk must never pull GSTR-2B live");
  })
}));

const { getItcDeskOverview, sec16DeadlineForPeriod } = require("../../src/services/itc-desk.service");

const FIRM = "firm-1";

const invoiceDoc = (id, clientId, { inv, gstin = "27AABCS0001K1Z1", taxable = 1000, gst = 180, date = "2026-05-10" }) => ({
  id,
  client_id: clientId,
  doc_type: "invoice",
  structured_data: {
    invoice_number: inv,
    vendor_gstin: gstin,
    taxable_amount: taxable,
    cgst: gst / 2,
    sgst: gst / 2,
    invoice_date: date
  }
});

const twoB = (inv, { gstin = "27AABCS0001K1Z1", taxable = 1000, gst = 180, date = "2026-05-10" } = {}) => ({
  invoiceNumber: inv,
  supplierGSTIN: gstin,
  taxableAmount: taxable,
  gstAmount: gst,
  invoiceDate: date
});

const makeDb = ({ clients = [], documents = [], snapshots = [] }) => {
  const calls = [];
  return {
    calls,
    query: jest.fn(async (sql) => {
      calls.push(sql);
      if (/FROM clients/i.test(sql)) return { rowCount: clients.length, rows: clients };
      if (/FROM documents d/i.test(sql)) return { rowCount: documents.length, rows: documents };
      if (/FROM gstr2b_snapshots/i.test(sql)) return { rowCount: snapshots.length, rows: snapshots };
      throw new Error(`unexpected query: ${sql.slice(0, 80)}`);
    })
  };
};

describe("sec16DeadlineForPeriod", () => {
  test("Apr–Dec maps to the FY starting that April, deadline next Nov 30", () => {
    expect(sec16DeadlineForPeriod("052025").financialYear).toBe("2025-26");
    expect(sec16DeadlineForPeriod("052025").deadline.slice(0, 10)).toBe("2026-11-30");
  });
  test("Jan–Mar maps to the FY that began the previous April", () => {
    expect(sec16DeadlineForPeriod("012026").financialYear).toBe("2025-26");
    expect(sec16DeadlineForPeriod("012026").deadline.slice(0, 10)).toBe("2026-11-30");
  });
});

describe("getItcDeskOverview", () => {
  test("rejects a malformed period", async () => {
    await expect(getItcDeskOverview(makeDb({}), { firmId: FIRM, period: "2026" })).rejects.toMatchObject({
      statusCode: 400
    });
  });

  test("aggregates ITC at risk from real matching and sorts clients highest-first", async () => {
    const db = makeDb({
      clients: [
        { id: "c1", name: "Alpha", gstin: "27AAAAA0000A1Z5" },
        { id: "c2", name: "Bravo", gstin: "27BBBBB0000B1Z5" }
      ],
      documents: [
        invoiceDoc("d1", "c1", { inv: "A-1" }),
        invoiceDoc("d2", "c1", { inv: "A-2", gst: 90, taxable: 500 }), // missing from 2B → at risk 90
        invoiceDoc("d3", "c2", { inv: "B-1", gst: 360, taxable: 2000 }), // amount mismatch → at risk 360
        invoiceDoc("d4", "c2", { inv: "B-2", gst: 540, taxable: 3000 }) // missing → at risk 540
      ],
      snapshots: [
        { client_id: "c1", source: "offline_upload", records: [twoB("A-1")] },
        { client_id: "c2", source: "offline_upload", records: [twoB("B-1", { taxable: 1500, gst: 270 })] }
      ]
    });

    const out = await getItcDeskOverview(db, { firmId: FIRM, period: "052026" });

    expect(out.clients.map((c) => [c.clientName, c.itcAtRisk, c.exceptions])).toEqual([
      ["Bravo", 900, 2],
      ["Alpha", 90, 1]
    ]);
    expect(out.totals).toMatchObject({ itcAtRisk: 990, clientsAtRisk: 2, reconciled: 2 });
  });

  test("an invoice outside the period is ignored even though it was read", async () => {
    const db = makeDb({
      clients: [{ id: "c1", name: "Alpha", gstin: "27AAAAA0000A1Z5" }],
      documents: [invoiceDoc("d1", "c1", { inv: "A-1", date: "2026-06-01" })],
      snapshots: [{ client_id: "c1", source: "offline_upload", records: [] }]
    });
    const out = await getItcDeskOverview(db, { firmId: FIRM, period: "052026" });
    expect(out.clients[0]).toMatchObject({ invoiceCount: 0, itcAtRisk: 0 });
  });

  test("a client with no GSTIN is flagged, not counted as clean zero-risk", async () => {
    const out = await getItcDeskOverview(makeDb({ clients: [{ id: "c1", name: "NoGst", gstin: null }] }), {
      firmId: FIRM,
      period: "052026"
    });
    expect(out.clients[0].status).toBe("no_gstin");
    expect(out.totals.noGstin).toBe(1);
  });

  test("marks needs_data — never a live GSP pull — when there is no saved GSTR-2B", async () => {
    const db = makeDb({
      clients: [{ id: "c1", name: "Pending", gstin: "27AAAAA0000A1Z5" }],
      documents: [invoiceDoc("d1", "c1", { inv: "A-1" })]
    });
    const out = await getItcDeskOverview(db, { firmId: FIRM, period: "052026" });
    expect(out.clients[0]).toMatchObject({ status: "needs_data", source: "unavailable", itcAtRisk: 0 });
    expect(out.totals.needsData).toBe(1);
  });

  test("a client whose saved 2B is corrupt is isolated as an error row", async () => {
    const db = makeDb({
      clients: [
        { id: "c1", name: "Good", gstin: "27AAAAA0000A1Z5" },
        { id: "c2", name: "Bad", gstin: "27BBBBB0000B1Z5" }
      ],
      documents: [invoiceDoc("d1", "c1", { inv: "A-1", gst: 200 }), invoiceDoc("d2", "c2", { inv: "B-1" })],
      snapshots: [
        { client_id: "c1", source: "offline_upload", records: [] },
        { client_id: "c2", source: "offline_upload", records: { not: "an array" } }
      ]
    });
    const out = await getItcDeskOverview(db, { firmId: FIRM, period: "052026" });
    expect(out.clients.find((c) => c.clientName === "Bad").status).toBe("error");
    expect(out.totals).toMatchObject({ errors: 1, itcAtRisk: 200 });
  });

  test("uses the same three queries for 1 client or 500", async () => {
    const many = Array.from({ length: 500 }, (_, i) => ({ id: `c${i}`, name: `C${i}`, gstin: "27AAAAA0000A1Z5" }));
    const db = makeDb({ clients: many });
    await getItcDeskOverview(db, { firmId: FIRM, period: "052026" });
    expect(db.calls).toHaveLength(3);
  });
});
