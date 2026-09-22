/**
 * A failed login against an email that doesn't exist in the system used to
 * be unloggable at all: audit_logs.firm_id was NOT NULL with no RLS escape
 * hatch for an unresolved firm. Migration 20260922000000 made firm_id
 * nullable and added a narrow write-only escape hatch scoped to the exact
 * 'login' / 'client_portal_login' auth_context values loginUser/clientLogin
 * already set.
 *
 * Requires a live Postgres with migrations applied. Skipped automatically
 * if DATABASE_URL/APP_DATABASE_URL aren't set, same as rls.test.js.
 */
const { Pool } = require("pg");

const ADMIN_URL = process.env.DATABASE_URL;
const APP_URL = process.env.APP_DATABASE_URL;

const describeIfDb = ADMIN_URL && APP_URL ? describe : describe.skip;

const { loginUser } = require("../../src/services/auth.service");
const { clientLogin } = require("../../src/services/client-auth.service");
const sharedAppPool = require("../../src/db/pool");

describeIfDb("Audit logging for unknown-email login attempts", () => {
  let adminPool;
  let appPool;
  const unknownEmail = "nobody-real-14141414@nowhere.test";

  beforeAll(() => {
    adminPool = new Pool({ connectionString: ADMIN_URL });
    appPool = new Pool({ connectionString: APP_URL });
  });

  afterAll(async () => {
    await adminPool.query(`DELETE FROM audit_logs WHERE metadata->>'email' = $1`, [unknownEmail]);
    await adminPool.end();
    await appPool.end();
    await sharedAppPool.end();
  });

  test("a login attempt against an unknown email is now audit-logged with a NULL firm_id", async () => {
    await expect(loginUser({ email: unknownEmail, password: "irrelevant" })).rejects.toThrow(
      "Invalid email or password"
    );

    const { rows } = await adminPool.query(
      `SELECT firm_id, user_id, action, metadata FROM audit_logs WHERE metadata->>'email' = $1`,
      [unknownEmail]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].firm_id).toBeNull();
    expect(rows[0].user_id).toBeNull();
    expect(rows[0].action).toBe("login_failed");
    expect(rows[0].metadata.reason).toBe("unknown_email");
  });

  test("a client-portal login attempt against an unknown email is also now audit-logged with a NULL firm_id", async () => {
    const unknownPortalEmail = "nobody-portal-25252525@nowhere.test";
    await expect(
      clientLogin({ email: unknownPortalEmail, password: "irrelevant" })
    ).rejects.toThrow("Invalid email or password");

    const { rows } = await adminPool.query(
      `SELECT firm_id, action, metadata FROM audit_logs WHERE metadata->>'portalEmail' = $1`,
      [unknownPortalEmail]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].firm_id).toBeNull();
    expect(rows[0].action).toBe("client_portal_login_failed");
    expect(rows[0].metadata.reason).toBe("unknown_email");

    await adminPool.query(`DELETE FROM audit_logs WHERE metadata->>'portalEmail' = $1`, [
      unknownPortalEmail
    ]);
  });

  test("the NULL-firm_id escape hatch cannot be used outside the 'login' auth_context (as the ca_app role)", async () => {
    const client = await appPool.connect();
    try {
      await client.query("BEGIN");
      // Deliberately no app.auth_context set (mirrors an ordinary
      // firm-scoped or context-less session) — this must be rejected by the
      // same WITH CHECK clause that permits the loginUser path.
      await expect(
        client.query(
          `INSERT INTO audit_logs (firm_id, action, entity_type, metadata) VALUES (NULL, 'login_failed', 'user', '{}'::jsonb)`
        )
      ).rejects.toThrow(/row-level security/i);
    } finally {
      await client.query("ROLLBACK").catch(() => {});
      client.release();
    }
  });

  test("a NULL firm_id row is invisible to an ordinary firm-scoped session", async () => {
    // Insert directly as admin (bypasses RLS) so the row exists independent
    // of the escape hatch, then confirm a firm-scoped app-role session can't
    // see it — the escape hatch is write-only, not a new read path.
    await adminPool.query(
      `INSERT INTO audit_logs (firm_id, action, entity_type, metadata) VALUES (NULL, 'login_failed', 'user', jsonb_build_object('email', $1::text))`,
      [unknownEmail]
    );

    const client = await appPool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.current_firm_id', gen_random_uuid()::text, true)");
      const { rows } = await client.query(
        `SELECT * FROM audit_logs WHERE metadata->>'email' = $1`,
        [unknownEmail]
      );
      expect(rows).toHaveLength(0);
    } finally {
      await client.query("ROLLBACK").catch(() => {});
      client.release();
    }
  });
});
