// Behind a reverse proxy (Render's edge, Caddy in docker-compose.prod.yml)
// every request arrives from the proxy's address. These tests simulate that
// with TRUST_PROXY=1 and X-Forwarded-For, and pin down the limiter layout:
// refresh/logout must not share the login budget, and login is budgeted per
// account so colleagues behind one office IP don't lock each other out.
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
  loginUser: jest.fn(),
  refreshAccessToken: jest.fn(),
  logoutSession: jest.fn()
}));
jest.mock("../../src/services/client-auth.service", () => ({
  ...jest.requireActual("../../src/services/client-auth.service"),
  clientLogin: jest.fn(),
  clientRefreshToken: jest.fn(),
  clientLogout: jest.fn()
}));

const request = require("supertest");
const authService = require("../../src/services/auth.service");
const clientAuthService = require("../../src/services/client-auth.service");
const app = require("../../src/app");

const PASSWORD = "correct-horse-battery";
let ipCounter = 0;
// A fresh client IP per test, so limiter state never leaks between tests.
const freshIp = () => {
  ipCounter += 1;
  return `203.0.113.${ipCounter}`;
};

const login = (ip, email, path = "/api/auth/login") =>
  request(app).post(path).set("X-Forwarded-For", ip).send({ email, password: PASSWORD });

beforeEach(() => {
  jest.clearAllMocks();
  authService.loginUser.mockResolvedValue({ accessToken: "a", refreshToken: "r", user: {}, firm: {} });
  authService.refreshAccessToken.mockResolvedValue({ accessToken: "a", refreshToken: "r", user: {} });
  authService.logoutSession.mockResolvedValue(undefined);
  clientAuthService.clientLogin.mockResolvedValue({ accessToken: "a", refreshToken: "r", client: {} });
  clientAuthService.clientRefreshToken.mockResolvedValue({ accessToken: "a", refreshToken: "r", client: {} });
  clientAuthService.clientLogout.mockResolvedValue(undefined);
});

describe("firm auth rate limits", () => {
  test("refresh is not capped by the 10-per-window login budget", async () => {
    const ip = freshIp();
    for (let i = 0; i < 50; i += 1) {
      const res = await request(app).post("/api/auth/refresh").set("X-Forwarded-For", ip);
      expect(res.status).toBe(200);
    }
  });

  test("refresh and logout traffic does not consume the login budget", async () => {
    const ip = freshIp();
    for (let i = 0; i < 20; i += 1) {
      await request(app).post("/api/auth/refresh").set("X-Forwarded-For", ip);
      await request(app).post("/api/auth/logout").set("X-Forwarded-For", ip);
    }
    const res = await login(ip, "someone@firm.in");
    expect(res.status).toBe(200);
  });

  test("login is capped at 10 attempts per account per IP", async () => {
    const ip = freshIp();
    for (let i = 0; i < 10; i += 1) {
      expect((await login(ip, "target@firm.in")).status).toBe(200);
    }
    const blocked = await login(ip, "TARGET@firm.in ");
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toBe("RATE_LIMIT_EXCEEDED");
  });

  test("colleagues behind one office IP each get their own login budget", async () => {
    const officeIp = freshIp();
    for (let i = 0; i < 10; i += 1) {
      await login(officeIp, "first@firm.in");
    }
    expect((await login(officeIp, "first@firm.in")).status).toBe(429);
    expect((await login(officeIp, "second@firm.in")).status).toBe(200);
  });

  test("one IP cannot spray more than 100 login attempts across accounts", async () => {
    const ip = freshIp();
    for (let i = 0; i < 100; i += 1) {
      expect((await login(ip, `user${i}@firm.in`)).status).toBe(200);
    }
    expect((await login(ip, "fresh-account@firm.in")).status).toBe(429);
  });

  test("different client IPs behind the proxy get separate budgets", async () => {
    const ipA = freshIp();
    const ipB = freshIp();
    for (let i = 0; i < 10; i += 1) {
      await login(ipA, "shared@firm.in");
    }
    expect((await login(ipA, "shared@firm.in")).status).toBe(429);
    expect((await login(ipB, "shared@firm.in")).status).toBe(200);
  });
});

describe("client portal auth rate limits", () => {
  test("client refresh is not capped by the login budget", async () => {
    const ip = freshIp();
    for (let i = 0; i < 50; i += 1) {
      const res = await request(app).post("/api/client-portal/auth/refresh").set("X-Forwarded-For", ip);
      expect(res.status).toBe(200);
    }
  });

  test("client login is capped per account and keeps the client-portal message", async () => {
    const ip = freshIp();
    for (let i = 0; i < 10; i += 1) {
      await login(ip, "client@example.in", "/api/client-portal/auth/login");
    }
    const blocked = await login(ip, "client@example.in", "/api/client-portal/auth/login");
    expect(blocked.status).toBe(429);
    expect(blocked.body.message).toBe("Too many attempts. Please try again in a few minutes.");
  });

  test("firm and client portal login budgets are independent", async () => {
    const ip = freshIp();
    for (let i = 0; i < 10; i += 1) {
      await login(ip, "same@example.in");
    }
    expect((await login(ip, "same@example.in")).status).toBe(429);
    expect((await login(ip, "same@example.in", "/api/client-portal/auth/login")).status).toBe(200);
  });
});
