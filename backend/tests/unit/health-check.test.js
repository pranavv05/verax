jest.mock("../../src/db/pool", () => ({
  query: jest.fn()
}));
jest.mock("../../src/services/document-queue.service", () => ({
  checkRedisHealth: jest.fn(),
  enqueueDocumentProcessingJob: jest.fn()
}));

const request = require("supertest");
const pool = require("../../src/db/pool");
const { checkRedisHealth } = require("../../src/services/document-queue.service");
const app = require("../../src/app");

describe("GET /health", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns 200 when Postgres and Redis are both reachable", async () => {
    pool.query.mockResolvedValue({ rows: [{ "?column?": 1 }] });
    checkRedisHealth.mockResolvedValue(undefined);

    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  test("returns 503 when Postgres is unreachable", async () => {
    pool.query.mockRejectedValue(new Error("connect ECONNREFUSED"));
    checkRedisHealth.mockResolvedValue(undefined);

    const res = await request(app).get("/health");

    expect(res.status).toBe(503);
    expect(res.body.status).toBe("error");
  });

  test("returns 503 when Redis is unreachable", async () => {
    pool.query.mockResolvedValue({ rows: [{ "?column?": 1 }] });
    checkRedisHealth.mockRejectedValue(new Error("Redis connection timed out"));

    const res = await request(app).get("/health");

    expect(res.status).toBe(503);
    expect(res.body.status).toBe("error");
  });

  test("returns 503 rather than hanging when a dependency check never resolves", async () => {
    pool.query.mockImplementation(() => new Promise(() => {}));
    checkRedisHealth.mockResolvedValue(undefined);

    const res = await request(app).get("/health");

    expect(res.status).toBe(503);
  }, 10000);
});
