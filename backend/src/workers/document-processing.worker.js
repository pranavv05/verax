const IORedis = require("ioredis");
const { Worker } = require("bullmq");
const env = require("../config/env");
const { DOCUMENT_PROCESSING_QUEUE } = require("../constants/queues");
const { withTenantTransaction } = require("../db/tenant-context");
const { processDocumentWithAiService } = require("../services/ai.service");
const { sendEmail } = require("../services/email.service");
const { createNotification } = require("../services/notifications.service");
const {
  parseAiResponse,
  markDocumentProcessingStarted,
  markDocumentProcessingSucceeded,
  markDocumentProcessingFailed,
  getDocumentReadyEmailContext,
  recordDocumentReadyEmailAudit
} = require("../services/document-processing.service");
const {
  documentReadySubject,
  documentReadyTemplate
} = require("../templates/documentReady.template");
const { createScheduledRequestsWorker } = require("../jobs/scheduled-requests.job");

const redisConnection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null
});
const scheduledRequestsWorker = createScheduledRequestsWorker();
const CONFIDENCE_THRESHOLD = 0.4;

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
      const confidence = aiParsed.confidenceScore ?? 0;
      const documentTypeDetected = aiParsed.documentTypeDetected;
      const requiresReview =
        confidence < CONFIDENCE_THRESHOLD || documentTypeDetected === "unknown";
      const status = requiresReview ? "review_required" : "extracted";
      const logMessage = requiresReview
        ? `Low confidence (${confidence}) or wrong document type — flagged for review`
        : `Extracted with confidence ${confidence}`;

      await withTenantTransaction({ firmId: payload.firmId }, (db) =>
        markDocumentProcessingSucceeded(db, {
          firmId: payload.firmId,
          documentId: payload.documentId,
          structuredData: aiParsed.structuredData,
          rawText: aiParsed.rawText,
          confidenceScore: aiParsed.confidenceScore,
          status,
          logMessage,
          auditMetadata: {
            confidence,
            documentTypeDetected
          }
        })
      );

      const emailContext = await withTenantTransaction({ firmId: payload.firmId }, (db) =>
        getDocumentReadyEmailContext(db, {
          firmId: payload.firmId,
          documentId: payload.documentId
        })
      );

      if (emailContext && emailContext.admins.length > 0) {
        const reviewUrl = `${env.FRONTEND_URL}/review/${payload.documentId}`;
        for (const admin of emailContext.admins) {
          const emailResult = await sendEmail({
            to: admin.email,
            subject: documentReadySubject({
              documentName: emailContext.document.file_name
            }),
            html: documentReadyTemplate({
              firmName: emailContext.document.firm_name,
              clientName: emailContext.document.client_name,
              documentName: emailContext.document.file_name,
              reviewUrl
            })
          });

          await withTenantTransaction({ firmId: payload.firmId }, (db) =>
            recordDocumentReadyEmailAudit(db, {
              firmId: payload.firmId,
              userId: admin.id,
              documentId: payload.documentId,
              email: admin.email,
              emailResult
            })
          );
        }
      }

      if (emailContext && emailContext.admins.length > 0) {
        for (const admin of emailContext.admins) {
          try {
            await createNotification({
              firmId: payload.firmId,
              userId: admin.id,
              type: "document_ready",
              title: "Document ready for review",
              message: `${emailContext.document.file_name} from ${emailContext.document.client_name} has been processed and is ready to review.`,
              entityType: "document",
              entityId: payload.documentId
            });
          } catch (notificationError) {
            process.stderr.write(
              `Notification failed for document ${payload.documentId}: ${String(notificationError.message || notificationError)}\n`
            );
          }
        }
      }

      return {
        document_id: payload.documentId,
        status
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
  await scheduledRequestsWorker.worker.close();
  await scheduledRequestsWorker.connection.quit();
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
