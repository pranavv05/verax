const Sentry = require("@sentry/node");

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1
  });
}

const app = require("./app");
const env = require("./config/env");
const pool = require("./db/pool");
const { assertRuntimeRoleIsNotSuperuser } = require("./db/assert-safe-role");
const { addScheduledRequestsJob } = require("./jobs/scheduled-requests.job");

let server;

const startServer = async () => {
  await pool.query("SELECT 1");
  await assertRuntimeRoleIsNotSuperuser();
  await addScheduledRequestsJob();
  server = app.listen(env.PORT, () => {
    process.stdout.write(`Backend API listening on port ${env.PORT}\n`);
  });
};

const shutdown = async () => {
  if (server) {
    await new Promise((resolve) => {
      server.close(resolve);
    });
  }
  await pool.end();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

const formatStartupError = (error) => {
  if (error instanceof AggregateError) {
    const nestedMessages = error.errors
      .map((nestedError) => nestedError && (nestedError.message || nestedError.code || String(nestedError)))
      .filter(Boolean)
      .join("; ");

    return [
      error.message,
      error.code,
      nestedMessages
    ].filter(Boolean).join(" - ");
  }

  return error && (error.stack || error.message) ? error.stack || error.message : String(error);
};

startServer().catch((error) => {
  process.stderr.write(`Server failed to start: ${formatStartupError(error)}\n`);
  process.exit(1);
});
