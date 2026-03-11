const path = require("path");
require("dotenv").config({ path: path.resolve(process.cwd(), "../.env") });

module.exports = {
  development: {
    client: "pg",
    connection:
      process.env.DATABASE_URL ||
      "postgresql://ca_user:ca_password@localhost:5432/ca_saas",
    migrations: {
      directory: path.resolve(__dirname, "migrations")
    },
    pool: {
      min: 2,
      max: 10
    }
  }
};
