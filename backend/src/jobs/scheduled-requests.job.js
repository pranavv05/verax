const IORedis = require("ioredis");
const { Queue, Worker } = require("bullmq");
const env = require("../config/env");
const { withTenantTransaction } = require("../db/tenant-context");
const { requestClientDocuments } = require("../services/clients.service");
const {
  getDueSchedules,
  markSent
} = require("../services/scheduled-requests.service");
const { processDocumentDigests } = require("../services/document-digest.service");

const SCHEDULED_REQUESTS_QUEUE = "scheduled-requests";
const JOB_NAME = "send-scheduled-requests";
// Shares this queue and worker so it runs wherever scheduled requests run
// (see SCHEDULED_REQUESTS_EMBEDDED).
const DOCUMENT_DIGEST_JOB_NAME = "send-document-digests";

let queueInstance;
let queueConnection;

const getScheduledRequestsQueue = () => {
  if (!queueInstance) {
    queueConnection = new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: null
    });
    queueInstance = new Queue(SCHEDULED_REQUESTS_QUEUE, {
      connection: queueConnection
    });
  }
  return queueInstance;
};

const insertAuditLog = async (db, { firmId, action, entityType, entityId, metadata }) => {
  await db.query(
    `
      INSERT INTO audit_logs (firm_id, user_id, action, entity_type, entity_id, metadata)
      VALUES ($1, NULL, $2, $3, $4, $5::jsonb)
    `,
    [firmId, action, entityType, entityId, JSON.stringify(metadata || {})]
  );
};

const addScheduledRequestsJob = async () => {
  const queue = getScheduledRequestsQueue();
  await queue.add(
    JOB_NAME,
    {},
    {
      jobId: JOB_NAME,
      repeat: { pattern: "0 8 * * *" },
      removeOnComplete: true,
      removeOnFail: false
    }
  );
};

// 08:00 IST, before the office opens. When DOCUMENT_READY_EMAILS isn't
// "digest" the job still fires but sends nothing.
const addDocumentDigestJob = async () => {
  const queue = getScheduledRequestsQueue();
  await queue.add(
    DOCUMENT_DIGEST_JOB_NAME,
    {},
    {
      jobId: DOCUMENT_DIGEST_JOB_NAME,
      repeat: { pattern: "0 8 * * *", tz: "Asia/Kolkata" },
      removeOnComplete: true,
      removeOnFail: false
    }
  );
};

const runDocumentDigests = async () => {
  const result = await processDocumentDigests();
  if (!result.skipped) {
    process.stdout.write(
      `Document digests: ${result.emailsSent} email(s) sent across ${result.firms} firm(s); failures: ${result.failures}\n`
    );
  }
  return result;
};

const processScheduledJob = (job) =>
  job && job.name === DOCUMENT_DIGEST_JOB_NAME ? runDocumentDigests() : processScheduledRequests();

const processScheduledRequests = async () => {
  const schedules = await getDueSchedules();
  let processed = 0;
  let failures = 0;

  for (const schedule of schedules) {
    try {
      if (!schedule.clientEmail) {
        process.stdout.write(`Scheduled request ${schedule.id} skipped: client has no email\n`);
        continue;
      }

      await withTenantTransaction({ firmId: schedule.firmId }, async (db) => {
        await requestClientDocuments(db, {
          firmId: schedule.firmId,
          clientId: schedule.clientId,
          actorUserId: null,
          documentTypes: schedule.documentTypes
        });

        await insertAuditLog(db, {
          firmId: schedule.firmId,
          action: "scheduled_request_sent",
          entityType: "client",
          entityId: schedule.clientId,
          metadata: {
            scheduleId: schedule.id,
            frequency: schedule.frequency
          }
        });
      });

      await markSent({ scheduleId: schedule.id });
      processed += 1;
    } catch (error) {
      failures += 1;
      process.stderr.write(
        `Scheduled request ${schedule.id} failed: ${String(error.message || error)}\n`
      );
    }
  }

  process.stdout.write(
    `Scheduled requests processed: ${processed}; failures: ${failures}; due: ${schedules.length}\n`
  );

  return { processed, failures, due: schedules.length };
};

const createScheduledRequestsWorker = () => {
  const connection = new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null
  });
  const worker = new Worker(SCHEDULED_REQUESTS_QUEUE, processScheduledJob, {
    connection,
    // Held off until the caller has verified the runtime DB role is not a
    // superuser — see document-processing.worker.js's startup gate.
    autorun: false
  });

  worker.on("ready", () => {
    process.stdout.write(`Scheduled requests worker listening on "${SCHEDULED_REQUESTS_QUEUE}"\n`);
  });
  worker.on("failed", (job, error) => {
    process.stderr.write(
      `Scheduled requests job ${job ? job.id : "unknown"} failed: ${String(error.message || error)}\n`
    );
  });

  return { worker, connection };
};

module.exports = {
  SCHEDULED_REQUESTS_QUEUE,
  addScheduledRequestsJob,
  addDocumentDigestJob,
  processScheduledJob,
  processScheduledRequests,
  createScheduledRequestsWorker
};
