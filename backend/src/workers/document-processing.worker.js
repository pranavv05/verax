const IORedis = require("ioredis");
const { Worker } = require("bullmq");
const env = require("../config/env");
const { DOCUMENT_PROCESSING_QUEUE } = require("../constants/queues");
const { withTenantTransaction } = require("../db/tenant-context");
const { processDocumentWithAiService } = require("../services/ai.service");
const {
  parseAiResponse,
  markDocumentProcessingStarted,
  markDocumentProcessingSucceeded,
  markDocumentProcessingFailed
} = require("../services/document-processing.service");

const redisConnection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null
});

const validateJobPayload = (data) => {
  const documentId = data && typeof data.document_id === "string" ? data.document_id : null;
  const s3Key = data && typeof data.s3_key === "string" ? data.s3_key : null;
  const docType = data && typeof data.doc_type === "string" ? data.doc_type : null;
  const firmId = data && typeof data.firm_id === "string" ? data.firm_id : null;
  const clientId = data && typeof data.client_id === "string" ? data.client_id : null;

  if (!documentId || !s3Key || !docType || !firmId || !clientId) {
    throw new Error("Invalid document-processing job payload");
  }

  return {
    documentId,
    s3Key,
    docType,
    firmId,
    clientId
  };
};

const worker = new Worker(
  DOCUMENT_PROCESSING_QUEUE,
  async (job) => {
    const payload = validateJobPayload(job.data);

    await withTenantTransaction({ firmId: payload.firmId }, (db) =>
      markDocumentProcessingStarted(db, {
        firmId: payload.firmId,
        documentId: payload.documentId
      })
    );

    try {
      const aiRawResponse = await processDocumentWithAiService({
        documentId: payload.documentId,
        s3Key: payload.s3Key,
        docType: payload.docType,
        firmId: payload.firmId
      });
      const aiParsed = parseAiResponse(aiRawResponse);

      await withTenantTransaction({ firmId: payload.firmId }, (db) =>
        markDocumentProcessingSucceeded(db, {
          firmId: payload.firmId,
          documentId: payload.documentId,
          structuredData: aiParsed.structuredData,
          rawText: aiParsed.rawText,
          confidenceScore: aiParsed.confidenceScore
        })
      );

      return {
        document_id: payload.documentId,
        status: "extracted"
      };
    } catch (error) {
      const normalizedError = String(error && error.message ? error.message : error);
      const failure = await withTenantTransaction({ firmId: payload.firmId }, (db) =>
        markDocumentProcessingFailed(db, {
          firmId: payload.firmId,
          documentId: payload.documentId,
          errorMessage: normalizedError,
          jobId: job.id
        })
      );

      if (failure.alertTriggered) {
        process.stderr.write(
          `[ALERT] Document ${payload.documentId} for firm ${payload.firmId} failed ${failure.attempt} times.\n`
        );
      }

      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: env.DOCUMENT_WORKER_CONCURRENCY
  }
);

worker.on("ready", () => {
  process.stdout.write(
    `Document worker listening on queue "${DOCUMENT_PROCESSING_QUEUE}" with concurrency ${env.DOCUMENT_WORKER_CONCURRENCY}\n`
  );
});

worker.on("completed", (job) => {
  process.stdout.write(`Job ${job.id} completed for document ${job.data.document_id}\n`);
});

worker.on("failed", (job, error) => {
  const jobId = job ? job.id : "unknown";
  const documentId = job && job.data ? job.data.document_id : "unknown";
  process.stderr.write(
    `Job ${jobId} failed for document ${documentId}: ${String(error.message || error)}\n`
  );
});

worker.on("error", (error) => {
  process.stderr.write(`Worker error: ${String(error.message || error)}\n`);
});

const shutdown = async () => {
  process.stdout.write("Shutting down document worker...\n");
  await worker.close();
  await redisConnection.quit();
  process.exit(0);
};

process.on("SIGINT", () => {
  shutdown().catch((error) => {
    process.stderr.write(`Failed to shutdown worker: ${error.message}\n`);
    process.exit(1);
  });
});

process.on("SIGTERM", () => {
  shutdown().catch((error) => {
    process.stderr.write(`Failed to shutdown worker: ${error.message}\n`);
    process.exit(1);
  });
});
