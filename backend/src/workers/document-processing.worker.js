const Sentry = require("@sentry/node");

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1
  });
}

const IORedis = require("ioredis");
const { Queue, Worker } = require("bullmq");
const env = require("../config/env");

// An uncaught exception or unhandled rejection previously crashed this
// process with no report anywhere — Sentry only ever saw errors that a
// job's own try/catch chose to report. Mirrors backend/src/server.js.
const crashWithReport = (label) => (errorOrReason) => {
  const error = errorOrReason instanceof Error ? errorOrReason : new Error(String(errorOrReason));
  process.stderr.write(`${label}: ${error.stack || error.message}\n`);
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(error);
    Sentry.close(2000).finally(() => process.exit(1));
  } else {
    process.exit(1);
  }
};

process.on("uncaughtException", crashWithReport("Uncaught exception"));
process.on("unhandledRejection", crashWithReport("Unhandled rejection"));
const { DOCUMENT_PROCESSING_QUEUE } = require("../constants/queues");
const { assertRuntimeRoleIsNotSuperuser } = require("../db/assert-safe-role");
const { createScheduledRequestsWorker } = require("../jobs/scheduled-requests.job");
const { createDocumentJobProcessor, createStuckDocumentRecovery } = require("./document-job.processor");

const redisConnection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null
});
// Runs the scheduled-requests worker in this same process by default
// (matching the single verax-worker service in render.yaml). Set
// SCHEDULED_REQUESTS_EMBEDDED=false when running
// src/workers/scheduled-requests.worker.js as its own deployable process
// instead — without this flag, splitting document-processing and
// scheduled-requests into separate services would run two independent
// scheduled-requests workers with no way to turn either off.
const scheduledRequestsWorker = env.SCHEDULED_REQUESTS_EMBEDDED
  ? createScheduledRequestsWorker()
  : null;

// The job itself lives in document-job.processor.js (testable without Redis).
const worker = new Worker(DOCUMENT_PROCESSING_QUEUE, createDocumentJobProcessor(), {
  connection: redisConnection,
  concurrency: env.DOCUMENT_WORKER_CONCURRENCY,
  // Held off until assertRuntimeRoleIsNotSuperuser() passes, below — see
  // that check's comment for why a worker running as a superuser would
  // silently defeat Row Level Security for every job it processes.
  autorun: false
});

// Finds documents whose job died mid-run (worker crash, OOM, redeploy) and
// would otherwise show "processing" forever.
const queue = new Queue(DOCUMENT_PROCESSING_QUEUE, { connection: redisConnection });
const stuckDocuments = createStuckDocumentRecovery({ queue });
const STUCK_SWEEP_INTERVAL_MS = 5 * 60 * 1000;
let stuckSweepTimer = null;

const sweepStuckDocuments = async () => {
  try {
    const recovered = await stuckDocuments.sweep();
    if (recovered > 0) {
      process.stderr.write(`Marked ${recovered} interrupted document(s) as failed\n`);
    }
  } catch (error) {
    process.stderr.write(`Stuck-document sweep failed: ${String(error.message || error)}\n`);
  }
};

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
    `Job ${jobId} failed for document ${documentId}: ${String((error && error.message) || error)}\n`
  );

  // Out of attempts: make sure the document isn't left in "processing"
  // (a no-op when the processor already recorded the failure).
  const finalAttempt = job && job.attemptsMade >= ((job.opts && job.opts.attempts) || 1);
  if (finalAttempt) {
    stuckDocuments.recoverJob(job).catch((recoverError) => {
      process.stderr.write(
        `Could not recover document ${documentId} after job failure: ${String(recoverError.message || recoverError)}\n`
      );
    });
  }
});

worker.on("error", (error) => {
  process.stderr.write(`Worker error: ${String(error.message || error)}\n`);
});

const shutdown = async () => {
  process.stdout.write("Shutting down document worker...\n");
  if (stuckSweepTimer) clearInterval(stuckSweepTimer);
  await worker.close();
  await queue.close();
  if (scheduledRequestsWorker) {
    await scheduledRequestsWorker.worker.close();
    await scheduledRequestsWorker.connection.quit();
  }
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

(async () => {
  try {
    await assertRuntimeRoleIsNotSuperuser();
    await sweepStuckDocuments();
    stuckSweepTimer = setInterval(sweepStuckDocuments, STUCK_SWEEP_INTERVAL_MS);
    const runs = [worker.run()];
    if (scheduledRequestsWorker) {
      runs.push(scheduledRequestsWorker.worker.run());
    }
    await Promise.all(runs);
  } catch (error) {
    process.stderr.write(`Worker failed to start: ${error.message}\n`);
    process.exit(1);
  }
})();
