jest.mock("../../src/services/gstr2b-source.service", () => ({
  getLatestSnapshot: jest.fn()
}));

const { getLatestSnapshot } = require("../../src/services/gstr2b-source.service");
const ims = require("../../src/services/ims-action.service");

const FIRM = "firm-1";
const CLIENT = "client-1";

// Fake db: clients lookup always finds the client; captures writes; serves a
// programmable row set back for the SELECT in listActions.
const makeDb = (imsRows = []) => {
  const writes = [];
  return {
    writes,
    query: jest.fn(async (sql, params) => {
      if (/FROM clients/i.test(sql)) return { rowCount: 1, rows: [{ id: CLIENT }] };
      if (/INSERT INTO ims_actions/i.test(sql)) {
        writes.push(params);
        return { rowCount: 1, rows: [] };
      }
      if (/SELECT[\s\S]*FROM ims_actions/i.test(sql)) {
        return { rowCount: imsRows.length, rows: imsRows };
      }
      if (/UPDATE ims_actions/i.test(sql)) {
        return { rowCount: 1, rows: [{ id: params[0], action: params[3] }] };
      }
      return { rowCount: 0, rows: [] };
    })
  };
};

beforeEach(() => jest.clearAllMocks());

describe("syncFromSnapshot", () => {
  test("upserts a row per 2B invoice that has both gstin and invoice number", async () => {
    getLatestSnapshot.mockResolvedValue({
      records: [
        { supplierGSTIN: "27AAAAA0000A1Z5", invoiceNumber: "INV1", gstAmount: 100, imsStatus: "N" },
        { supplierGSTIN: "27BBBBB0000B1Z5", invoiceNumber: "INV2", gstAmount: 200, imsStatus: "A" },
        { supplierGSTIN: "", invoiceNumber: "NOGSTIN", gstAmount: 9 } // skipped
      ]
    });
    const db = makeDb();
    const out = await ims.syncFromSnapshot(db, { firmId: FIRM, clientId: CLIENT, period: "052026" });
    expect(out.synced).toBe(2);
    expect(db.writes).toHaveLength(2);
  });

  test("no snapshot -> synced 0, hasSnapshot false", async () => {
    getLatestSnapshot.mockResolvedValue(null);
    const out = await ims.syncFromSnapshot(makeDb(), { firmId: FIRM, clientId: CLIENT, period: "052026" });
    expect(out).toEqual({ synced: 0, hasSnapshot: false });
  });

  test("rejects a malformed period", async () => {
    await expect(
      ims.syncFromSnapshot(makeDb(), { firmId: FIRM, clientId: CLIENT, period: "13-2026" })
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("listActions — deemed-accept risk", () => {
  test("counts unactioned, not-yet-accepted GST as deemed-accept risk", async () => {
    getLatestSnapshot.mockResolvedValue({ records: [] }); // sync no-op
    const db = makeDb([
      { id: "a1", supplier_gstin: "27A", invoice_number: "I1", ims_status: "N", action: "none", gst_amount: "100", note: null, acted_at: null },
      { id: "a2", supplier_gstin: "27B", invoice_number: "I2", ims_status: "A", action: "none", gst_amount: "200", note: null, acted_at: null }, // already accepted at GSTN -> not risk
      { id: "a3", supplier_gstin: "27C", invoice_number: "I3", ims_status: "N", action: "accept", gst_amount: "50", note: null, acted_at: null } // acted -> not risk
    ]);
    const out = await ims.listActions(db, { firmId: FIRM, clientId: CLIENT, period: "052026" });
    expect(out.summary.total).toBe(3);
    expect(out.summary.unactioned).toBe(1); // only a1
    expect(out.summary.deemedAcceptGst).toBe(100);
    expect(out.summary.accept).toBe(1);
  });
});

describe("setAction", () => {
  test("rejects an invalid action verb", async () => {
    await expect(
      ims.setAction(makeDb(), { firmId: FIRM, clientId: CLIENT, actionId: "x", action: "yolo" })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test("records a valid action", async () => {
    const out = await ims.setAction(makeDb(), {
      firmId: FIRM,
      clientId: CLIENT,
      actionId: "a1",
      action: "reject",
      note: "duplicate",
      userId: "u1"
    });
    expect(out.action).toBe("reject");
  });
});
