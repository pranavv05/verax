const { DelayedError } = require("bullmq");
const env = require("../config/env");
const { withTenantTransaction } = require("../db/tenant-context");
const { processDocumentWithAiService } = require("../services/ai.service");
const { sendEmail } = require("../services/email.service");
const { createNotification } = require("../services/notifications.service");
const {
  parseAiResponse,
  detectDocTypeMismatch,
  markDocumentProcessingStarted,
  markDocumentProcessingSucceeded,
  markDocumentProcessingFailed,
  markInterruptedDocumentFailed,
  getDocumentReadyEmailContext,
  recordDocumentReadyEmailAudit,
  recordDocumentFailedEmailAudit
} = require("../services/document-processing.service");
const { documentReadySubject, documentReadyTemplate } = require("../templates/documentReady.template");
const { documentFailedSubject, documentFailedTemplate } = require("../templates/documentFailed.template");

/**
 * The document-processing job, kept apart from the BullMQ Worker wiring in
 * document-processing.worker.js so it can be tested without Redis. Every
 * collaborator comes in through `deps`; defaults are the real services.
 */

// How long to wait for an unavailable AI service before giving up on the
// document: 30s, 1m, 2m, 4m, then every 5m — about 27 minutes in total, long
// enough to ride out a deploy or a PaddleOCR model reload. These waits do not
// count against the job's own `attempts`, which stay reserved for failures
// that are about the document itself.
const MAX_TRANSIENT_RETRIES = 8;
const TRANSIENT_BASE_DELAY_MS = 30 * 1000;
const TRANSIENT_MAX_DELAY_MS = 5 * 60 * 1000;

const transientRetryDelayMs = (retriesSoFar) =>
  Math.min(TRANSIENT_BASE_DELAY_MS * 2 ** retriesSoFar, TRANSIENT_MAX_DELAY_MS);

const validateJobPayload = (data) => {
  const documentId = data && typeof data.document_id === "string" ? data.document_id : null;
  const s3Key = data && typeof data.s3_key === "string" ? data.s3_key : null;
  const docType = data && typeof data.doc_type === "string" ? data.doc_type : null;
  const firmId = data && typeof data.firm_id === "string" ? data.firm_id : null;
  const clientId = data && typeof data.client_id === "string" ? data.client_id : null;

  if (!documentId || !s3Key || !docType || !firmId || !clientId) {
    throw new Error("Invalid document-processing job payload");
  }

  return { documentId, s3Key, docType, firmId, clientId };
};

const logError = (message) => process.stderr.write(`${message}\n`);

// ---------------------------------------------------------------------------
// Notifications (defaults for deps.notifyDocumentReady / notifyDocumentFailed)
// ---------------------------------------------------------------------------

const notifyDocumentReady = async ({ firmId, documentId }) => {
  const emailContext = await withTenantTransaction({ firmId }, (db) =>
    getDocumentReadyEmailContext(db, { firmId, documentId })
  );
  if (!emailContext || emailContext.admins.length === 0) return;

  // Emails only in "instant" mode; by default they go out as one daily digest
  // (services/document-digest.service.js). In-app notifications always.
  const reviewUrl = `${env.FRONTEND_URL}/review/${documentId}`;
  const emailAdmins = env.DOCUMENT_READY_EMAILS === "instant" ? emailContext.admins : [];
  for (const admin of emailAdmins) {
    const emailResult = await sendEmail({
      to: admin.email,
      subject: documentReadySubject({ documentName: emailContext.document.file_name }),
      html: documentReadyTemplate({
        firmName: emailContext.document.firm_name,
        clientName: emailContext.document.client_name,
        documentName: emailContext.document.file_name,
        reviewUrl
      })
    });

    await withTenantTransaction({ firmId }, (db) =>
      recordDocumentReadyEmailAudit(db, {
        firmId,
        userId: admin.id,
        documentId,
        email: admin.email,
        emailResult
      })
    );
  }

  for (const admin of emailContext.admins) {
    try {
      await createNotification({
        firmId,
        userId: admin.id,
        type: "document_ready",
        title: "Document ready for review",
        message: `${emailContext.document.file_name} from ${emailContext.document.client_name} has been processed and is ready to review.`,
        entityType: "document",
        entityId: documentId
      });
    } catch (notificationError) {
      logError(`Notification failed for document ${documentId}: ${String(notificationError.message || notificationError)}`);
    }
  }
};

const notifyDocumentFailed = async ({ firmId, documentId, failureReason }) => {
  const failureContext = await withTenantTransaction({ firmId }, (db) =>
    getDocumentReadyEmailContext(db, { firmId, documentId })
  );
  if (!failureContext || failureContext.admins.length === 0) return;

  const auditLogUrl = `${env.FRONTEND_URL}/audit-logs`;
  for (const admin of failureContext.admins) {
    try {
      await createNotification({
        firmId,
        userId: admin.id,
        type: "document_failed",
        title: "Document processing failed",
        message: "A document failed to process after 3 attempts and needs manual review.",
        entityType: "document",
        entityId: documentId
      });
    } catch (notificationError) {
      logError(`Failure notification failed for document ${documentId}: ${String(notificationError.message || notificationError)}`);
    }

    try {
      const emailResult = await sendEmail({
        to: admin.email,
        subject: documentFailedSubject(),
        html: documentFailedTemplate({
          firmName: failureContext.document.firm_name,
          clientName: failureContext.document.client_name,
          documentName: failureContext.document.file_name,
          failureReason,
          auditLogUrl
        })
      });

      await withTenantTransaction({ firmId }, (db) =>
        recordDocumentFailedEmailAudit(db, {
          firmId,
          userId: admin.id,
          documentId,
          email: admin.email,
          emailResult
        })
      );
    } catch (emailError) {
      logError(`Failure email failed for document ${documentId}: ${String(emailError.message || emailError)}`);
    }
  }
};

const defaultDeps = () => ({
  withTenantTransaction,
  processDocumentWithAiService,
  parseAiResponse,
  detectDocTypeMismatch,
  markDocumentProcessingStarted,
  markDocumentProcessingSucceeded,
  markDocumentProcessingFailed,
  markInterruptedDocumentFailed,
  notifyDocumentReady,
  notifyDocumentFailed,
  confidenceThreshold: env.REVIEW_CONFIDENCE_THRESHOLD,
  now: () => Date.now(),
  logError
});

// ---------------------------------------------------------------------------
// The job
// ---------------------------------------------------------------------------

const createDocumentJobProcessor = (overrides = {}) => {
  const deps = { ...defaultDeps(), ...overrides };

  return async (job, token) => {
    const payload = validateJobPayload(job.data);
    const { firmId, documentId } = payload;

    await deps.withTenantTransaction({ firmId }, (db) =>
      deps.markDocumentProcessingStarted(db, { firmId, documentId })
    );

    let status;
    try {
      const aiRawResponse = await deps.processDocumentWithAiService({
        documentId,
        s3Key: payload.s3Key,
        docType: payload.docType,
        firmId
      });
      const aiParsed = deps.parseAiResponse(aiRawResponse);
      const confidence = aiParsed.confidenceScore ?? 0;
      const documentTypeDetected = aiParsed.documentTypeDetected;
      // Independent of the LLM's own self-reported documentTypeDetected
      // (which the bank-statement path never even populates) — a structural
      // check of the extracted field shapes against what the uploader
      // claimed this document was. See detectDocTypeMismatch's comment.
      const docTypeMismatchWarning = deps.detectDocTypeMismatch(payload.docType, aiParsed.structuredData);
      if (docTypeMismatchWarning) {
        aiParsed.structuredData._doc_type_mismatch_warning = docTypeMismatchWarning;
      }
      const requiresReview =
        confidence < deps.confidenceThreshold || documentTypeDetected === "unknown" || Boolean(docTypeMismatchWarning);
      status = requiresReview ? "review_required" : "extracted";
      const logMessage = docTypeMismatchWarning
        ? "Document type mismatch detected — flagged for review"
        : requiresReview
          ? `Low confidence (${confidence}) or wrong document type — flagged for review`
          : `Extracted with confidence ${confidence}`;

      await deps.withTenantTransaction({ firmId }, (db) =>
        deps.markDocumentProcessingSucceeded(db, {
          firmId,
          documentId,
          structuredData: aiParsed.structuredData,
          rawText: aiParsed.rawText,
          confidenceScore: aiParsed.confidenceScore,
          status,
          logMessage,
          auditMetadata: { confidence, documentTypeDetected }
        })
      );
    } catch (error) {
      // The AI service is down or restarting — nothing is wrong with this
      // document. Wait and try again without using up one of its attempts;
      // the document stays "processing" meanwhile.
      const transientRetries = Number(job.data.transient_retries || 0);
      if (error && error.transient && transientRetries < MAX_TRANSIENT_RETRIES) {
        const delayMs = transientRetryDelayMs(transientRetries);
        deps.logError(
          `AI service unavailable for document ${documentId} (${error.message}); retrying in ${Math.round(delayMs / 1000)}s ` +
            `(${transientRetries + 1}/${MAX_TRANSIENT_RETRIES})`
        );
        await job.updateData({ ...job.data, transient_retries: transientRetries + 1 });
        await job.moveToDelayed(deps.now() + delayMs, token);
        throw new DelayedError();
      }

      const normalizedError = String(error && error.message ? error.message : error);
      const failure = await deps.withTenantTransaction({ firmId }, (db) =>
        deps.markDocumentProcessingFailed(db, { firmId, documentId, errorMessage: normalizedError, jobId: job.id })
      );

      if (failure.alertTriggered) {
        deps.logError(`[ALERT] Document ${documentId} for firm ${firmId} failed ${failure.attempt} times.`);
        try {
          await deps.notifyDocumentFailed({ firmId, documentId, failureReason: normalizedError });
        } catch (alertPipelineError) {
          deps.logError(
            `Permanent-failure alert pipeline failed for document ${documentId}: ${String(alertPipelineError.message || alertPipelineError)}`
          );
        }
      }

      throw error;
    }

    // The extraction is saved. Nothing below may undo that: a failure here
    // used to fall into the catch above, mark the finished document failed
    // and send it back through the AI.
    try {
      await deps.notifyDocumentReady({ firmId, documentId });
    } catch (notifyError) {
      deps.logError(`Ready notification failed for document ${documentId}: ${String(notifyError.message || notifyError)}`);
    }

    return { document_id: documentId, status };
  };
};

// ---------------------------------------------------------------------------
// Recovering documents whose job died mid-run
// ---------------------------------------------------------------------------

/**
 * When the worker process dies mid-job, BullMQ eventually fails the job as
 * stalled without running the processor's catch, leaving the document in
 * "processing" forever. This finds those jobs among the failed ones and marks
 * their documents failed. Safe to run repeatedly: documents that are no
 * longer "processing" are left alone.
 */
const createStuckDocumentRecovery = ({ queue, deps: overrides = {} }) => {
  const deps = { ...defaultDeps(), ...overrides };

  const recoverJob = async (job) => {
    const documentId = job && job.data && job.data.document_id;
    const firmId = job && job.data && job.data.firm_id;
    if (!documentId || !firmId) return false;
    return deps.withTenantTransaction({ firmId }, (db) =>
      deps.markInterruptedDocumentFailed(db, {
        firmId,
        documentId,
        reason: job.failedReason ? String(job.failedReason).slice(0, 200) : null,
        jobId: job.id
      })
    );
  };

  const sweep = async ({ batchSize = 200 } = {}) => {
    let recovered = 0;
    const failedJobs = await queue.getFailed(0, batchSize - 1);
    for (const job of failedJobs) {
      try {
        if (await recoverJob(job)) recovered += 1;
      } catch (error) {
        deps.logError(`Stuck-document recovery failed for job ${job && job.id}: ${String(error.message || error)}`);
      }
    }
    return recovered;
  };

  return { recoverJob, sweep };
};

module.exports = {
  createDocumentJobProcessor,
  createStuckDocumentRecovery,
  transientRetryDelayMs,
  MAX_TRANSIENT_RETRIES,
  validateJobPayload
};
