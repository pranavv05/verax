jest.mock("../../src/services/reconciliation.service", () => ({
  getReconciliationData: jest.fn()
}));

const { getReconciliationData } = require("../../src/services/reconciliation.service");
const { getItcDeskOverview, sec16DeadlineForPeriod } = require("../../src/services/itc-desk.service");

const FIRM = "firm-1";

const makeDb = (clients) => ({
  query: jest.fn(async (sql) => {
    if (/FROM clients/i.test(sql)) return { rowCount: clients.length, rows: clients };
    return { rowCount: 0, rows: [] };
  })
});

const recon = (itcAtRisk, { total = 0, notFound = 0, mismatched = 0, partial = 0, source = "offline_upload" } = {}) => ({
  summary: { itcAtRisk, total, notFound, mismatched, partial, totalGstAmount: itcAtRisk },
  source
});

beforeEach(() => jest.clearAllMocks());

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
    await expect(getItcDeskOverview(makeDb([]), { firmId: FIRM, period: "2026" })).rejects.toMatchObject({
      statusCode: 400
    });
  });

  test("aggregates ITC at risk and sorts clients highest-first", async () => {
    const db = makeDb([
      { id: "c1", name: "Alpha", gstin: "27AAAAA0000A1Z5" },
      { id: "c2", name: "Bravo", gstin: "27BBBBB0000B1Z5" }
    ]);
    getReconciliationData
      .mockResolvedValueOnce(recon(100, { total: 10, notFound: 1 }))
      .mockResolvedValueOnce(recon(5000, { total: 20, mismatched: 2, partial: 1 }));

    const out = await getItcDeskOverview(db, { firmId: FIRM, period: "052026" });

    expect(out.totals.itcAtRisk).toBe(5100);
    expect(out.totals.clientsAtRisk).toBe(2);
    expect(out.clients[0].clientName).toBe("Bravo"); // higher risk first
    expect(out.clients[0].exceptions).toBe(3);
    expect(out.clients[1].clientName).toBe("Alpha");
  });

  test("a client with no GSTIN is flagged, not counted as clean zero-risk", async () => {
    const db = makeDb([{ id: "c1", name: "NoGst", gstin: null }]);
    const out = await getItcDeskOverview(db, { firmId: FIRM, period: "052026" });
    expect(getReconciliationData).not.toHaveBeenCalled();
    expect(out.clients[0].status).toBe("no_gstin");
    expect(out.totals.noGstin).toBe(1);
  });

  test("a client whose reconciliation throws is isolated as an error row", async () => {
    const db = makeDb([
      { id: "c1", name: "Good", gstin: "27AAAAA0000A1Z5" },
      { id: "c2", name: "Bad", gstin: "27BBBBB0000B1Z5" }
    ]);
    getReconciliationData
      .mockResolvedValueOnce(recon(200, { total: 5, notFound: 1 }))
      .mockRejectedValueOnce(new Error("boom"));

    const out = await getItcDeskOverview(db, { firmId: FIRM, period: "052026" });
    const bad = out.clients.find((c) => c.clientName === "Bad");
    expect(bad.status).toBe("error");
    expect(out.totals.errors).toBe(1);
    // The good client still aggregates.
    expect(out.totals.itcAtRisk).toBe(200);
  });

  test("marks needs_data when a client has a GSTIN but no 2B source", async () => {
    const db = makeDb([{ id: "c1", name: "Pending", gstin: "27AAAAA0000A1Z5" }]);
    getReconciliationData.mockResolvedValueOnce(recon(0, { total: 0, source: "unavailable" }));
    const out = await getItcDeskOverview(db, { firmId: FIRM, period: "052026" });
    expect(out.clients[0].status).toBe("needs_data");
    expect(out.totals.needsData).toBe(1);
  });
});
