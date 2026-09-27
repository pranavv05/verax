// The job id is the document id, and BullMQ silently ignores add() for an id
// that already exists in any state. These tests pin down that a finished
// (failed/completed) job is cleared first so reprocessing actually re-runs,
// while a job that is still pending/running keeps deduping.
const mockQueue = {
  add: jest.fn(),
  getJob: jest.fn(),
  client: Promise.resolve()
};

jest.mock("ioredis", () => jest.fn().mockImplementation(() => ({ ping: jest.fn() })));
jest.mock("bullmq", () => ({
  Queue: jest.fn().mockImplementation(() => mockQueue)
}));

const { enqueueDocumentProcessingJob } = require("../../src/services/document-queue.service");

const DOCUMENT_ID = "11111111-1111-4111-8111-111111111111";
const payload = {
  documentId: DOCUMENT_ID,
  s3Key: "firm/client/doc/invoice.pdf",
  docType: "invoice",
  firmId: "firm-1",
  clientId: "client-1"
};

const existingJob = (state) => ({
  id: DOCUMENT_ID,
  getState: jest.fn().mockResolvedValue(state),
  remove: jest.fn().mockResolvedValue(undefined)
});

beforeEach(() => {
  jest.clearAllMocks();
  mockQueue.add.mockResolvedValue({ id: DOCUMENT_ID });
});

describe("enqueueDocumentProcessingJob", () => {
  test("adds a job keyed by document id when none exists", async () => {
    mockQueue.getJob.mockResolvedValue(undefined);

    const jobId = await enqueueDocumentProcessingJob(payload);

    expect(jobId).toBe(DOCUMENT_ID);
    expect(mockQueue.add).toHaveBeenCalledWith(
      "process-document",
      expect.objectContaining({ document_id: DOCUMENT_ID, s3_key: payload.s3Key }),
      expect.objectContaining({ jobId: DOCUMENT_ID, attempts: 3 })
    );
  });

  test.each(["failed", "completed"])(
    "removes a %s job before re-adding, so reprocess actually runs",
    async (state) => {
      const job = existingJob(state);
      mockQueue.getJob.mockResolvedValue(job);

      await enqueueDocumentProcessingJob(payload);

      expect(job.remove).toHaveBeenCalledTimes(1);
      expect(job.remove.mock.invocationCallOrder[0]).toBeLessThan(
        mockQueue.add.mock.invocationCallOrder[0]
      );
    }
  );

  test.each(["waiting", "active", "delayed", "prioritized"])(
    "leaves a %s job alone so a double submit still dedupes",
    async (state) => {
      const job = existingJob(state);
      mockQueue.getJob.mockResolvedValue(job);

      await enqueueDocumentProcessingJob(payload);

      expect(job.remove).not.toHaveBeenCalled();
    }
  );

  test("tolerates a concurrent enqueue having removed the finished job first", async () => {
    const job = existingJob("failed");
    job.remove.mockRejectedValue(new Error("Missing key for job"));
    mockQueue.getJob.mockResolvedValueOnce(job).mockResolvedValueOnce(undefined);

    await expect(enqueueDocumentProcessingJob(payload)).resolves.toBe(DOCUMENT_ID);
    expect(mockQueue.add).toHaveBeenCalledTimes(1);
  });

  test("surfaces a remove failure when the finished job is still there", async () => {
    const job = existingJob("failed");
    job.remove.mockRejectedValue(new Error("Redis connection lost"));
    mockQueue.getJob.mockResolvedValue(job);

    await expect(enqueueDocumentProcessingJob(payload)).rejects.toThrow("Redis connection lost");
    expect(mockQueue.add).not.toHaveBeenCalled();
  });
});
