/**
 * registerFirm runs as the least-privilege ca_app role, which is subject to
 * firms_isolation_policy. Signup used to let Postgres default the firm id, so
 * the INSERT ran with an empty app.current_firm_id and was rejected with
 * "new row violates row-level security policy for table firms" — every new
 * firm failed to sign up. Unit tests mock the database and could not see it.
 *
 * Requires a live Postgres with migrations applied. Skipped automatically
 * if DATABASE_URL/APP_DATABASE_URL aren't set, same as rls.test.js.
 */
const { Pool } = require("pg");

const ADMIN_URL = process.env.DATABASE_URL;
const APP_URL = process.env.APP_DATABASE_URL;

const describeIfDb = ADMIN_URL && APP_URL ? describe : describe.skip;

const { registerFirm } = require("../../src/services/auth.service");
const sharedAppPool = require("../../src/db/pool");

describeIfDb("Firm signup under RLS", () => {
  let adminPool;
  const email = `signup-test-${Date.now()}@test.local`;
  let firmId;

  beforeAll(() => {
    adminPool = new Pool({ connectionString: ADMIN_URL });
  });

  afterAll(async () => {
    if (firmId) {
      await adminPool.query(`DELETE FROM audit_logs WHERE firm_id = $1`, [firmId]);
      await adminPool.query(`DELETE FROM refresh_tokens WHERE firm_id = $1`, [firmId]);
      await adminPool.query(`DELETE FROM users WHERE firm_id = $1`, [firmId]);
      await adminPool.query(`DELETE FROM firms WHERE id = $1`, [firmId]);
    }
    await adminPool.end();
    await sharedAppPool.end();
  });

  it("creates the firm, its admin and a session", async () => {
    const result = await registerFirm({
      name: "Signup Tester",
      firmName: "Signup Test Firm",
      email,
      password: "correct horse battery staple",
      userAgent: "jest",
      ipAddress: "127.0.0.1"
    });
    firmId = result.firm.id;

    expect(result.accessToken).toEqual(expect.any(String));
    expect(result.refreshToken).toEqual(expect.any(String));
    expect(result.firm).toMatchObject({ name: "Signup Test Firm", plan: "starter" });

    const { rows } = await adminPool.query(
      `SELECT role FROM users WHERE firm_id = $1 AND lower(email) = $2`,
      [firmId, email]
    );
    expect(rows).toEqual([{ role: "admin" }]);
  });

  it("rejects a second signup with the same email", async () => {
    await expect(
      registerFirm({
        name: "Signup Tester",
        firmName: "Another Firm",
        email,
        password: "correct horse battery staple",
        userAgent: "jest",
        ipAddress: "127.0.0.1"
      })
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
