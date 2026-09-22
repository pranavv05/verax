const Sentry = require("@sentry/node");

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1
  });
}

const { assertRuntimeRoleIsNotSuperuser } = require("../db/assert-safe-role");
const { createScheduledRequestsWorker } = require("../jobs/scheduled-requests.job");

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

// Standalone entry point for the scheduled-requests cron consumer, for
// operators who want to scale it independently of the document-processing
// worker. By default (render.yaml today) the two run embedded in the same
// process via document-processing.worker.js — see SCHEDULED_REQUESTS_EMBEDDED
// in config/env.js. Running BOTH this file and an embedded worker against the
// same Redis is safe (BullMQ delivers each job to exactly one consumer) but
// redundant; set SCHEDULED_REQUESTS_EMBEDDED=false on the document worker's
// deployment when running this as its own service.
const { worker, connection } = createScheduledRequestsWorker();

const shutdown = async () => {
  process.stdout.write("Shutting down scheduled-requests worker...\n");
  await worker.close();
  await connection.quit();
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
    await worker.run();
  } catch (error) {
    process.stderr.write(`Worker failed to start: ${error.message}\n`);
    process.exit(1);
  }
})();
