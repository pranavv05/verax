#!/usr/bin/env node
/**
 * Seeds the demo firm, admin user and two clients.
 *
 * Idempotent: if admin@demo.com already exists the script prints the existing
 * credentials and exits 0 without touching anything, so it is safe to re-run
 * immediately before a demo.
 *
 * Usage:
 *   node scripts/seed-demo.js
 */

const path = require("path");
const crypto = require("crypto");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");

// Same precedence as src/config/env.js and knexfile.js: backend/.env wins,
// repo-root .env only fills in what it does not define.
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });
dotenv.config({ path: path.resolve(__dirname, "..", "..", ".env") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set -- check backend/.env");
  process.exit(1);
}

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const MAGIC_LINK_EXPIRY_HOURS = Number(process.env.MAGIC_LINK_EXPIRY_HOURS || 24);
const BCRYPT_COST = 12;

const FIRM_NAME = "Prakash & Associates Demo";
const ADMIN_EMAIL = "admin@demo.com";
const ADMIN_PASSWORD = "Demo@123456";
const ADMIN_NAME = "Demo Admin";
const CLIENTS = [
  { name: "Sharma Enterprises", gstin: "29AABCS1429B1Z1", email: "sharma@test.com" },
  { name: "Gupta Trading Co", gstin: "27AADCG1234F1Z5", email: "gupta@test.com" }
];

// A local Postgres (the docker-compose postgres:15 container) is built with
// `ssl = off`, so an unconditional ssl option makes the driver fail the
// handshake with "The server does not support SSL connections" before a single
// query runs. Managed providers (Render, Supabase, RDS) do require TLS and
// present certs that do not chain to a local trust store, hence
// rejectUnauthorized:false there. Decide from the host rather than forcing one.
const isLocalHost = (connectionString) => {
  try {
    const host = new URL(connectionString).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "postgres";
  } catch {
    return false;
  }
};

const pool = new Pool({
  connectionString: DATABASE_URL,
  ...(isLocalHost(DATABASE_URL) ? {} : { ssl: { rejectUnauthorized: false } })
});

const setLocalConfig = (client, key, value) =>
  client.query("SELECT set_config($1, $2, true)", [key, value ?? ""]);

const createUploadToken = () => crypto.randomBytes(32).toString("hex");

const printCredentials = (clientNames) => {
  console.log("");
  console.log("=== DEMO CREDENTIALS ===");
  console.log(`URL: ${FRONTEND_URL}`);
  console.log(`Email: ${ADMIN_EMAIL}`);
  console.log(`Password: ${ADMIN_PASSWORD}`);
  console.log(`Client 1: ${clientNames[0]}`);
  console.log(`Client 2: ${clientNames[1]}`);
  console.log("");
};

const main = async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Look the admin up through the `login` RLS escape hatch on `users`
    // (migration 20260311171500), the only sanctioned way to read a user before
    // a firm context exists.
    await setLocalConfig(client, "app.current_firm_id", "");
    await setLocalConfig(client, "app.auth_context", "login");
    await setLocalConfig(client, "app.auth_email", ADMIN_EMAIL);

    const existing = await client.query(
      `SELECT u.id, u.firm_id, f.name AS firm_name
         FROM users u
         JOIN firms f ON f.id = u.firm_id
        WHERE lower(u.email) = $1 AND u.deleted_at IS NULL
        LIMIT 1`,
      [ADMIN_EMAIL]
    );

    if (existing.rowCount > 0) {
      const { firm_id: firmId, firm_name: firmName } = existing.rows[0];
      await setLocalConfig(client, "app.auth_context", "");
      await setLocalConfig(client, "app.auth_email", "");
      await setLocalConfig(client, "app.current_firm_id", firmId);

      const clientRows = await client.query(
        `SELECT name FROM clients
          WHERE firm_id = $1 AND deleted_at IS NULL
          ORDER BY created_at ASC`,
        [firmId]
      );
      await client.query("COMMIT");

      const names = clientRows.rows.map((row) => row.name);
      console.log(`${ADMIN_EMAIL} already exists -- skipping creation.`);
      console.log(`Firm: ${firmName}`);
      printCredentials([
        names[0] || CLIENTS[0].name,
        names[1] || CLIENTS[1].name
      ]);
      return;
    }

    // The firms RLS policy is `WITH CHECK (id = app.current_firm_id())`, so the
    // firm's id has to be known and set as the tenant context *before* the row
    // is inserted -- a server-generated id could never satisfy its own check.
    const firmId = crypto.randomUUID();
    await setLocalConfig(client, "app.auth_context", "");
    await setLocalConfig(client, "app.auth_email", "");
    await setLocalConfig(client, "app.current_firm_id", firmId);

    const firmResult = await client.query(
      `INSERT INTO firms (id, name, owner_email, plan)
       VALUES ($1, $2, $3, 'professional')
       RETURNING id, name, plan`,
      [firmId, FIRM_NAME, ADMIN_EMAIL]
    );
    const firm = firmResult.rows[0];
    console.log(`Created firm: ${firm.name} (${firm.id})`);

    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, BCRYPT_COST);
    const userResult = await client.query(
      `INSERT INTO users (firm_id, name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, 'admin')
       RETURNING id, email, role`,
      [firmId, ADMIN_NAME, ADMIN_EMAIL, passwordHash]
    );
    const user = userResult.rows[0];
    console.log(`Created admin user: ${user.email} (role=${user.role})`);

    const createdClients = [];
    for (const definition of CLIENTS) {
      const result = await client.query(
        `INSERT INTO clients
           (firm_id, name, gstin, email, upload_token, upload_token_expires_at, status)
         VALUES ($1, $2, $3, $4, $5, NOW() + ($6 || ' hours')::interval, 'active')
         RETURNING id, name, gstin`,
        [
          firmId,
          definition.name,
          definition.gstin,
          definition.email,
          createUploadToken(),
          String(MAGIC_LINK_EXPIRY_HOURS)
        ]
      );
      createdClients.push(result.rows[0]);
      console.log(`Created client: ${result.rows[0].name} (${result.rows[0].gstin})`);
    }

    await client.query(
      `INSERT INTO audit_logs (firm_id, user_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, 'firm_registered', 'firm', $3, $4::jsonb)`,
      [
        firmId,
        user.id,
        firmId,
        JSON.stringify({ firmName: firm.name, userEmail: ADMIN_EMAIL, source: "seed-demo" })
      ]
    );

    await client.query("COMMIT");
    printCredentials(createdClients.map((row) => row.name));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

main()
  .then(() => pool.end())
  .catch(async (error) => {
    console.error("\nSeed failed:", error.message);
    await pool.end().catch(() => {});
    process.exit(1);
  });
