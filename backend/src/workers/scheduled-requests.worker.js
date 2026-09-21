const { assertRuntimeRoleIsNotSuperuser } = require("../db/assert-safe-role");
const { createScheduledRequestsWorker } = require("../jobs/scheduled-requests.job");

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
