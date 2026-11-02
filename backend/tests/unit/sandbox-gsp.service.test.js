// Sandbox GSP client. Auth/OTP/fetch are tested with a mocked global.fetch;
// extractRecords is tested against the real response shape captured from
// Sandbox's live docs.

const ORIGINAL_ENV = { ...process.env };

const baseEnv = () => ({
  ...ORIGINAL_ENV,
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://ci:ci@localhost:5432/ci",
  REDIS_URL: "redis://localhost:6379",
  AI_SERVICE_URL: "http://localhost:8001",
  JWT_SECRET: "ci-only-placeholder-secret-not-a-real-secret-32",
  JWT_REFRESH_SECRET: "ci-only-placeholder-refresh-secret-not-real-32",
  CLIENT_JWT_SECRET: "ci-only-placeholder-client-secret-not-real-32",
  FRONTEND_URL: "http://localhost:5173",
  LOCAL_STORAGE: "true",
  SANDBOX_API_KEY: "key_test_xxx",
  SANDBOX_API_SECRET: "secret_test_xxx"
});

const load = (extra) => {
  jest.resetModules();
  process.env = { ...baseEnv(), ...extra };
  return require("../../src/services/sandbox-gsp.service");
};

const jsonResponse = (body, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => body
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  jest.resetModules();
  delete global.fetch;
});

describe("getAppToken", () => {
  test("throws not_configured when key/secret are missing", async () => {
    const svc = load({ SANDBOX_API_KEY: "", SANDBOX_API_SECRET: "" });
    await expect(svc.getAppToken()).rejects.toMatchObject({ code: "not_configured" });
  });

  test("authenticates and caches the JWT across calls", async () => {
    const svc = load();
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({ code: 200, data: { access_token: "jwt-abc" } })
    );
    const t1 = await svc.getAppToken();
    const t2 = await svc.getAppToken();
    expect(t1).toBe("jwt-abc");
    expect(t2).toBe("jwt-abc");
    expect(global.fetch).toHaveBeenCalledTimes(1); // cached second time

    // The auth call sends key+secret in headers, no Bearer anywhere.
    const [, opts] = global.fetch.mock.calls[0];
    expect(opts.headers["x-api-key"]).toBe("key_test_xxx");
    expect(opts.headers["x-api-secret"]).toBe("secret_test_xxx");
  });

  test("throws SandboxError on a failed authenticate", async () => {
    const svc = load();
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ code: 401 }, false, 401));
    await expect(svc.getAppToken()).rejects.toMatchObject({ name: "SandboxError", statusCode: 401 });
  });
});

describe("taxpayer OTP flow", () => {
  test("verifyTaxpayerOtp returns the taxpayer token + expiries", async () => {
    const svc = load();
    global.fetch = jest
      .fn()
      // getAppToken
      .mockResolvedValueOnce(jsonResponse({ code: 200, data: { access_token: "jwt-abc" } }))
      // verify
      .mockResolvedValueOnce(
        jsonResponse({
          code: 200,
          data: { access_token: "taxpayer-xyz", session_expiry: 123, token_expiry: 456 }
        })
      );
    const result = await svc.verifyTaxpayerOtp({ username: "acme", gstin: "27AAPFU0939F1ZV", otp: "575757" });
    expect(result.taxpayerToken).toBe("taxpayer-xyz");
    expect(result.tokenExpiry).toBe(456);
    // The authorization header on the verify call is the app JWT, no Bearer.
    const [, verifyOpts] = global.fetch.mock.calls[1];
    expect(verifyOpts.headers.authorization).toBe("jwt-abc");
  });

  test("requestTaxpayerOtp surfaces a GSTN error message on failure", async () => {
    const svc = load();
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ code: 200, data: { access_token: "jwt-abc" } }))
      .mockResolvedValueOnce(jsonResponse({ code: 400, data: { message: "GSTIN not opted in" } }, false, 400));
    await expect(
      svc.requestTaxpayerOtp({ username: "acme", gstin: "27AAPFU0939F1ZV" })
    ).rejects.toThrow(/opted in/i);
  });
});

describe("extractRecords (real Sandbox GSTR-2B shape)", () => {
  // Minimal slice of the structure captured from Sandbox's live docs.
  const payload = {
    data: {
      data: {
        data: {
          docdata: {
            b2b: [
              {
                ctin: "24AAWFG9936H1ZP",
                trdnm: "GOURMESSERIE LLP",
                inv: [
                  {
                    inum: "PRN-1289",
                    dt: "29-11-2024",
                    txval: 1694.92,
                    cgst: 152.54,
                    sgst: 152.54,
                    igst: 0,
                    cess: 0,
                    imsStatus: "N",
                    itcavl: "Y"
                  }
                ]
              },
              {
                ctin: "29AAICP2912R1ZR",
                trdnm: "CASHFREE PAYMENTS INDIA PRIVATE LIMITED",
                inv: [
                  {
                    inum: "CF/24-25/62727",
                    dt: "30-11-2024",
                    txval: 726792.4,
                    cgst: 0,
                    sgst: 0,
                    igst: 130822.64,
                    cess: 0,
                    imsStatus: "N",
                    itcavl: "Y"
                  }
                ]
              }
            ]
          }
        }
      }
    }
  };

  test("normalises B2B invoices with summed GST, carrying IMS + ITC flags", () => {
    const svc = load();
    const records = svc.extractRecords(payload);
    expect(records).toHaveLength(2);

    const [intra, inter] = records;
    expect(intra.invoiceNumber).toBe("PRN-1289");
    expect(intra.supplierGSTIN).toBe("24AAWFG9936H1ZP");
    expect(intra.taxableAmount).toBe(1694.92);
    expect(intra.gstAmount).toBeCloseTo(305.08, 2); // cgst+sgst
    expect(intra.imsStatus).toBe("N");
    expect(intra.itcAvailable).toBe(true);

    expect(inter.invoiceNumber).toBe("CF/24-25/62727");
    expect(inter.gstAmount).toBeCloseTo(130822.64, 2); // igst
  });

  test("returns [] for an empty / unexpected envelope without throwing", () => {
    const svc = load();
    expect(svc.extractRecords({})).toEqual([]);
    expect(svc.extractRecords({ data: { data: { data: { docdata: {} } } } })).toEqual([]);
  });
});
