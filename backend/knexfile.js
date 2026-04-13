const path = require("path");
require("dotenv").config({ path: path.resolve(process.cwd(), "../.env") });

const connection = process.env.DATABASE_URL || "postgresql://ca_user:ca_password@localhost:5432/ca_saas";
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
