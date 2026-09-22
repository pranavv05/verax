const { Pool } = require("pg");
const env = require("../config/env");

// Prefer the least-privilege runtime role (APP_DATABASE_URL) when set.
// DATABASE_URL alone is also used by knex to run migrations, which need DDL
// rights that a role safe to run app queries under must not have — see the
// comment on APP_DATABASE_URL in src/config/env.js for why this matters for
// Row Level Security specifically.
const pool = new Pool({
  connectionString: env.APP_DATABASE_URL || env.DATABASE_URL,
  max: env.DB_POOL_MAX,
  idleTimeoutMillis: env.DB_POOL_IDLE_TIMEOUT_MS,
  connectionTimeoutMillis: env.DB_POOL_CONNECTION_TIMEOUT_MS,
  statement_timeout: env.DB_STATEMENT_TIMEOUT_MS
});

// A pool-level error (e.g. an idle client's connection dropped by the
// server) is emitted asynchronously and has no request to bubble up to —
// left unhandled, it crashes the process via Node's default 'error' event
// behavior. Log it and let the pool recover the connection on next use.
pool.on("error", (error) => {
  process.stderr.write(`Unexpected Postgres pool error: ${error.stack || error.message}\n`);
});

module.exports = pool;
