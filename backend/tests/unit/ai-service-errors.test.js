const { processDocumentWithAiService, AiServiceUnavailableError } = require("../../src/services/ai.service");
const { markInterruptedDocumentFailed, PERMANENT_FAILURE_ATTEMPTS } = require("../../src/services/document-processing.service");

const call = () =>
  processDocumentWithAiService({ documentId: "doc", s3Key: "k", docType: "invoice", firmId: "firm" });

const respond = (status, body) =>
  jest.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body)
  }));

describe("AI service error classification", () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  test("a refused connection (service down or restarting) is transient", async () => {
    const refused = new TypeError("fetch failed");
    refused.cause = { code: "ECONNREFUSED" };
    global.fetch = jest.fn(async () => {
      throw refused;
    });

    const error = await call().catch((e) => e);
    expect(error).toBeInstanceOf(AiServiceUnavailableError);
    expect(error.transient).toBe(true);
    expect(error.message).toMatch(/ECONNREFUSED/);
  });

  test.each([429, 502, 503, 504])("HTTP %i from the service is transient", async (status) => {
    global.fetch = respond(status, { detail: "busy" });
    const error = await call().catch((e) => e);
    expect(error).toBeInstanceOf(AiServiceUnavailableError);
  });

  test.each([400, 422, 500])("HTTP %i is about the document, not transient", async (status) => {
    global.fetch = respond(status, { detail: "could not read document" });
    const error = await call().catch((e) => e);
    expect(error).not.toBeInstanceOf(AiServiceUnavailableError);
    expect(error.transient).toBeUndefined();
    expect(error.message).toBe("could not read document");
  });

  test("a timeout stays a normal failure (a slow document, not an outage)", async () => {
    const aborted = new Error("aborted");
    aborted.name = "AbortError";
    global.fetch = jest.fn(async () => {
      throw aborted;
    });
    const error = await call().catch((e) => e);
    expect(error.transient).toBeUndefined();
    expect(error.message).toBe("AI service request timed out");
  });

  test("a good response is returned as-is", async () => {
    global.fetch = respond(200, { structured_data: { invoice_number: "INV-1" } });
    await expect(call()).resolves.toEqual({ structured_data: { invoice_number: "INV-1" } });
  });
});

describe("markInterruptedDocumentFailed", () => {
  test("only touches a document still stuck in processing, and marks it permanently failed", async () => {
    const db = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ client_id: "client-1", processing_attempts: 3 }] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [] })
    };

    const changed = await markInterruptedDocumentFailed(db, {
      firmId: "firm",
      documentId: "doc",
      reason: "job stalled more than allowable limit",
      jobId: "doc"
    });

    expect(changed).toBe(true);
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toMatch(/status = 'processing'/);
    expect(sql).toMatch(/GREATEST\(processing_attempts, \$4\)/);
    expect(params).toEqual(["doc", "firm", expect.stringContaining("interrupted"), PERMANENT_FAILURE_ATTEMPTS]);
    // Second query is the audit log entry.
    expect(db.query.mock.calls[1][0]).toMatch(/INSERT INTO audit_logs/i);
  });

  test("is a no-op (and writes no audit entry) when the document already moved on", async () => {
    const db = { query: jest.fn().mockResolvedValueOnce({ rowCount: 0, rows: [] }) };
    await expect(markInterruptedDocumentFailed(db, { firmId: "firm", documentId: "doc" })).resolves.toBe(false);
    expect(db.query).toHaveBeenCalledTimes(1);
  });
});
