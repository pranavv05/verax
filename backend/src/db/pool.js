const { Pool } = require("pg");
const env = require("../config/env");

// Prefer the least-privilege runtime role (APP_DATABASE_URL) when set.
// DATABASE_URL alone is also used by knex to run migrations, which need DDL
// rights that a role safe to run app queries under must not have — see the
// comment on APP_DATABASE_URL in src/config/env.js for why this matters for
// Row Level Security specifically.
const pool = new Pool({
  connectionString: env.APP_DATABASE_URL || env.DATABASE_URL
});

module.exports = pool;
