// Mock the GSP layer so these tests exercise only the caching logic.
jest.mock("../../src/services/gsp.service", () => ({
  verifyGSTIN: jest.fn(),
  isGspEnabled: jest.fn()
}));

const gspService = require("../../src/services/gsp.service");
const {
  verifyGstinCached,
  isFresh,
  GSP_TTL_MS
} = require("../../src/services/gstin-verification.service");

const GSTIN = "27AAPFU0939F1ZV";

// A minimal fake tenant-transaction client: records queries and returns a
// programmable row for the SELECT.
const makeDb = (cachedRow) => {
  const calls = [];
  return {
    calls,
    query: jest.fn(async (sql, params) => {
      calls.push({ sql: sql.trim().split("\n")[0], params });
      if (/SELECT/i.test(sql) && /gstin_verification_cache/.test(sql)) {
        return { rowCount: cachedRow ? 1 : 0, rows: cachedRow ? [cachedRow] : [] };
      }
      return { rowCount: 0, rows: [] };
    })
  };
};

beforeEach(() => {
  jest.clearAllMocks();
  gspService.isGspEnabled.mockReturnValue(false);
});

describe("isFresh", () => {
  test("a fresh gsp row is fresh", () => {
    expect(isFresh({ source: "gsp", fetched_at: new Date().toISOString() })).toBe(true);
  });
  test("an expired gsp row is not fresh", () => {
    const old = new Date(Date.now() - GSP_TTL_MS - 1000).toISOString();
    expect(isFresh({ source: "gsp", fetched_at: old })).toBe(false);
  });
  test("a checksum row is fresh only when no GSP is configured", () => {
    gspService.isGspEnabled.mockReturnValue(false);
    expect(isFresh({ source: "local_checksum", fetched_at: new Date().toISOString() })).toBe(true);
    gspService.isGspEnabled.mockReturnValue(true);
    expect(isFresh({ source: "local_checksum", fetched_at: new Date().toISOString() })).toBe(false);
  });
});

describe("verifyGstinCached", () => {
  test("returns a fresh cached gsp result without calling the GSP", async () => {
    const db = makeDb({
      gstin: GSTIN,
      valid: true,
      legal_name: "Acme",
      trade_name: "Acme",
      registration_status: "Active",
      state_code: "27",
      source: "gsp",
      message: null,
      fetched_at: new Date().toISOString()
    });

    const result = await verifyGstinCached(db, GSTIN);

    expect(result.cached).toBe(true);
    expect(result.valid).toBe(true);
    expect(result.legalName).toBe("Acme");
    expect(gspService.verifyGSTIN).not.toHaveBeenCalled();
  });

  test("calls the GSP and writes the cache on a miss", async () => {
    const db = makeDb(null);
    gspService.verifyGSTIN.mockResolvedValue({
      valid: true,
      legalName: "Acme",
      tradeName: "Acme",
      registrationStatus: "Active",
      stateCode: "27",
      source: "gsp",
      message: null
    });

    const result = await verifyGstinCached(db, GSTIN);

    expect(gspService.verifyGSTIN).toHaveBeenCalledWith(GSTIN);
    expect(result.cached).toBe(false);
    expect(result.valid).toBe(true);
    // An INSERT ... ON CONFLICT write was attempted.
    expect(db.calls.some((c) => /INSERT INTO gstin_verification_cache/i.test(c.sql))).toBe(true);
  });

  test("forceRefresh bypasses a fresh cache row", async () => {
    const db = makeDb({
      gstin: GSTIN,
      valid: true,
      source: "gsp",
      fetched_at: new Date().toISOString()
    });
    gspService.verifyGSTIN.mockResolvedValue({ valid: true, source: "gsp" });

    await verifyGstinCached(db, GSTIN, { forceRefresh: true });

    expect(gspService.verifyGSTIN).toHaveBeenCalled();
  });

  test("re-verifies a checksum-only cache row once a GSP is enabled", async () => {
    gspService.isGspEnabled.mockReturnValue(true);
    const db = makeDb({
      gstin: GSTIN,
      valid: true,
      source: "local_checksum",
      fetched_at: new Date().toISOString()
    });
    gspService.verifyGSTIN.mockResolvedValue({ valid: true, source: "gsp" });

    const result = await verifyGstinCached(db, GSTIN);

    expect(gspService.verifyGSTIN).toHaveBeenCalled();
    expect(result.cached).toBe(false);
  });

  test("normalises whitespace and case before lookup", async () => {
    const db = makeDb(null);
    gspService.verifyGSTIN.mockResolvedValue({ valid: true, source: "local_fallback" });

    await verifyGstinCached(db, " 27aapfu0939f1zv ");

    expect(gspService.verifyGSTIN).toHaveBeenCalledWith(GSTIN);
  });

  test("a cache write failure does not fail verification", async () => {
    const db = {
      query: jest.fn(async (sql) => {
        if (/SELECT/i.test(sql)) return { rowCount: 0, rows: [] };
        throw new Error("db write exploded");
      })
    };
    gspService.verifyGSTIN.mockResolvedValue({ valid: true, source: "gsp" });

    const result = await verifyGstinCached(db, GSTIN);

    expect(result.valid).toBe(true);
    expect(result.cached).toBe(false);
  });
});
