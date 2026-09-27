const { DelayedError } = require("bullmq");
const {
  createDocumentJobProcessor,
  createStuckDocumentRecovery,
  transientRetryDelayMs,
  MAX_TRANSIENT_RETRIES
} = require("../../src/workers/document-job.processor");
const { AiServiceUnavailableError } = require("../../src/services/ai.service");

const FIRM_ID = "aaaaaaaa-0000-4000-8000-000000000001";
const DOC_ID = "dddddddd-0000-4000-8000-000000000001";
const NOW = 1_800_000_000_000;

const makeJob = (data = {}) => {
  const job = {
    id: DOC_ID,
    data: {
      document_id: DOC_ID,
      s3_key: "firm/doc.pdf",
      doc_type: "invoice",
      firm_id: FIRM_ID,
      client_id: "cccccccc-0000-4000-8000-000000000001",
      ...data
    },
    updateData: jest.fn(async (next) => {
      job.data = next;
    }),
    moveToDelayed: jest.fn(async () => {})
  };
  return job;
};

const makeDeps = (overrides = {}) => ({
  withTenantTransaction: jest.fn(async (_ctx, fn) => fn({ query: jest.fn() })),
  processDocumentWithAiService: jest.fn(async () => ({ raw: true })),
  parseAiResponse: jest.fn(() => ({
    structuredData: { invoice_number: "INV-2026-0417" },
    rawText: "TAX INVOICE",
    confidenceScore: 0.92,
    documentTypeDetected: "invoice"
  })),
  detectDocTypeMismatch: jest.fn(() => null),
  markDocumentProcessingStarted: jest.fn(async () => ({})),
  markDocumentProcessingSucceeded: jest.fn(async () => {}),
  markDocumentProcessingFailed: jest.fn(async () => ({ attempt: 1, alertTriggered: false })),
  markInterruptedDocumentFailed: jest.fn(async () => true),
  notifyDocumentReady: jest.fn(async () => {}),
  notifyDocumentFailed: jest.fn(async () => {}),
  confidenceThreshold: 0.4,
  now: () => NOW,
  logError: jest.fn(),
  ...overrides
});

describe("document job — success", () => {
  test("saves the extraction, then notifies, and reports the status", async () => {
    const deps = makeDeps();
    const result = await createDocumentJobProcessor(deps)(makeJob(), "lock-token");

    expect(result).toEqual({ document_id: DOC_ID, status: "extracted" });
    expect(deps.markDocumentProcessingSucceeded).toHaveBeenCalledTimes(1);
    expect(deps.notifyDocumentReady).toHaveBeenCalledWith({ firmId: FIRM_ID, documentId: DOC_ID });
    expect(deps.markDocumentProcessingFailed).not.toHaveBeenCalled();
  });

  test("flags low-confidence documents for review", async () => {
    const deps = makeDeps({
      parseAiResponse: jest.fn(() => ({ structuredData: {}, rawText: "", confidenceScore: 0.2, documentTypeDetected: "invoice" }))
    });
    const result = await createDocumentJobProcessor(deps)(makeJob(), "t");
    expect(result.status).toBe("review_required");
  });

  test("a failing notification never un-finishes a saved document", async () => {
    const deps = makeDeps({
      notifyDocumentReady: jest.fn(async () => {
        throw new Error("audit insert timed out");
      })
    });

    await expect(createDocumentJobProcessor(deps)(makeJob(), "t")).resolves.toEqual({
      document_id: DOC_ID,
      status: "extracted"
    });
    expect(deps.markDocumentProcessingFailed).not.toHaveBeenCalled();
    expect(deps.logError).toHaveBeenCalledWith(expect.stringContaining("audit insert timed out"));
  });
});

describe("document job — AI service unavailable", () => {
  test("waits and retries without spending an attempt or marking the document failed", async () => {
    const deps = makeDeps({
      processDocumentWithAiService: jest.fn(async () => {
        throw new AiServiceUnavailableError("AI service unreachable (ECONNREFUSED)");
      })
    });
    const job = makeJob();

    await expect(createDocumentJobProcessor(deps)(job, "lock-token")).rejects.toBeInstanceOf(DelayedError);

    expect(job.moveToDelayed).toHaveBeenCalledWith(NOW + 30 * 1000, "lock-token");
    expect(job.data.transient_retries).toBe(1);
    expect(deps.markDocumentProcessingFailed).not.toHaveBeenCalled();
  });

  test("backs off exponentially and caps each wait at five minutes", () => {
    expect([0, 1, 2, 3, 4, 7].map(transientRetryDelayMs)).toEqual([
      30000, 60000, 120000, 240000, 300000, 300000
    ]);
    const totalMs = Array.from({ length: MAX_TRANSIENT_RETRIES }, (_, n) => transientRetryDelayMs(n)).reduce(
      (a, b) => a + b,
      0
    );
    // Long enough to ride out a deploy / model reload (~20+ minutes).
    expect(totalMs).toBeGreaterThanOrEqual(20 * 60 * 1000);
  });

  test("gives up after the transient budget and records a normal failure", async () => {
    const outage = new AiServiceUnavailableError("AI service unavailable (503)");
    const deps = makeDeps({
      processDocumentWithAiService: jest.fn(async () => {
        throw outage;
      })
    });
    const job = makeJob({ transient_retries: MAX_TRANSIENT_RETRIES });

    await expect(createDocumentJobProcessor(deps)(job, "t")).rejects.toBe(outage);
    expect(job.moveToDelayed).not.toHaveBeenCalled();
    expect(deps.markDocumentProcessingFailed).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      documentId: DOC_ID,
      errorMessage: "AI service unavailable (503)"
    }));
  });
});

describe("document job — document failures", () => {
  test("a bad document is marked failed and handed back to BullMQ's own retries", async () => {
    const bad = new Error("LLM returned no fields");
    const deps = makeDeps({
      processDocumentWithAiService: jest.fn(async () => {
        throw bad;
      })
    });
    const job = makeJob();

    await expect(createDocumentJobProcessor(deps)(job, "t")).rejects.toBe(bad);
    expect(job.moveToDelayed).not.toHaveBeenCalled();
    expect(deps.markDocumentProcessingFailed).toHaveBeenCalledTimes(1);
    expect(deps.notifyDocumentReady).not.toHaveBeenCalled();
  });

  test("alerts admins on the final failure, and a broken alert doesn't mask the real error", async () => {
    const bad = new Error("OCR found no text");
    const deps = makeDeps({
      processDocumentWithAiService: jest.fn(async () => {
        throw bad;
      }),
      markDocumentProcessingFailed: jest.fn(async () => ({ attempt: 3, alertTriggered: true })),
      notifyDocumentFailed: jest.fn(async () => {
        throw new Error("smtp down");
      })
    });

    await expect(createDocumentJobProcessor(deps)(makeJob(), "t")).rejects.toBe(bad);
    expect(deps.notifyDocumentFailed).toHaveBeenCalledWith({
      firmId: FIRM_ID,
      documentId: DOC_ID,
      failureReason: "OCR found no text"
    });
  });

  test("rejects a malformed job payload before touching the database", async () => {
    const deps = makeDeps();
    await expect(createDocumentJobProcessor(deps)({ id: "x", data: {} }, "t")).rejects.toThrow(/Invalid/);
    expect(deps.markDocumentProcessingStarted).not.toHaveBeenCalled();
  });
});

describe("stuck-document recovery", () => {
  test("marks each failed job's document as interrupted, scoped to its firm", async () => {
    const deps = makeDeps({
      markInterruptedDocumentFailed: jest.fn(async (_db, { documentId }) => documentId === DOC_ID)
    });
    const queue = {
      getFailed: jest.fn(async () => [
        { id: "1", data: { document_id: DOC_ID, firm_id: FIRM_ID }, failedReason: "job stalled more than allowable limit" },
        { id: "2", data: { document_id: "other", firm_id: FIRM_ID } },
        { id: "3", data: {} }
      ])
    };

    const recovered = await createStuckDocumentRecovery({ queue, deps }).sweep();

    expect(recovered).toBe(1);
    expect(deps.withTenantTransaction).toHaveBeenCalledWith({ firmId: FIRM_ID }, expect.any(Function));
    expect(deps.markInterruptedDocumentFailed).toHaveBeenCalledWith(expect.anything(), {
      firmId: FIRM_ID,
      documentId: DOC_ID,
      reason: "job stalled more than allowable limit",
      jobId: "1"
    });
    // The job with no payload is skipped, not an error.
    expect(deps.markInterruptedDocumentFailed).toHaveBeenCalledTimes(2);
  });

  test("one bad job doesn't stop the sweep", async () => {
    const deps = makeDeps({
      markInterruptedDocumentFailed: jest
        .fn()
        .mockRejectedValueOnce(new Error("db blip"))
        .mockResolvedValueOnce(true)
    });
    const queue = {
      getFailed: jest.fn(async () => [
        { id: "1", data: { document_id: "a", firm_id: FIRM_ID } },
        { id: "2", data: { document_id: "b", firm_id: FIRM_ID } }
      ])
    };

    await expect(createStuckDocumentRecovery({ queue, deps }).sweep()).resolves.toBe(1);
    expect(deps.logError).toHaveBeenCalledWith(expect.stringContaining("db blip"));
  });
});
