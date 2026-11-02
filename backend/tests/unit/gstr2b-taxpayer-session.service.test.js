// Taxpayer session service. The Sandbox adapter and secret-box are real where
// cheap (secret-box round-trips in-process); the GSP network calls are mocked.

process.env.GSP_TOKEN_ENCRYPTION_KEY =
  process.env.GSP_TOKEN_ENCRYPTION_KEY || "a".repeat(64); // 32 bytes hex

jest.mock("../../src/services/sandbox-gsp.service", () => ({
  requestTaxpayerOtp: jest.fn(),
  verifyTaxpayerOtp: jest.fn(),
  refreshTaxpayerSession: jest.fn()
}));

const sandbox = require("../../src/services/sandbox-gsp.service");
const secretBox = require("../../src/utils/secret-box");
const session = require("../../src/services/gstr2b-taxpayer-session.service");

const FIRM = "firm-1";
const CLIENT = "client-1";
const GSTIN = "27AAPFU0939F1ZV";

// A programmable fake tenant-tx client. `rows` lets a test preload the current
// session row returned by the service's SELECTs.
const makeDb = ({ client, sessionRow } = {}) => {
  const calls = [];
  return {
    calls,
    query: jest.fn(async (sql, params) => {
      calls.push({ sql: sql.trim().split("\n")[0], params });
      if (/FROM clients/i.test(sql)) {
        return {
          rowCount: client ? 1 : 0,
          rows: client ? [client] : []
        };
      }
      if (/FROM gstr2b_taxpayer_sessions/i.test(sql)) {
        return { rowCount: sessionRow ? 1 : 0, rows: sessionRow ? [sessionRow] : [] };
      }
      return { rowCount: 0, rows: [] };
    })
  };
};

beforeEach(() => {
  jest.clearAllMocks();
  secretBox._resetKeyCache();
});

describe("requestOtp", () => {
  test("sends an OTP using the stored gst_username", async () => {
    const db = makeDb({ client: { id: CLIENT, gstin: GSTIN, gst_username: "acme@x.com" } });
    sandbox.requestTaxpayerOtp.mockResolvedValue({ ok: true });
    const out = await session.requestOtp(db, { firmId: FIRM, clientId: CLIENT });
    expect(sandbox.requestTaxpayerOtp).toHaveBeenCalledWith({ username: "acme@x.com", gstin: GSTIN });
    expect(out.status).toBe("otp_sent");
  });

  test("rejects when the client has no GSTIN", async () => {
    const db = makeDb({ client: { id: CLIENT, gstin: null, gst_username: "acme@x.com" } });
    await expect(session.requestOtp(db, { firmId: FIRM, clientId: CLIENT })).rejects.toThrow(/GSTIN/);
  });

  test("rejects when no gst_username is available", async () => {
    const db = makeDb({ client: { id: CLIENT, gstin: GSTIN, gst_username: null } });
    await expect(session.requestOtp(db, { firmId: FIRM, clientId: CLIENT })).rejects.toThrow(/username/i);
  });
});

describe("verifyOtp", () => {
  test("stores the taxpayer token ENCRYPTED (never plaintext)", async () => {
    const db = makeDb({ client: { id: CLIENT, gstin: GSTIN, gst_username: "acme@x.com" } });
    sandbox.verifyTaxpayerOtp.mockResolvedValue({
      taxpayerToken: "plain-taxpayer-token",
      tokenExpiry: Date.now() + 6 * 3600 * 1000,
      sessionExpiry: Date.now() + 12 * 3600 * 1000
    });

    await session.verifyOtp(db, { firmId: FIRM, clientId: CLIENT, userId: "u1", otp: "123456" });

    const insert = db.calls.find((c) => /INSERT INTO gstr2b_taxpayer_sessions/i.test(c.sql));
    expect(insert).toBeTruthy();
    const stored = insert.params[3];
    expect(stored).toMatch(/^v1:/); // encrypted envelope
    expect(stored).not.toContain("plain-taxpayer-token");
    expect(secretBox.decrypt(stored)).toBe("plain-taxpayer-token");
  });
});

describe("getUsableToken", () => {
  const encFor = (t) => secretBox.encrypt(t);

  test("returns the decrypted token when healthy and far from expiry", async () => {
    const db = makeDb({
      sessionRow: {
        id: "s1",
        gstin: GSTIN,
        token_encrypted: encFor("live-token"),
        status: "active",
        token_expiry: new Date(Date.now() + 5 * 3600 * 1000),
        session_expiry: new Date(Date.now() + 10 * 3600 * 1000)
      }
    });
    const out = await session.getUsableToken(db, { firmId: FIRM, clientId: CLIENT });
    expect(out.token).toBe("live-token");
    expect(sandbox.refreshTaxpayerSession).not.toHaveBeenCalled();
  });

  test("refreshes transparently when the token is near expiry", async () => {
    const db = makeDb({
      sessionRow: {
        id: "s1",
        gstin: GSTIN,
        token_encrypted: encFor("old-token"),
        status: "active",
        token_expiry: new Date(Date.now() + 60 * 1000), // within skew
        session_expiry: new Date(Date.now() + 10 * 3600 * 1000)
      }
    });
    sandbox.refreshTaxpayerSession.mockResolvedValue({
      taxpayerToken: "fresh-token",
      tokenExpiry: Date.now() + 6 * 3600 * 1000,
      sessionExpiry: Date.now() + 10 * 3600 * 1000
    });
    const out = await session.getUsableToken(db, { firmId: FIRM, clientId: CLIENT });
    expect(sandbox.refreshTaxpayerSession).toHaveBeenCalled();
    expect(out.token).toBe("fresh-token");
  });

  test("asks for re-auth when there is no session", async () => {
    const db = makeDb({ sessionRow: null });
    await expect(session.getUsableToken(db, { firmId: FIRM, clientId: CLIENT })).rejects.toThrow(/OTP/);
  });

  test("asks for re-auth when the portal session has expired", async () => {
    const db = makeDb({
      sessionRow: {
        id: "s1",
        gstin: GSTIN,
        token_encrypted: encFor("x"),
        status: "active",
        token_expiry: new Date(Date.now() - 1000),
        session_expiry: new Date(Date.now() - 1000)
      }
    });
    await expect(session.getUsableToken(db, { firmId: FIRM, clientId: CLIENT })).rejects.toThrow(/expired|OTP/i);
  });

  test("marks expired + asks for re-auth when refresh fails", async () => {
    const db = makeDb({
      sessionRow: {
        id: "s1",
        gstin: GSTIN,
        token_encrypted: encFor("old"),
        status: "active",
        token_expiry: new Date(Date.now() + 60 * 1000),
        session_expiry: new Date(Date.now() + 10 * 3600 * 1000)
      }
    });
    sandbox.refreshTaxpayerSession.mockRejectedValue(new Error("session cap reached"));
    await expect(session.getUsableToken(db, { firmId: FIRM, clientId: CLIENT })).rejects.toThrow(/reconnect|OTP/i);
    expect(db.calls.some((c) => /status='expired'/i.test(c.sql))).toBe(true);
  });
});
