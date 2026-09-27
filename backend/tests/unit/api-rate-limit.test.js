// Pins down the API and upload rate limits that month-end traffic depends on:
// staff share an office IP and a firm, so budgets must be per user; clients
// upload a month's paperwork in one sitting, and one file is two requests.
process.env.TRUST_PROXY = "1";

jest.mock("../../src/db/pool", () => ({
  query: jest.fn(),
  on: jest.fn()
}));
jest.mock("../../src/services/document-queue.service", () => ({
  checkRedisHealth: jest.fn(),
  enqueueDocumentProcessingJob: jest.fn()
}));
jest.mock("../../src/services/auth.service", () => ({
  ...jest.requireActual("../../src/services/auth.service"),
  validateMagicToken: jest.fn()
}));

const express = require("express");
const request = require("supertest");
const { requireAuth } = require("../../src/middlewares/auth.middleware");
const {
  perUserKey,
  standardApiLimiter,
  buildPublicUploadLimiters,
  STANDARD_API_MAX,
  PUBLIC_UPLOAD_MAX_PER_HOUR,
  MAGIC_LINK_OPEN_MAX
} = require("../../src/middlewares/rate-limit.middleware");
const { createAccessToken } = require("../../src/utils/token-utils");
const authService = require("../../src/services/auth.service");

const FIRM_ID = "aaaaaaaa-0000-4000-8000-000000000001";
let ipCounter = 0;
const freshIp = () => {
  ipCounter += 1;
  return `198.51.100.${ipCounter}`;
};
const tokenFor = (userId) => createAccessToken({ userId, firmId: FIRM_ID, role: "staff" });

const hit = (app, path, { ip, token, method = "get" }) => {
  const req = request(app)[method](path).set("X-Forwarded-For", ip);
  return token ? req.set("Authorization", `Bearer ${token}`) : req;
};

describe("perUserKey", () => {
  test("keys a signed-in request on the user, not the firm or IP", () => {
    expect(perUserKey({ user: { userId: "u1", firmId: FIRM_ID }, ip: "10.0.0.1" })).toBe("user:u1");
  });

  test("falls back to the IP when nobody is signed in", () => {
    expect(perUserKey({ ip: "10.0.0.1" })).toBe("ip:10.0.0.1");
  });
});

describe("standard API limiter", () => {
  const app = express();
  app.set("trust proxy", 1);
  app.get("/limited", requireAuth, standardApiLimiter, (req, res) => res.sendStatus(200));
  app.use((err, req, res, next) => res.status(err.statusCode || 500).end());

  test("colleagues on one firm and one office IP each get their own budget", async () => {
    const officeIp = freshIp();
    const alice = tokenFor("11111111-0000-4000-8000-000000000001");
    const bob = tokenFor("11111111-0000-4000-8000-000000000002");

    for (let i = 0; i < STANDARD_API_MAX; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const res = await hit(app, "/limited", { ip: officeIp, token: alice });
      expect(res.status).toBe(200);
    }
    expect((await hit(app, "/limited", { ip: officeIp, token: alice })).status).toBe(429);

    // Same firm, same IP — unaffected by Alice using up her budget.
    expect((await hit(app, "/limited", { ip: officeIp, token: bob })).status).toBe(200);
    // 900+ sequential requests: a few seconds alone, slower when suites run in parallel.
  }, 30000);

  test("the per-user budget is well above the old 300-per-firm cap", () => {
    expect(STANDARD_API_MAX).toBeGreaterThanOrEqual(900);
  });
});

describe("public upload limiters", () => {
  const limiters = buildPublicUploadLimiters();
  const app = express();
  app.set("trust proxy", 1);
  app.post("/initiate", limiters.initiate, (req, res) => res.sendStatus(200));
  app.post("/confirm", limiters.confirm, (req, res) => res.sendStatus(200));

  test("a client can send 60 files in one sitting (120 requests from one IP)", async () => {
    const phone = freshIp();
    for (let i = 0; i < 60; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      expect((await hit(app, "/initiate", { ip: phone, method: "post" })).status).toBe(200);
      // eslint-disable-next-line no-await-in-loop
      expect((await hit(app, "/confirm", { ip: phone, method: "post" })).status).toBe(200);
    }
  });

  test("initiate and confirm have separate budgets", async () => {
    const phone = freshIp();
    for (let i = 0; i < PUBLIC_UPLOAD_MAX_PER_HOUR; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await hit(app, "/initiate", { ip: phone, method: "post" });
    }
    expect((await hit(app, "/initiate", { ip: phone, method: "post" })).status).toBe(429);
    // Files already started can still be confirmed.
    expect((await hit(app, "/confirm", { ip: phone, method: "post" })).status).toBe(200);
  });
});

describe("opening the upload link", () => {
  const app = require("../../src/app");
  const token = "a".repeat(64);

  beforeEach(() => {
    authService.validateMagicToken.mockResolvedValue({ valid: true, client: { name: "Client" } });
  });

  test("a client can reopen their link many times without being locked out", async () => {
    const phone = freshIp();
    for (let i = 0; i < 30; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const res = await hit(app, `/api/auth/magic/${token}`, { ip: phone });
      expect(res.status).toBe(200);
    }
  });

  test("still has a ceiling", async () => {
    const phone = freshIp();
    for (let i = 0; i < MAGIC_LINK_OPEN_MAX; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await hit(app, `/api/auth/magic/${token}`, { ip: phone });
    }
    expect((await hit(app, `/api/auth/magic/${token}`, { ip: phone })).status).toBe(429);
  });
});
