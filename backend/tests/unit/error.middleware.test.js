const ApiError = require("../../src/utils/api-error");
const { errorHandler } = require("../../src/middlewares/error.middleware");

const run = (error, { env = "production" } = {}) => {
  const saved = process.env.NODE_ENV;
  process.env.NODE_ENV = env;
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
  try {
    errorHandler(error, { method: "POST", originalUrl: "/api/clients?token=secret" }, res, jest.fn());
  } finally {
    process.env.NODE_ENV = saved;
  }
  return { status: res.status.mock.calls[0][0], body: res.json.mock.calls[0][0] };
};

describe("errorHandler", () => {
  let stderr;
  beforeEach(() => {
    stderr = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  });
  afterEach(() => stderr.mockRestore());

  test("an unexpected 500 is masked for the client but logged with its stack (no query string)", () => {
    const { status, body } = run(new Error('relation "secret_table" does not exist'));
    expect(status).toBe(500);
    expect(body).toEqual({ error: "INTERNAL_SERVER_ERROR", message: "Internal server error", statusCode: 500 });
    const logged = stderr.mock.calls.map((c) => c[0]).join("");
    expect(logged).toContain("POST /api/clients");
    expect(logged).toContain("secret_table");
    expect(logged).not.toContain("token=secret");
  });

  test("an ApiError keeps its message and is not logged as unhandled", () => {
    const { status, body } = run(ApiError.notFound("Client not found"));
    expect(status).toBe(404);
    expect(body.message).toBe("Client not found");
    expect(stderr).not.toHaveBeenCalled();
  });

  test("malformed JSON is a 400 BAD_REQUEST with a fixed message", () => {
    const parseError = Object.assign(new SyntaxError("Expected property name at position 1"), {
      type: "entity.parse.failed",
      status: 400,
      statusCode: 400
    });
    const { status, body } = run(parseError);
    expect(status).toBe(400);
    expect(body).toEqual({ error: "BAD_REQUEST", message: "Request body is not valid JSON", statusCode: 400 });
  });

  test("an oversized body is a 413", () => {
    const { status, body } = run(Object.assign(new Error("too big"), { type: "entity.too.large", status: 413, statusCode: 413 }));
    expect(status).toBe(413);
    expect(body.error).toBe("PAYLOAD_TOO_LARGE");
  });

  test("development still shows the stack", () => {
    const { body } = run(new Error("boom"), { env: "development" });
    expect(body.message).toBe("boom");
    expect(body.stack).toContain("boom");
  });
});
