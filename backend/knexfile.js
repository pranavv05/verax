const path = require("path");
// Same precedence as src/config/env.js: backend/.env wins, repo-root .env fills gaps.
// Paths are resolved from __dirname, not process.cwd(), so migrations work from any cwd.
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const connection = process.env.DATABASE_URL;
if (!connection) {
  throw new Error("DATABASE_URL is not set — check backend/.env");
}
const migrations = { directory: path.resolve(__dirname, "migrations") };
const pool = { min: 2, max: 10 };

module.exports = {
  development: {
    client: "pg",
    connection,
    migrations,
    pool
  },
  production: {
    client: "pg",
    connection: {
      connectionString: connection,
      ssl: { rejectUnauthorized: false }
    },
    migrations,
    pool
  }
};
